const axios = require('axios');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');

async function withRetry(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      const retryable = ['EAI_AGAIN', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET'].includes(err.code)
        || (err.response?.status >= 500);
      if (!retryable) throw err;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
}

async function getTunnels(token, accountId, http) {
  const res = await withRetry(() =>
    http.get(`https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  return { tunnels: res.data.result || [], statusCode: res.status };
}

async function getTunnelConfig(token, accountId, tunnelId, http) {
  try {
    const res = await withRetry(() =>
      http.get(`https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    return res.data.result;
  } catch {
    return null;
  }
}

function extractIngress(configResult) {
  if (!configResult) return [];
  const ingress = configResult?.config?.ingress || [];
  return ingress.filter(i => i.hostname).map(i => i.hostname);
}

const SKIP_NAMES = ['default', 'temp', 'test', 'navidrome'];

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { apiToken, accountId, proxy } = config;
  if (!apiToken || !accountId) {
    return { status: 'error', state: null, metrics: null, notifications: [
      { ...L.missingConfig('Cloudflare', 'API Token and Account ID required'), level: 'error', type: 'status_change' }
    ]};
  }

  const proxyAgents = getProxyAgents(proxy);
  const http = axios.create({
    timeout: 10000,
    ...(proxyAgents && { httpsAgent: proxyAgents.httpsAgent, httpAgent: proxyAgents.httpAgent }),
  });

  const { tunnels, statusCode } = await getTunnels(apiToken, accountId, http);
  const active = tunnels.filter(t => {
    const n = (t.name || '').toLowerCase();
    return (t.status === 'active' || t.status === 'healthy') && !SKIP_NAMES.some(s => n.includes(s));
  });

  const currentTunnelMap = {};
  for (const t of active) {
    const cfg = await getTunnelConfig(apiToken, accountId, t.id, http);
    currentTunnelMap[t.id] = {
      id: t.id,
      name: t.name,
      status: t.status,
      hostnames: extractIngress(cfg),
    };
  }

  const notifications = [];
  const prevMap = lastState?.tunnels
    ? Object.fromEntries(lastState.tunnels.map(t => [t.id, t]))
    : null;

  for (const tunnel of Object.values(currentTunnelMap)) {
    const prev = prevMap?.[tunnel.id];
    const isHealthy = tunnel.status === 'active' || tunnel.status === 'healthy';

    if (prev !== undefined) {
      const wasHealthy = prev.status === 'active' || prev.status === 'healthy';
      if (isHealthy && !wasHealthy) {
        notifications.push({ ...L.tunnelRestored(tunnel.name), level: 'success', type: 'status_change' });
      } else if (!isHealthy && wasHealthy) {
        notifications.push({ ...L.tunnelDown(tunnel.name, tunnel.status), level: 'error', type: 'status_change' });
      }
    }
  }

  if (prevMap) {
    for (const prevId of Object.keys(prevMap)) {
      if (!currentTunnelMap[prevId]) {
        notifications.push({ ...L.tunnelGone(prevMap[prevId].name), level: 'warning', type: 'status_change' });
      }
    }
  }

  const allHealthy = Object.values(currentTunnelMap).every(t => t.status === 'active' || t.status === 'healthy');
  const status = active.length === 0 ? 'unknown' : allHealthy ? 'online' : 'warning';

  const state = { tunnels: Object.values(currentTunnelMap) };
  const metrics = {
    total: active.length,
    healthy: active.filter(t => t.status === 'active' || t.status === 'healthy').length,
    tunnels: Object.values(currentTunnelMap),
    statusCode,
  };

  return { status, state, metrics, notifications };
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const tunnels = state?.tunnels || [];
  return L.cloudflareReport(tunnels);
}

module.exports = { check, report };
