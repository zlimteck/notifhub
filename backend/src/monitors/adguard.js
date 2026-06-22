const axios = require('axios');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');

const BASE = 'https://api.adguard-dns.io/oapi/v1';

function makeHttp(proxy) {
  const proxyAgents = getProxyAgents(proxy);
  return axios.create({
    timeout: 10000,
    ...(proxyAgents && { httpsAgent: proxyAgents.httpsAgent, httpAgent: proxyAgents.httpAgent }),
  });
}

async function refreshToken(refreshTok, http) {
  const res = await http.post(`${BASE}/oauth_token`,
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshTok }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return { accessToken: res.data.access_token, refreshToken: res.data.refresh_token };
}

async function fetchData(accessToken, http) {
  const [srv, acc] = await Promise.all([
    http.get(`${BASE}/dns_servers`, { headers: { Authorization: `Bearer ${accessToken}` } }),
    http.get(`${BASE}/account/limits`, { headers: { Authorization: `Bearer ${accessToken}` } }),
  ]);
  const statusCode = srv.status;
  const server = srv.data[0];
  const account = acc.data;
  return {
    server_name: server.name,
    protection_enabled: server.settings.protection_enabled,
    user_rules_count: server.settings.user_rules_settings.rules_count,
    filter_list_count: server.settings.filter_lists_settings.filter_list.length,
    devices: server.device_ids.length,
    used_requests: account.requests.used,
    limit_requests: account.requests.limit,
    statusCode,
  };
}

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  let { accessToken, refreshTok, proxy } = config;
  if (!accessToken && !refreshTok) {
    return { status: 'error', state: null, metrics: null, configUpdate: null, notifications: [
      { ...L.missingConfig('AdGuard', 'Access token or refresh token required'), level: 'error', type: 'status_change' }
    ]};
  }

  const http = makeHttp(proxy);
  let data;
  let configUpdate = null;

  try {
    data = await fetchData(accessToken, http);
  } catch (err) {
    if (err.response?.status === 401 && refreshTok) {
      try {
        const tokens = await refreshToken(refreshTok, http);
        accessToken = tokens.accessToken;
        configUpdate = { accessToken: tokens.accessToken, refreshTok: tokens.refreshToken };
        data = await fetchData(accessToken, http);
      } catch (e) {
        return { status: 'error', state: null, metrics: null, configUpdate: null, notifications: [
          { ...L.adguardInvalidToken(e.message), level: 'error', type: 'status_change' }
        ]};
      }
    } else {
      return { status: 'error', state: lastState, metrics: null, configUpdate: null, notifications: [
        { ...L.apiError('AdGuard', err.message), level: 'error', type: 'status_change' }
      ]};
    }
  }

  const notifications = [];

  if (lastState !== null) {
    if (!data.protection_enabled && lastState.protection_enabled) {
      notifications.push({ ...L.adguardProtectionDisabled(data.server_name), level: 'warning', type: 'status_change' });
    } else if (data.protection_enabled && lastState.protection_enabled === false) {
      notifications.push({ ...L.adguardProtectionEnabled(data.server_name), level: 'success', type: 'status_change' });
    }
  }

  const status = data.protection_enabled ? 'online' : 'warning';
  const metrics = {
    protection: data.protection_enabled,
    devices: data.devices,
    used_requests: data.used_requests,
    limit_requests: data.limit_requests,
    pct_requests: Math.round((data.used_requests / data.limit_requests) * 100),
    statusCode: data.statusCode,
  };

  return { status, state: data, metrics, configUpdate, notifications };
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  if (!state) return { title: 'AdGuard DNS', message: 'No data available.' };
  return L.adguardReport(state);
}

module.exports = { check, report };
