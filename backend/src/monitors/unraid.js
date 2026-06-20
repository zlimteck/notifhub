const axios = require('axios');
const https = require('https');

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

async function check(config, lastState) {
  const { apiUrl, apiKey, rejectUnauthorized = true } = config;

  if (!apiUrl || !apiKey) return {
    status: 'error', state: null, metrics: null,
    notifications: [{ title: 'Config manquante — Unraid', message: 'URL et clé API requises', level: 'error', type: 'error' }],
  };

  const base = apiUrl.replace(/\/$/, '');

  try {
    const res = await axios.post(
      `${base}/graphql`,
      { query: QUERY },
      {
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
        timeout: 10000,
        httpsAgent: new https.Agent({ rejectUnauthorized }),
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
        notifications.push({
          title: 'Unraid — Erreur disque',
          message: `${diskErrors} disque(s) en erreur dans l'array`,
          level: 'error', type: 'status_change',
        });
      }
      if (!arrayOk && lastState.arrayState === 'STARTED') {
        notifications.push({
          title: 'Unraid — Array arrêté',
          message: `État de l'array : ${array.state}`,
          level: 'warning', type: 'status_change',
        });
      }
    }

    return { status, state: metrics, metrics, notifications };
  } catch (err) {
    const detail = err.response?.data ? JSON.stringify(err.response.data).slice(0, 300) : '';
    const message = detail ? `${err.message} — ${detail}` : err.message;
    console.error('[unraid]', message);
    return {
      status: 'error', state: lastState, metrics: null,
      notifications: [{ title: 'Unraid — Erreur API', message: err.message, level: 'error', type: 'error' }],
    };
  }
}

async function report(config, state) {
  if (!state) return { title: 'Unraid', message: 'Aucune donnée.' };
  const lines = [
    `Array : ${state.arrayState}`,
    `Disques : ${state.diskCount}${state.diskErrors > 0 ? ` (${state.diskErrors} en erreur)` : ''}`,
    `Stockage : ${state.diskUsed} / ${state.diskTotal} TB (${state.diskPct}%)`,
  ];
  if (state.cpuPct != null) lines.push(`CPU : ${state.cpuPct}%`);
  if (state.ramPct != null) lines.push(`RAM : ${state.ramUsedGB} / ${state.ramTotalGB} GB (${state.ramPct}%)`);
  if (state.tempAvg != null) lines.push(`Temp moy : ${state.tempAvg}°C${state.tempWarn > 0 ? ` ${state.tempWarn} warn` : ''}${state.tempCrit > 0 ? ` ${state.tempCrit} crit` : ''}`);
  lines.push(`Containers : ${state.containersRunning} actifs`);
  return { title: 'Rapport Unraid', message: lines.join('\n') };
}

module.exports = { check, report };
