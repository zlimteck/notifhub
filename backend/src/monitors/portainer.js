const axios = require('axios');
const https = require('https');
const cfHeaders = require('./cfHeaders');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { apiUrl, apiKey, rejectUnauthorized = true, proxy } = config;

  if (!apiUrl || !apiKey) return { status: 'error', state: null, metrics: null, notifications: [
    { ...L.missingConfig('Portainer', 'URL and API key required'), level: 'error', type: 'status_change' }
  ]};

  const base = apiUrl.replace(/\/$/, '');
  const headers = { 'X-API-Key': apiKey, ...cfHeaders(config) };
  const proxyAgents = getProxyAgents(proxy);
  const http = axios.create({
    timeout: 10000,
    httpsAgent: proxyAgents?.httpsAgent || new https.Agent({ rejectUnauthorized }),
    ...(proxyAgents && { httpAgent: proxyAgents.httpAgent }),
    headers,
  });

  const start = Date.now();
  try {
    const endpointsRes = await http.get(`${base}/api/endpoints`, {
      responseType: 'text',
      validateStatus: () => true,
    });
    if (endpointsRes.status === 401 || endpointsRes.status === 403) {
      throw new Error(`${endpointsRes.status} — Invalid or insufficient API key`);
    }
    if (typeof endpointsRes.data === 'string' && endpointsRes.data.trimStart().startsWith('<')) {
      throw new Error(`Invalid URL (HTML received, status ${endpointsRes.status}) — check the Portainer URL`);
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
    const metrics = { environments: endpoints.length, containersRunning, containersStopped, containers: containerList, responseTime, statusCode: endpointsRes.status };
    const status = endpoints.length > 0 ? 'online' : 'warning';

    return { status, state, metrics, notifications: [] };
  } catch (err) {
    return { status: 'error', lastError: err.message, state: lastState, metrics: null, notifications: [
      { ...L.apiError('Portainer', err.message), level: 'error', type: 'status_change' }
    ]};
  }
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  if (!state) return { title: 'Portainer', message: 'No data.' };
  return L.portainerReport(state);
}

module.exports = { check, report };
