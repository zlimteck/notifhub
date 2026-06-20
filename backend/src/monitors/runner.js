const Monitor = require('../models/Monitor');
const MetricSnapshot = require('../models/MetricSnapshot');
const Incident = require('../models/Incident');
const Settings = require('../models/Settings');
const primaryMetric = require('./primaryMetric');
const { sendNotification } = require('../services/notifier');
const sse = require('../sse');
const handlers = require('./handlers');

async function runCheck(monitor) {
  const handler = handlers[monitor.type];
  if (!handler) return;

  // Skip checks during maintenance window
  if (monitor.maintenanceUntil && new Date(monitor.maintenanceUntil) > new Date()) {
    console.log(`[Runner] Maintenance: ${monitor.name} — skip until ${monitor.maintenanceUntil}`);
    return;
  }
  // Auto-clear expired maintenance
  if (monitor.maintenanceUntil && new Date(monitor.maintenanceUntil) <= new Date()) {
    await Monitor.findByIdAndUpdate(monitor._id, { maintenanceUntil: null });
  }

  console.log(`[Runner] Check: ${monitor.name} (${monitor.type})`);

  let result;
  try {
    result = await handler.check(monitor.config, monitor.lastState);
  } catch (err) {
    console.error(`[Runner] Erreur inattendue sur ${monitor.name}:`, err.message);
    result = {
      status: 'error',
      state: monitor.lastState,
      metrics: monitor.metrics,
      notifications: [{ title: `Erreur — ${monitor.name}`, message: err.message, level: 'error', type: 'error' }],
    };
  }

  const errorNotif = (result.notifications || []).find(n => n.level === 'error');
  const update = {
    status: result.status,
    lastState: result.state ?? monitor.lastState,
    metrics: result.metrics ?? monitor.metrics,
    lastChecked: new Date(),
    lastError: ['error', 'warning'].includes(result.status) ? (errorNotif?.message || result.state?.errMsg || 'Erreur inconnue') : null,
  };

  // AdGuard token refresh — persist updated tokens
  if (result.configUpdate) {
    update.config = { ...monitor.config, ...result.configUpdate };
  }

  const prevStatus = monitor.status;
  await Monitor.findByIdAndUpdate(monitor._id, update);
  sse.broadcast('monitor', { id: monitor._id, ...update });

  // Snapshot
  MetricSnapshot.create({
    monitorId: monitor._id,
    type: monitor.type,
    status: result.status,
    value: primaryMetric(monitor.type, result.metrics),
    metrics: result.metrics ?? null,
  }).catch(() => {});

  // Incident tracking
  if (['error', 'offline', 'warning'].includes(result.status)) {
    const existingOpen = await Incident.findOne({ monitorId: monitor._id, resolvedAt: null });
    if (!existingOpen) {
      Incident.create({
        monitorId: monitor._id,
        monitorName: monitor.name,
        monitorType: monitor.type,
        triggerStatus: result.status,
      }).catch(() => {});
    }
  } else if (result.status === 'online') {
    const open = await Incident.findOne({ monitorId: monitor._id, resolvedAt: null }).sort({ startedAt: -1 });
    if (open) {
      open.resolvedAt = new Date();
      open.duration = open.resolvedAt - open.startedAt;
      await open.save();
    }
  }

  const monitorNotifs = result.notifications || [];
  const hasStatusChange = monitorNotifs.some(n => n.type === 'status_change');

  // Dependency check: suppress down alerts if a parent monitor is also down
  if (monitor.dependsOn?.length) {
    const parents = await Monitor.find({ _id: { $in: monitor.dependsOn } }, 'name status').lean();
    const parentDown = parents.find(p => ['error', 'offline', 'warning'].includes(p.status));
    if (parentDown) {
      const before = monitorNotifs.length;
      for (let i = monitorNotifs.length - 1; i >= 0; i--) {
        if (monitorNotifs[i].type === 'status_change' && monitorNotifs[i].level !== 'success') {
          monitorNotifs.splice(i, 1);
        }
      }
      if (monitorNotifs.length < before) {
        console.log(`[Runner] Alerte supprimée — ${monitor.name} dépend de ${parentDown.name} (${parentDown.status})`);
      }
    }
  }

  // Global status-change notifications for monitors that don't handle their own
  if (!hasStatusChange) {
    const wentDown = prevStatus === 'online' && ['error', 'offline', 'warning'].includes(result.status);
    const cameBack = ['error', 'offline', 'warning'].includes(prevStatus) && result.status === 'online';

    if (wentDown) {
      monitorNotifs.push({
        title: `${monitor.name} — Hors ligne`,
        message: monitorNotifs[0]?.message || `Statut : ${result.status}`,
        level: 'error',
        type: 'status_change',
      });
    } else if (cameBack) {
      monitorNotifs.push({
        title: `${monitor.name} — De retour`,
        message: 'Le service est de nouveau accessible.',
        level: 'success',
        type: 'status_change',
      });
    }
  }

  // Rate limiting: suppress repeated down/up alerts within the cooldown window
  // to avoid notification spam when a service flaps.
  const ALERT_COOLDOWN_MS = 15 * 60 * 1000;
  let { lastDownAt, lastDownNotified } = monitor;
  const toSend = [];

  for (const notif of monitorNotifs) {
    if (notif.type !== 'status_change') {
      toSend.push(notif);
      continue;
    }
    const isDown = ['error', 'warning'].includes(notif.level);
    const isRecovery = notif.level === 'success';

    if (isDown) {
      const inCooldown = lastDownAt && (Date.now() - new Date(lastDownAt).getTime() < ALERT_COOLDOWN_MS);
      if (!inCooldown) {
        toSend.push(notif);
        lastDownAt = new Date();
        lastDownNotified = true;
      } else {
        lastDownNotified = false;
        console.log(`[Runner] Rate limited (flap): ${monitor.name} — ${notif.title}`);
      }
    } else if (isRecovery) {
      if (lastDownNotified) toSend.push(notif);
      lastDownNotified = false;
    } else {
      toSend.push(notif);
    }
  }

  await Monitor.findByIdAndUpdate(monitor._id, { lastDownAt, lastDownNotified });

  for (const notif of toSend) {
    await sendNotification({ ...notif, monitorId: monitor._id, monitorName: monitor.name });
  }
}

