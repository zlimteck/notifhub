const axios = require('axios');
const https = require('https');
const cfHeaders = require('./cfHeaders');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { apiUrl, rejectUnauthorized = true, proxy } = config;

  if (!apiUrl) return {
    status: 'error', state: null, metrics: null,
    lastError: 'URL required',
    notifications: [{ ...L.missingConfig('Ollama', 'URL required'), level: 'error', type: 'status_change' }],
  };

  const base = apiUrl.replace(/\/$/, '');
  const proxyAgents = getProxyAgents(proxy);
  const http = axios.create({
    timeout: 10000,
    httpsAgent: proxyAgents?.httpsAgent || new https.Agent({ rejectUnauthorized }),
    ...(proxyAgents && { httpAgent: proxyAgents.httpAgent }),
    headers: { ...cfHeaders(config) },
  });

  const start = Date.now();
  try {
    const [versionRes, tagsRes] = await Promise.all([
      http.get(`${base}/api/version`),
      http.get(`${base}/api/tags`),
    ]);

    const responseTime = Date.now() - start;
    const version = versionRes.data?.version || null;
    const models = tagsRes.data?.models || [];
    const modelsCount = models.length;
    const modelNames = models.map(m => m.name).slice(0, 10);

    return {
      status: 'online',
      lastError: null,
      state: { version, modelsCount, modelNames, responseTime },
      metrics: { version, modelsCount, responseTime, statusCode: versionRes.status },
      notifications: [],
    };
  } catch (err) {
    return {
      status: 'offline',
      lastError: err.message,
      state: null,
      metrics: null,
      notifications: [{ ...L.unreachable('Ollama', '', err.message), level: 'error', type: 'status_change' }],
    };
  }
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  if (!state) return { title: 'Ollama', message: 'No data.' };
  return L.ollamaReport(state);
}

module.exports = { check, report };
