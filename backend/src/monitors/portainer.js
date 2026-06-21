const axios = require('axios');
const https = require('https');
const cfHeaders = require('./cfHeaders');

async function check(config, lastState) {
  const { apiUrl, apiKey, rejectUnauthorized = true } = config;

  if (!apiUrl || !apiKey) return { status: 'error', state: null, metrics: null, notifications: [
    { title: 'Config manquante — Portainer', message: 'URL et clé API requises', level: 'error', type: 'status_change' }
  ]};

  const base = apiUrl.replace(/\/$/, '');
  const headers = { 'X-API-Key': apiKey, ...cfHeaders(config) };

  const http = axios.create({
    timeout: 10000,
    httpsAgent: new https.Agent({ rejectUnauthorized }),
    headers,
  });

  const start = Date.now();
  try {
    const endpointsRes = await http.get(`${base}/api/endpoints`, {
      responseType: 'text',
      validateStatus: () => true,
    });
    if (endpointsRes.status === 401 || endpointsRes.status === 403) {
      throw new Error(`${endpointsRes.status} — Clé API invalide ou insuffisante`);
    }
    if (typeof endpointsRes.data === 'string' && endpointsRes.data.trimStart().startsWith('<')) {
throw new Error(`URL incorrecte (HTML reçu, status ${endpointsRes.status}) — vérifiez l'URL Portainer`);
    }
    if (endpointsRes.status >= 400) {
      throw new Error(`HTTP ${endpointsRes.status} — ${endpointsRes.data?.toString().slice(0, 100)}`);
    }
    const parsed = typeof endpointsRes.data === 'string' ? JSON.parse(endpointsRes.data) : endpointsRes.data;
    const endpoints = Array.isArray(parsed) ? parsed : (parsed?.value || []);

    let containersRunning = 0;
    let containersStopped = 0;
    const containerList = [];

    for (const ep of endpoints.slice(0, 5)) {
      const epId = ep.Id ?? ep.id;
      const epName = ep.Name ?? ep.name ?? `env-${epId}`;
      try {
        const res = await http.get(`${base}/api/endpoints/${epId}/docker/containers/json`, {
          params: { all: true },
        });
        let containers = res.data;
        // Portainer peut retourner { value: [...] } ou un tableau direct
        if (!Array.isArray(containers)) containers = containers?.value || [];

        for (const c of containers) {
          const state = c.State ?? c.status ?? 'unknown';
          const name  = (c.Names?.[0] ?? c.name ?? '').replace(/^\//, '') || c.Id?.slice(0, 12) || '?';
          if (state === 'running') containersRunning++;
          else containersStopped++;
          containerList.push({ name, state, env: epName });
        }
        console.log(`[Portainer] env=${epName} — ${containers.length} containers`);
      } catch (err) {
        console.warn(`[Portainer] env=${epName} containers error:`, err.message);
      }
    }

    const responseTime = Date.now() - start;
    const state = { environments: endpoints.length, containersRunning, containersStopped, containers: containerList };
    const metrics = { environments: endpoints.length, containersRunning, containersStopped, containers: containerList, responseTime };
    const status = endpoints.length > 0 ? 'online' : 'warning';

    return { status, state, metrics, notifications: [] };
  } catch (err) {
    return { status: 'error', lastError: err.message, state: lastState, metrics: null, notifications: [
      { title: 'Portainer — Erreur API', message: err.message, level: 'error', type: 'status_change' }
    ]};
  }
}

async function report(config, state) {
  if (!state) return { title: 'Portainer', message: 'Aucune donnée.' };
  return {
    title: 'Rapport Portainer',
    message: `Environnements : ${state.environments}\nContainers actifs : ${state.containersRunning}\nArrêtés : ${state.containersStopped}`,
  };
}

module.exports = { check, report };
