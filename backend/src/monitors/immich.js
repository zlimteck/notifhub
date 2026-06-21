const axios = require('axios');
const https = require('https');
const cfHeaders = require('./cfHeaders');

async function check(config, lastState) {
  const { apiUrl, apiKey, rejectUnauthorized = true } = config;

  if (!apiUrl || !apiKey) return { status: 'error', state: null, metrics: null, notifications: [
    { title: 'Config manquante — Immich', message: 'URL et clé API requises', level: 'error', type: 'status_change' }
  ]};

  const base = apiUrl.replace(/\/$/, '');
  const http = axios.create({
    timeout: 10000,
    httpsAgent: new https.Agent({ rejectUnauthorized }),
    headers: { 'x-api-key': apiKey, ...cfHeaders(config) },
  });

  const start = Date.now();
  try {
    const [statsRes, storageRes] = await Promise.all([
      http.get(`${base}/api/server/statistics`),
      http.get(`${base}/api/server/storage`),
    ]);
    const responseTime = Date.now() - start;

    const stats = statsRes.data;
    const storage = storageRes.data;

    const diskUsed = storage.diskUseRaw ?? 0;
    const diskTotal = storage.diskSizeRaw ?? 0;
    const diskPct = diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 100) : 0;

    const notifications = [];
    if (lastState && diskPct > 90 && (lastState.diskPct ?? 0) <= 90) {
      notifications.push({
        title: 'Stockage Immich critique',
        message: `Disque à ${diskPct}% — ${storage.diskUse} utilisés / ${storage.diskSize}`,
        level: 'warning', type: 'status_change',
      });
    }

    const state = { photos: stats.photos, videos: stats.videos, diskPct };
    const metrics = {
      photos: stats.photos,
      videos: stats.videos,
      diskUse: storage.diskUse,
      diskSize: storage.diskSize,
      diskPct,
      responseTime,
    };

    return { status: 'online', state, metrics, notifications };
  } catch (err) {
    return { status: 'error', lastError: err.message, state: lastState, metrics: null, notifications: [
      { title: 'Immich — Erreur API', message: err.message, level: 'error', type: 'status_change' }
    ]};
  }
}

async function report(config, state) {
  if (!state) return { title: 'Immich', message: 'Aucune donnée.' };
  return {
    title: 'Rapport Immich',
    message: `Photos : ${state.photos}\nVidéos : ${state.videos}\nDisque : ${state.diskPct}%`,
  };
}

module.exports = { check, report };
