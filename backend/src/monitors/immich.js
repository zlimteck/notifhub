const axios = require('axios');
const https = require('https');
const cfHeaders = require('./cfHeaders');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { apiUrl, apiKey, rejectUnauthorized = true, proxy } = config;

  if (!apiUrl || !apiKey) return { status: 'error', state: null, metrics: null, notifications: [
    { ...L.missingConfig('Immich', 'URL and API key required'), level: 'error', type: 'status_change' }
  ]};

  const base = apiUrl.replace(/\/$/, '');
  const proxyAgents = getProxyAgents(proxy);
  const http = axios.create({
    timeout: 10000,
    httpsAgent: proxyAgents?.httpsAgent || new https.Agent({ rejectUnauthorized }),
    ...(proxyAgents && { httpAgent: proxyAgents.httpAgent }),
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
      notifications.push({ ...L.immichStorageCritical(diskPct, storage.diskUse, storage.diskSize), level: 'warning', type: 'status_change' });
    }

    const state = { photos: stats.photos, videos: stats.videos, diskPct };
    const metrics = {
      photos: stats.photos,
      videos: stats.videos,
      diskUse: storage.diskUse,
      diskSize: storage.diskSize,
      diskPct,
      responseTime,
      statusCode: statsRes.status,
    };

    return { status: 'online', state, metrics, notifications };
  } catch (err) {
    return { status: 'error', lastError: err.message, state: lastState, metrics: null, notifications: [
      { ...L.apiError('Immich', err.message), level: 'error', type: 'status_change' }
    ]};
  }
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  if (!state) return { title: 'Immich', message: 'No data.' };
  return L.immichReport(state);
}

module.exports = { check, report };
