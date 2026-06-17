const axios = require('axios');
const cfHeaders = require('./cfHeaders');

const http = axios.create({ timeout: 15000 });

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

async function check(config, lastState) {
  const { apiUrl, ultraToken } = config;

  if (!apiUrl || !ultraToken) {
    return { status: 'error', state: null, metrics: null, notifications: [
      { title: 'Config manquante — Ultra.cc', message: 'URL API et token requis', level: 'error', type: 'error' }
    ]};
  }

  const now = Date.now();
  if (lastCall[apiUrl] && now - lastCall[apiUrl] < COOLDOWN_MS) {
    return cachedResult(lastState);
  }
  lastCall[apiUrl] = now;

  let data;
  try {
    const res = await http.get(apiUrl, {
      headers: { Authorization: ultraToken, ...cfHeaders(config) },
    });
    const info = res.data?.service_stats_info;
    if (!info) throw new Error('Réponse API mal formatée');

    data = {
      total_storage:     info.total_storage_value,
      free_storage:      info.free_storage_gb,
      traffic_available: info.traffic_available_percentage,
      traffic_reset:     info.next_traffic_reset,
    };
  } catch (err) {
    if (err.response?.status === 429) {
      console.warn('[Ultra.cc] Rate limit atteint — retour du cache');
      lastCall[apiUrl] = now + 60 * 1000;
      return cachedResult(lastState);
    }
    return { status: 'error', state: lastState, metrics: null, notifications: [
      { title: 'Ultra.cc — Erreur API', message: err.message, level: 'error', type: 'error' }
    ]};
  }

  const notifications = [];
  if (lastState) {
    if (data.free_storage < 50 && lastState.free_storage >= 50) {
      notifications.push({
        title: 'Stockage bas — Ultra.cc',
        message: `Espace libre : ${data.free_storage} GB sur ${data.total_storage} GB`,
        level: 'warning', type: 'status_change',
      });
    }
    if (data.traffic_available < 10 && lastState.traffic_available >= 10) {
      notifications.push({
        title: 'Trafic bas — Ultra.cc',
        message: `Trafic disponible : ${data.traffic_available}% — Reset : ${data.traffic_reset}`,
        level: 'warning', type: 'status_change',
      });
    }
  }

  const free_pct = data.total_storage > 0
    ? Math.round((data.free_storage / data.total_storage) * 100)
    : 0;

  const status = data.free_storage < 20 || data.traffic_available < 5 ? 'warning' : 'online';

  return {
    status, state: data,
    metrics: { total_storage: data.total_storage, free_storage: data.free_storage, free_pct, traffic_available: data.traffic_available, traffic_reset: data.traffic_reset },
    notifications,
  };
}

async function report(config, state) {
  if (!state) return { title: 'Ultra.cc', message: 'Aucune donnée disponible.' };
  return {
    title: 'Rapport Ultra.cc',
    message: `Stockage : ${state.free_storage} GB libres / ${state.total_storage} GB\nTrafic disponible : ${state.traffic_available}%\nReset trafic : ${state.traffic_reset}`,
  };
}

module.exports = { check, report };
