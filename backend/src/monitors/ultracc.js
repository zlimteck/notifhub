const axios = require('axios');
const cfHeaders = require('./cfHeaders');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');

const COOLDOWN_MS = 60 * 1000;
const lastCall = {};

function cachedResult(lastState) {
  if (!lastState) return { status: 'unknown', state: null, metrics: null, notifications: [] };
  return {
    status: 'online', state: lastState,
    metrics: {
      total_storage:    lastState.total_storage,
      free_storage:     lastState.free_storage,
      free_pct:         lastState.total_storage > 0 ? Math.round((lastState.free_storage / lastState.total_storage) * 100) : 0,
      traffic_available: lastState.traffic_available,
      traffic_reset:    lastState.traffic_reset,
    },
    notifications: [],
  };
}

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { apiUrl, ultraToken, proxy } = config;

  if (!apiUrl || !ultraToken) {
    return { status: 'error', state: null, metrics: null, notifications: [
      { ...L.missingConfig('Ultra.cc', 'API URL and token required'), level: 'error', type: 'status_change' }
    ]};
  }

  const now = Date.now();
  if (lastCall[apiUrl] && now - lastCall[apiUrl] < COOLDOWN_MS) {
    return cachedResult(lastState);
  }
  lastCall[apiUrl] = now;

  let data;
  try {
    const proxyAgents = getProxyAgents(proxy);
    const http = axios.create({
      timeout: 15000,
      ...(proxyAgents && { httpsAgent: proxyAgents.httpsAgent, httpAgent: proxyAgents.httpAgent }),
    });
    const res = await http.get(apiUrl, {
      headers: { Authorization: ultraToken, ...cfHeaders(config) },
    });
    const info = res.data?.service_stats_info;
    if (!info) throw new Error('Malformed API response');

    data = {
      total_storage:     info.total_storage_value,
      free_storage:      info.free_storage_gb,
      traffic_available: info.traffic_available_percentage,
      traffic_reset:     info.next_traffic_reset,
      statusCode:        res.status,
    };
  } catch (err) {
    if (err.response?.status === 429) {
      console.warn('[Ultra.cc] Rate limit reached — returning cached result');
      lastCall[apiUrl] = now + 60 * 1000;
      return cachedResult(lastState);
    }
    return { status: 'error', state: lastState, metrics: null, notifications: [
      { ...L.apiError('Ultra.cc', err.message), level: 'error', type: 'status_change' }
    ]};
  }

  const notifications = [];
  if (lastState) {
    if (data.free_storage < 50 && lastState.free_storage >= 50) {
      notifications.push({ ...L.ultraccLowStorage(data.free_storage, data.total_storage), level: 'warning', type: 'status_change' });
    }
    if (data.traffic_available < 10 && lastState.traffic_available >= 10) {
      notifications.push({ ...L.ultraccLowTraffic(data.traffic_available, data.traffic_reset), level: 'warning', type: 'status_change' });
    }
  }

  const free_pct = data.total_storage > 0
    ? Math.round((data.free_storage / data.total_storage) * 100)
    : 0;

  const status = data.free_storage < 20 || data.traffic_available < 5 ? 'warning' : 'online';

  return {
    status, state: data,
    metrics: { total_storage: data.total_storage, free_storage: data.free_storage, free_pct, traffic_available: data.traffic_available, traffic_reset: data.traffic_reset, statusCode: data.statusCode },
    notifications,
  };
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  if (!state) return { title: 'Ultra.cc', message: 'No data available.' };
  return L.ultraccReport(state);
}

module.exports = { check, report };
