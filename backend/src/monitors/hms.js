const axios = require('axios');
const cfHeaders = require('./cfHeaders');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');

async function fetchVps(hmsToken, vpsId, vpsName, extraHeaders = {}, proxy = null) {
  const auth = hmsToken.startsWith('Bearer ') ? hmsToken : `Bearer ${hmsToken}`;
  const headers = { Authorization: auth, ...extraHeaders };
  const proxyAgents = getProxyAgents(proxy);
  const http = axios.create({
    timeout: 10000,
    ...(proxyAgents && { httpsAgent: proxyAgents.httpsAgent, httpAgent: proxyAgents.httpAgent }),
  });

  const infoRes = await http.get(`https://www.hostmyservers.fr/api/cloud/${vpsId}`, { headers });
  const info = infoRes.data?.data;
  if (!info) throw new Error(`Info not found for VPS ${vpsName}`);

  return {
    id: vpsId,
    statusCode: infoRes.status,
    name: vpsName || info.hostname,
    hostname: info.hostname,
    ipv4: info.ipv4 || null,
    ipv6: info.ipv6 || null,
    state: info.state,
    os: info.system?.os_short || null,
    datacenter: info.model?.datacenter || null,
    vcores: info.model?.vcore || null,
    disk_gb: info.model?.disk || null,
    ram_gb: info.model?.memory || null,
    expired_at: info.expired_at || null,
  };
}

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { hmsToken, vpsList, proxy } = config;

  if (!hmsToken || !vpsList?.length) {
    return { status: 'error', state: null, metrics: null, notifications: [
      { ...L.missingConfig('HMS', 'HMS Token and at least one VPS required'), level: 'error', type: 'status_change' }
    ]};
  }

  const results = [];
  const errors = [];

  for (const vps of vpsList) {
    try {
      const data = await fetchVps(hmsToken, vps.id, vps.name, cfHeaders(config), proxy);
      results.push(data);
    } catch (err) {
      console.error(`[HMS] VPS error ${vps.name || vps.id}:`, err.message);
      errors.push({ id: vps.id, name: vps.name, error: err.message });
    }
  }

  const notifications = [];
  const prevMap = lastState?.vps
    ? Object.fromEntries(lastState.vps.map(v => [v.id, v]))
    : null;

  if (prevMap) {
    for (const vps of results) {
      const prev = prevMap[vps.id];
      if (prev) {
        if (vps.cpu > 90 && prev.cpu <= 90) {
          notifications.push({ ...L.hmsHighCpu(vps.name, vps.ipv4 || vps.id, vps.cpu), level: 'warning', type: 'status_change' });
        }
        if (vps.memory_pct > 90 && prev.memory_pct <= 90) {
          notifications.push({ ...L.hmsHighMemory(vps.name, vps.memory_used, vps.max_memory, vps.memory_pct), level: 'warning', type: 'status_change' });
        }
      }
    }
    for (const err of errors) {
      const prev = prevMap[err.id];
      if (prev && !prev.error) {
        notifications.push({ ...L.hmsVpsUnreachable(err.name, err.error), level: 'error', type: 'status_change' });
      }
    }
  }

  const status = errors.length === vpsList.length ? 'error'
    : errors.length > 0 ? 'warning'
    : 'online';

  const state = { vps: results, errors };
  const metrics = {
    vps_count: results.length,
    avg_cpu: results.length ? Math.round(results.reduce((s, v) => s + v.cpu, 0) / results.length) : 0,
    avg_memory_pct: results.length ? Math.round(results.reduce((s, v) => s + v.memory_pct, 0) / results.length) : 0,
    vps: results,
    statusCode: results[0]?.statusCode ?? null,
  };

  return { status, state, metrics, notifications };
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const vpsList = state?.vps || [];
  return L.hmsReport(vpsList, state?.errors);
}

module.exports = { check, report };
