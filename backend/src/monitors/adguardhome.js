const axios = require('axios');

async function fetchData(config) {
  const { url, username, password, rejectUnauthorized = true } = config;
  const base = url.replace(/\/$/, '');
  const auth = { username, password };
  const httpsAgent = rejectUnauthorized ? undefined : new (require('https').Agent)({ rejectUnauthorized: false });

  const [statusRes, statsRes] = await Promise.all([
    axios.get(`${base}/control/status`, { auth, httpsAgent, timeout: 10000 }),
    axios.get(`${base}/control/stats`,  { auth, httpsAgent, timeout: 10000 }),
  ]);

  return { status: statusRes.data, stats: statsRes.data };
}

async function check(config, lastState) {
  const { url, username } = config;
  if (!url || !username) return {
    status: 'error', state: null, metrics: null, notifications: [
      { title: 'Config manquante — AdGuard Home', message: 'URL et identifiants requis', level: 'error', type: 'error' },
    ],
  };

  const wasOnline = lastState !== null;

  try {
    const { status, stats } = await fetchData(config);

    const totalQueries  = stats.num_dns_queries ?? 0;
    const blocked       = stats.num_blocked_filtering ?? 0;
    const safebrowsing  = stats.num_replaced_safebrowsing ?? 0;
    const parental      = stats.num_replaced_parental ?? 0;
    const blockedPct    = totalQueries > 0 ? Math.round((blocked / totalQueries) * 1000) / 10 : 0;
    const protectionEnabled = status.protection_enabled ?? true;

    const metrics = {
      protectionEnabled,
      version: status.version || null,
      totalQueries,
      blocked,
      blockedPct,
      safebrowsing,
      parental,
    };

    const notifications = [];

    if (!wasOnline) {
      notifications.push({
        title: `🟢 AdGuard Home — En ligne`,
        message: `${url} · ${totalQueries} requêtes · ${blockedPct}% bloquées`,
        level: 'success', type: 'status_change',
      });
    }

    if (lastState !== null) {
      if (!protectionEnabled && lastState.protectionEnabled !== false) {
        notifications.push({
          title: '⚠️ AdGuard Home — Protection désactivée',
          message: `La protection DNS a été désactivée sur ${url}`,
          level: 'warning', type: 'status_change',
        });
      } else if (protectionEnabled && lastState.protectionEnabled === false) {
        notifications.push({
          title: '✅ AdGuard Home — Protection réactivée',
          message: `La protection DNS est de nouveau active sur ${url}`,
          level: 'success', type: 'status_change',
        });
      }
    }

    const serviceStatus = protectionEnabled ? 'online' : 'warning';
    return { status: serviceStatus, state: metrics, metrics, notifications };
  } catch (err) {
    const notifications = wasOnline ? [{
      title: `🔴 AdGuard Home — Inaccessible`,
      message: `${url} · ${err.message}`,
      level: 'error', type: 'status_change',
    }] : [];
    return { status: 'offline', state: null, metrics: null, notifications };
  }
}

async function report(config, state) {
  if (!state) return { title: '🛡️ AdGuard Home', message: 'Inaccessible.' };
  const prot = state.protectionEnabled ? '✅ Active' : '❌ Désactivée';
  return {
    title: `🛡️ Rapport AdGuard Home`,
    message: `Protection : ${prot}\nRequêtes : ${state.totalQueries}\nBloquées : ${state.blocked} (${state.blockedPct}%)\nSafebrowsing : ${state.safebrowsing}\nParental : ${state.parental}`,
  };
}

module.exports = { check, report };
