const Monitor = require('../models/Monitor');
const MetricSnapshot = require('../models/MetricSnapshot');
const Incident = require('../models/Incident');
const Settings = require('../models/Settings');
const primaryMetric = require('./primaryMetric');
const { sendNotification } = require('../services/notifier');
const { decryptConfig } = require('../utils/crypto');
const sse = require('../sse');
const handlers = require('./handlers');
const i18n = require('../i18n');

function computeSeverity(result, monitorType) {
  const status = result.status;
  const statusCode = result.state?.statusCode;
  const lastError = (result.lastError || '').toLowerCase();

  if (status === 'offline') {
    return ['http', 'ping', 'heartbeat'].includes(monitorType) ? 'P1' : 'P2';
  }
  if (status === 'error') {
    if (monitorType === 'http' && statusCode >= 500) return 'P1';
    if (lastError.includes('timeout') || lastError.includes('econnrefused') || lastError.includes('econnreset')) return 'P1';
    return 'P2';
  }
  // warning
  if (lastError.includes('ssl expiré') || lastError.includes('expiré')) return 'P2';
  return 'P3';
}

function applyTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function resolveProxy(monitor, settings, globalProxy) {
  if (monitor.config?.proxyId) {
    const saved = settings?.proxies?.find(p => String(p._id) === String(monitor.config.proxyId));
    return saved ? decryptConfig(saved) : globalProxy;
  }
  return globalProxy;
}

async function runCheck(monitor, globalProxy = null, lang = 'fr') {
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

  const effectiveConfig = globalProxy
    ? { ...monitor.config, proxy: { ...globalProxy, enabled: true } }
    : monitor.config;

  const L = i18n[lang] || i18n.fr;

  let result;
  try {
    result = await handler.check(effectiveConfig, monitor.lastState, lang);
  } catch (err) {
    console.error(`[Runner] Unexpected error on ${monitor.name}:`, err.message);
    result = {
      status: 'error',
      state: monitor.lastState,
      metrics: monitor.metrics,
      notifications: [{ title: `Error — ${monitor.name}`, message: err.message, level: 'error', type: 'error' }],
    };
  }

  const errorNotif = (result.notifications || []).find(n => (n.level === 'error' || n.level === 'warning') && n.type === 'status_change');
  const update = {
    status: result.status,
    lastState: result.state ?? monitor.lastState,
    metrics: result.metrics ?? monitor.metrics,
    lastChecked: new Date(),
    lastError: ['error', 'warning'].includes(result.status) ? (result.lastError || errorNotif?.message || result.state?.errMsg || null) : null,
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
    const severity = computeSeverity(result, monitor.type);
    Incident.findOneAndUpdate(
      { monitorId: monitor._id, resolvedAt: null },
      { $setOnInsert: { monitorId: monitor._id, monitorName: monitor.name, monitorType: monitor.type, triggerStatus: result.status, severity, reason: update.lastError || null, startedAt: new Date() } },
      { upsert: true, new: false }
    ).catch(() => {});
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
      const notif = L.monitorOffline(monitor.name, monitorNotifs[0]?.message, result.status);
      monitorNotifs.push({ ...notif, level: 'error', type: 'status_change' });
    } else if (cameBack) {
      const notif = L.monitorBack(monitor.name);
      monitorNotifs.push({ ...notif, level: 'success', type: 'status_change' });
    }
  }

  // Apply per-monitor custom notification templates (overrides i18n defaults)
  const cfg = monitor.config || {};
  if (cfg.downTitle || cfg.downMessage || cfg.recoveryTitle || cfg.recoveryMessage) {
    for (const notif of monitorNotifs) {
      if (notif.type !== 'status_change') continue;
      const isRecovery = notif.level === 'success';
      if (isRecovery && (cfg.recoveryTitle || cfg.recoveryMessage)) {
        const downAt = monitor.lastDownAt ? new Date(monitor.lastDownAt) : null;
        const duration = downAt ? formatDuration(Date.now() - downAt.getTime()) : '?';
        const vars = {
          name: monitor.name,
          duration,
          downAt:      downAt ? downAt.toLocaleString() : '?',
          resolvedAt:  new Date().toLocaleString(),
        };
        if (cfg.recoveryTitle)   notif.title   = applyTemplate(cfg.recoveryTitle,   vars);
        if (cfg.recoveryMessage) notif.message = applyTemplate(cfg.recoveryMessage, vars);
      } else if (!isRecovery && (cfg.downTitle || cfg.downMessage)) {
        const vars = { name: monitor.name, status: result.status };
        if (cfg.downTitle)   notif.title   = applyTemplate(cfg.downTitle,   vars);
        if (cfg.downMessage) notif.message = applyTemplate(cfg.downMessage, vars);
      }
    }
  }

  // Dedup: one notification when service goes down, one when it recovers — nothing in between.
  // Atomic updates prevent duplicate notifications from concurrent checks.
  const toSend = [];

  for (const notif of monitorNotifs) {
    if (notif.type !== 'status_change') {
      toSend.push(notif);
      continue;
    }
    const isDown = ['error', 'warning'].includes(notif.level);
    const isRecovery = notif.level === 'success';

    if (isDown) {
      // Only notify if we haven't already notified for this outage.
      const claimed = await Monitor.findOneAndUpdate(
        { _id: monitor._id, lastDownNotified: { $ne: true } },
        { $set: { lastDownNotified: true, lastDownAt: new Date() } },
        { new: false }
      );
      if (claimed) {
        toSend.push(notif);
      } else {
        console.log(`[Runner] Suppressed (already notified): ${monitor.name}`);
      }
    } else if (isRecovery) {
      // Only notify recovery if a down notification was previously sent.
      const claimed = await Monitor.findOneAndUpdate(
        { _id: monitor._id, lastDownNotified: true },
        { $set: { lastDownNotified: false } },
        { new: false }
      );
      if (claimed) toSend.push(notif);
    } else {
      toSend.push(notif);
    }
  }

  for (const notif of toSend) {
    await sendNotification({ ...notif, monitorId: monitor._id, monitorName: monitor.name });
  }
}

