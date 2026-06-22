const axios = require('axios');
const https = require('https');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');

async function fetchData(config) {
  const { url, username, password, rejectUnauthorized = true, proxy } = config;
  const base = url.replace(/\/$/, '');
  const auth = { username, password };
  const proxyAgents = getProxyAgents(proxy);
  const httpsAgent = proxyAgents?.httpsAgent || (rejectUnauthorized ? undefined : new https.Agent({ rejectUnauthorized: false }));
  const httpExtra = proxyAgents ? { httpAgent: proxyAgents.httpAgent } : {};

  const [statusRes, statsRes] = await Promise.all([
    axios.get(`${base}/control/status`, { auth, httpsAgent, ...httpExtra, timeout: 10000 }),
    axios.get(`${base}/control/stats`,  { auth, httpsAgent, ...httpExtra, timeout: 10000 }),
  ]);

  return { status: statusRes.data, stats: statsRes.data, statusCode: statusRes.status };
}

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { url, username } = config;
  if (!url || !username) return {
    status: 'error', state: null, metrics: null, notifications: [
      { ...L.missingConfig('AdGuard Home', 'URL and credentials required'), level: 'error', type: 'status_change' },
    ],
  };

  const wasOnline = lastState !== null;

  try {
    const { status, stats, statusCode } = await fetchData(config);

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
      statusCode,
    };

    const notifications = [];

    if (!wasOnline) {
      notifications.push({ ...L.adguardhomeOnline(url, totalQueries, blockedPct), level: 'success', type: 'status_change' });
    }

    if (lastState !== null) {
      if (!protectionEnabled && lastState.protectionEnabled !== false) {
        notifications.push({ ...L.adguardhomeProtectionDisabled(url), level: 'warning', type: 'status_change' });
      } else if (protectionEnabled && lastState.protectionEnabled === false) {
        notifications.push({ ...L.adguardhomeProtectionEnabled(url), level: 'success', type: 'status_change' });
      }
    }

    const serviceStatus = protectionEnabled ? 'online' : 'warning';
    return { status: serviceStatus, state: metrics, metrics, notifications };
  } catch (err) {
    const notifications = wasOnline ? [{ ...L.unreachable('AdGuard Home', url, err.message), level: 'error', type: 'status_change' }] : [];
    return { status: 'offline', state: null, metrics: null, notifications };
  }
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  if (!state) return { title: 'AdGuard Home', message: 'Unreachable.' };
  return L.adguardhomeReport(state);
}

module.exports = { check, report };
