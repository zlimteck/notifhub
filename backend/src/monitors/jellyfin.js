const axios = require('axios');
const https = require('https');

async function check(config, lastState) {
  const { apiUrl, apiKey, rejectUnauthorized = true } = config;

  if (!apiUrl || !apiKey) return { status: 'error', state: null, metrics: null, notifications: [
    { title: 'Config manquante — Jellyfin', message: 'URL et clé API requises', level: 'error', type: 'error' },
  ]};

  const base = apiUrl.replace(/\/$/, '');
  const http = axios.create({
    timeout: 10000,
    httpsAgent: new https.Agent({ rejectUnauthorized }),
    headers: { 'X-Emby-Token': apiKey },
  });

  try {
    const [infoRes, sessionsRes, countsRes] = await Promise.all([
      http.get(`${base}/System/Info`),
      http.get(`${base}/Sessions`),
      http.get(`${base}/Items/Counts`),
    ]);

    const info     = infoRes.data;
    const sessions = sessionsRes.data;
    const counts   = countsRes.data;

    const activeSessions = sessions.filter(s => s.NowPlayingItem).length;
    const movies  = counts.MovieCount  ?? 0;
    const series  = counts.SeriesCount ?? 0;
    const songs   = counts.SongCount   ?? 0;
    const version = info.Version       ?? '';

    const state   = { activeSessions, movies, series, songs, version };
    const metrics = { activeSessions, movies, series, songs, version, serverName: info.ServerName ?? '' };

    return { status: 'online', state, metrics, notifications: [] };
  } catch (err) {
    return {
      status: 'error', state: lastState, metrics: null,
      notifications: [{ title: 'Jellyfin — Erreur API', message: err.message, level: 'error', type: 'error' }],
    };
  }
}

async function report(config, state) {
  if (!state) return { title: 'Jellyfin', message: 'Aucune donnée.' };
  return {
    title: 'Rapport Jellyfin',
    message: `Sessions actives : ${state.activeSessions}\nFilms : ${state.movies} | Séries : ${state.series} | Musiques : ${state.songs}\nVersion : ${state.version}`,
  };
}

module.exports = { check, report };
