const axios = require('axios');
const https = require('https');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { apiUrl, apiKey, rejectUnauthorized = true, proxy } = config;

  if (!apiUrl || !apiKey) return { status: 'error', state: null, metrics: null, notifications: [
    { ...L.missingConfig('Jellyfin', 'URL and API key required'), level: 'error', type: 'status_change' },
  ]};

  const base = apiUrl.replace(/\/$/, '');
  const proxyAgents = getProxyAgents(proxy);
  const http = axios.create({
    timeout: 10000,
    httpsAgent: proxyAgents?.httpsAgent || new https.Agent({ rejectUnauthorized }),
    ...(proxyAgents && { httpAgent: proxyAgents.httpAgent }),
    headers: { 'X-Emby-Token': apiKey },
  });

  const start = Date.now();
  try {
    const [infoRes, sessionsRes, countsRes] = await Promise.all([
      http.get(`${base}/System/Info`),
      http.get(`${base}/Sessions`),
      http.get(`${base}/Items/Counts`),
    ]);
    const responseTime = Date.now() - start;

    const info     = infoRes.data;
    const sessions = sessionsRes.data;
    const counts   = countsRes.data;

    const activeSessions = sessions.filter(s => s.NowPlayingItem).length;
    const movies  = counts.MovieCount  ?? 0;
    const series  = counts.SeriesCount ?? 0;
    const songs   = counts.SongCount   ?? 0;
    const version = info.Version       ?? '';

    const state   = { activeSessions, movies, series, songs, version };
    const metrics = { activeSessions, movies, series, songs, version, serverName: info.ServerName ?? '', responseTime, statusCode: infoRes.status };

    return { status: 'online', state, metrics, notifications: [] };
  } catch (err) {
    return {
      status: 'error', lastError: err.message, state: lastState, metrics: null,
      notifications: [{ ...L.apiError('Jellyfin', err.message), level: 'error', type: 'status_change' }],
    };
  }
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  if (!state) return { title: 'Jellyfin', message: 'No data.' };
  return L.jellyfinReport(state);
}

module.exports = { check, report };