async function runReport(monitor) {
  const handler = handlers[monitor.type];
  if (!handler?.report) return;

  console.log(`[Runner] Rapport: ${monitor.name}`);

  try {
    const { title, message } = await handler.report(monitor.config, monitor.metrics ?? monitor.lastState);
    await sendNotification({ title, message, level: 'info', type: 'report', monitorId: monitor._id, monitorName: monitor.name });
    await Monitor.findByIdAndUpdate(monitor._id, { lastReported: new Date() });
  } catch (err) {
    console.error(`[Runner] Erreur rapport ${monitor.name}:`, err.message);
  }
}

async function tick() {
  const now = Date.now();
  let monitors;
  try {
    monitors = await Monitor.find({ enabled: true });
  } catch {
    return;
  }

  for (const monitor of monitors) {
    const checkMs = monitor.checkInterval * 60 * 1000;
    const lastCheck = monitor.lastChecked ? monitor.lastChecked.getTime() : 0;
    if (now - lastCheck >= checkMs) {
      runCheck(monitor).catch(err => console.error(`[Runner] tick error ${monitor.name}:`, err.message));
    }

    if (monitor.reportInterval > 0) {
      const reportMs = monitor.reportInterval * 60 * 60 * 1000;
      const lastReport = monitor.lastReported ? monitor.lastReported.getTime() : 0;
      if (now - lastReport >= reportMs) {
        runReport(monitor).catch(err => console.error(`[Runner] report error ${monitor.name}:`, err.message));
      }
    }
  }
}

async function checkWeeklyReport() {
  try {
    const s = await Settings.findOne({ key: 'global' });
    if (!s?.weeklyReport?.enabled) return;

    const { dayOfWeek = 1, hour = 8 } = s.weeklyReport;
    const now = new Date();

    // Find the most recent occurrence of dayOfWeek at 'hour' UTC
    const scheduled = new Date(now);
    scheduled.setUTCHours(hour, 0, 0, 0);
    const diff = (now.getUTCDay() - dayOfWeek + 7) % 7;
    scheduled.setUTCDate(now.getUTCDate() - diff);

    if (now < scheduled) return; // not yet this week

    // Only send within a 15-minute window after the scheduled time
    if (now - scheduled > 15 * 60 * 1000) return;

    const last = s.weeklyReport.lastSentAt ? new Date(s.weeklyReport.lastSentAt) : null;
    if (last && last >= scheduled) return; // already sent this week

    // Build report
    const monitors = await Monitor.find({ enabled: true });
    const total = monitors.length;
    const onlineCount = monitors.filter(m => m.status === 'online').length;
    const problems = monitors.filter(m => !['online', 'unknown'].includes(m.status));

    const uptimePct = total > 0 ? Math.round((onlineCount / total) * 100) : 100;

    let message = `Uptime global : ${uptimePct}% (${onlineCount}/${total} services en ligne)`;
    if (problems.length > 0) {
      message += '\n\nServices en anomalie :\n';
      message += problems.map(m => `${m.name} — ${m.status}`).join('\n');
    } else {
      message += '\n\nTous les services sont en ligne.';
    }

    await sendNotification({ title: 'Rapport hebdomadaire NotifHub', message, level: 'info', type: 'report' });
    await Settings.updateOne({ key: 'global' }, { 'weeklyReport.lastSentAt': now });
    console.log('[Runner] Rapport hebdomadaire envoyé');
  } catch (err) {
    console.error('[Runner] Erreur rapport hebdomadaire:', err.message);
  }
}

function start() {
  console.log('[Runner] Démarrage du scheduler (tick toutes les 30s)');
  tick();
  setInterval(tick, 30 * 1000);
  // Weekly report: check every 15 minutes
  setInterval(checkWeeklyReport, 15 * 60 * 1000);
  checkWeeklyReport();
}

// Called when a monitor is saved/updated to trigger an immediate check
async function triggerNow(monitorId) {
  const monitor = await Monitor.findById(monitorId);
  if (monitor && monitor.enabled) {
    await Monitor.findByIdAndUpdate(monitorId, { lastChecked: null });
    runCheck({ ...monitor.toObject(), lastChecked: null });
  }
}

module.exports = { start, triggerNow };