async function runReport(monitor, lang = 'fr') {
  const handler = handlers[monitor.type];
  if (!handler?.report) return;

  console.log(`[Runner] Report: ${monitor.name}`);

  try {
    const { title, message } = await handler.report(monitor.config, monitor.metrics ?? monitor.lastState, lang);
    await sendNotification({ title, message, level: 'info', type: 'report', monitorId: monitor._id, monitorName: monitor.name });
    await Monitor.findByIdAndUpdate(monitor._id, { lastReported: new Date() });
  } catch (err) {
    console.error(`[Runner] Report error ${monitor.name}:`, err.message);
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

  const settings = await Settings.findOne({ key: 'global' }).lean().catch(() => null);
  const activeProxy = settings?.proxies?.find(p => p.active);
  const globalProxy = activeProxy ? decryptConfig(activeProxy) : null;
  const lang = settings?.notificationLanguage || 'fr';

  for (const monitor of monitors) {
    const checkMs = monitor.checkInterval * 60 * 1000;
    const lastCheck = monitor.lastChecked ? monitor.lastChecked.getTime() : 0;
    if (now - lastCheck >= checkMs) {
      const proxyForMonitor = resolveProxy(monitor, settings, globalProxy);
      runCheck(monitor, proxyForMonitor, lang).catch(err => console.error(`[Runner] tick error ${monitor.name}:`, err.message));
    }

    if (monitor.reportInterval > 0) {
      const reportMs = monitor.reportInterval * 60 * 60 * 1000;
      const lastReport = monitor.lastReported ? monitor.lastReported.getTime() : 0;
      if (now - lastReport >= reportMs) {
        runReport(monitor, lang).catch(err => console.error(`[Runner] report error ${monitor.name}:`, err.message));
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
    const lang = s.notificationLanguage || 'fr';
    const L = i18n[lang] || i18n.fr;

    const message = L.weeklyReportBody(uptimePct, onlineCount, total, problems);

    await sendNotification({ title: L.weeklyReportTitle, message, level: 'info', type: 'report' });
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
    const settings = await Settings.findOne({ key: 'global' }).lean().catch(() => null);
    const activeProxy = settings?.proxies?.find(p => p.active);
    const globalProxy = activeProxy ? decryptConfig(activeProxy) : null;
    const lang = settings?.notificationLanguage || 'fr';
    const m = { ...monitor.toObject(), lastChecked: null };
    runCheck(m, resolveProxy(m, settings, globalProxy), lang);
  }
}

module.exports = { start, triggerNow };
