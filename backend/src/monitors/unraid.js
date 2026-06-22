const axios = require('axios');
const https = require('https');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');

const QUERY = `query Orveil {
  info {
    os { uptime }
    cpu { brand cores threads }
  }
  array {
    state
    capacity { kilobytes { free used total } }
    disks { name status temp }
  }
  docker {
    containers { names state }
  }
  metrics {
    cpu { percentTotal }
    memory { total active percentTotal }
    temperature { summary { average warningCount criticalCount } }
  }
}`;

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { apiUrl, apiKey, rejectUnauthorized = true, proxy } = config;

  if (!apiUrl || !apiKey) return {
    status: 'error', state: null, metrics: null,
    notifications: [{ ...L.missingConfig('Unraid', 'URL and API key required'), level: 'error', type: 'status_change' }],
  };

  const base = apiUrl.replace(/\/$/, '');

  try {
    const proxyAgents = getProxyAgents(proxy);
    const res = await axios.post(
      `${base}/graphql`,
      { query: QUERY },
      {
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
        timeout: 10000,
        httpsAgent: proxyAgents?.httpsAgent || new https.Agent({ rejectUnauthorized }),
        ...(proxyAgents && { httpAgent: proxyAgents.httpAgent }),
      }
    );

    if (res.data?.errors) {
      throw new Error(res.data.errors[0]?.message || 'GraphQL error');
    }

    const d = res.data?.data || {};
    const info       = d.info     || {};
    const array      = d.array    || {};
    const containers = d.docker?.containers || [];
    const met        = d.metrics  || {};

    const capacity   = array.capacity?.kilobytes || {};
    const disks      = array.disks || [];
    const diskErrors = disks.filter(d => d.status && d.status !== 'DISK_OK' && d.status !== 'DISK_NP').length;

    const diskTotalKB = parseInt(capacity.total) || 0;
    const diskUsedKB  = parseInt(capacity.used)  || 0;
    const diskPct     = diskTotalKB > 0 ? Math.round((diskUsedKB / diskTotalKB) * 100) : 0;

    const cpuPct    = met.cpu?.percentTotal != null ? Math.round(met.cpu.percentTotal) : null;

    const ramBytes  = met.memory?.total || 0;
    const ramTotalGB = ramBytes > 0 ? parseFloat((ramBytes / (1024 ** 3)).toFixed(1)) : null;
    const ramUsedGB  = met.memory?.active != null && ramBytes > 0
      ? parseFloat((met.memory.active / (1024 ** 3)).toFixed(1)) : null;
    const ramPct    = met.memory?.percentTotal != null ? Math.round(met.memory.percentTotal) : null;

    const tempAvg   = met.temperature?.summary?.average != null ? Math.round(met.temperature.summary.average * 10) / 10 : null;
    const tempWarn  = met.temperature?.summary?.warningCount  ?? 0;
    const tempCrit  = met.temperature?.summary?.criticalCount ?? 0;

    const containersRunning = containers.filter(c => c.state === 'RUNNING').length;

    const metrics = {
      arrayState:  array.state || 'UNKNOWN',
      diskTotal:   parseFloat((diskTotalKB / (1024 ** 3)).toFixed(1)),
      diskUsed:    parseFloat((diskUsedKB  / (1024 ** 3)).toFixed(1)),
      diskPct,
      diskCount:   disks.length,
      diskErrors,
      cpuBrand:    info.cpu?.brand  || null,
      cpuCores:    info.cpu?.cores  || null,
      uptime:      info.os?.uptime  || null,
      cpuPct,
      ramTotalGB,
      ramUsedGB,
      ramPct,
      tempAvg,
      tempWarn,
      tempCrit,
      containersRunning,
      containersTotal: containers.length,
    };

    const arrayOk = array.state === 'STARTED';
    const status  = !arrayOk || diskErrors > 0 ? 'warning' : 'online';

    const notifications = [];
    if (lastState) {
      if (diskErrors > 0 && (lastState.diskErrors || 0) === 0) {
        notifications.push({ ...L.unraidDiskError(diskErrors), level: 'error', type: 'status_change' });
      }
      if (!arrayOk && lastState.arrayState === 'STARTED') {
        notifications.push({ ...L.unraidArrayStopped(array.state), level: 'warning', type: 'status_change' });
      }
    }

    return { status, state: metrics, metrics: { ...metrics, statusCode: res.status }, notifications };
  } catch (err) {
    const detail = err.response?.data ? JSON.stringify(err.response.data).slice(0, 300) : '';
    const message = detail ? `${err.message} — ${detail}` : err.message;
    console.error('[unraid]', message);
    return {
      status: 'error', state: lastState, metrics: null,
      notifications: [{ ...L.apiError('Unraid', err.message), level: 'error', type: 'status_change' }],
    };
  }
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  if (!state) return { title: 'Unraid', message: 'No data.' };
  return L.unraidReport(state);
}

module.exports = { check, report };
