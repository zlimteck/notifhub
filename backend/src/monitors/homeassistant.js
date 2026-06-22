const axios = require('axios');
const https = require('https');
const { getProxyAgents } = require('./proxyAgent');
const i18n = require('../i18n');

function makeClient(config) {
  const { token, rejectUnauthorized = true, proxy } = config;
  const proxyAgents = getProxyAgents(proxy);
  const httpsAgent = proxyAgents?.httpsAgent || (rejectUnauthorized ? undefined : new https.Agent({ rejectUnauthorized: false }));
  return axios.create({
    timeout: 10000,
    httpsAgent,
    ...(proxyAgents && { httpAgent: proxyAgents.httpAgent }),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
}

async function check(config, lastState, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  const { url, token, entities = [] } = config;
  if (!url || !token) return {
    status: 'error', state: null, metrics: null, notifications: [
      { ...L.missingConfig('Home Assistant', 'URL and token required'), level: 'error', type: 'status_change' },
    ],
  };

  const wasOnline = lastState !== null;
  const base = url.replace(/\/$/, '');
  const client = makeClient(config);

  try {
    const apiRes = await client.get(`${base}/api/`);
    const version = apiRes.data?.version || null;
    const statusCode = apiRes.status;

    // Fetch selected entity states
    const entityStates = [];
    if (entities.length > 0) {
      const results = await Promise.allSettled(
        entities.map(e => client.get(`${base}/api/states/${e.entity_id}`))
      );
      for (let i = 0; i < entities.length; i++) {
        const r = results[i];
        if (r.status === 'fulfilled') {
          const d = r.value.data;
          entityStates.push({
            entity_id:     d.entity_id,
            friendly_name: d.attributes?.friendly_name || d.entity_id,
            state:         d.state,
            unit:          d.attributes?.unit_of_measurement || null,
          });
        } else {
          entityStates.push({
            entity_id:     entities[i].entity_id,
            friendly_name: entities[i].friendly_name || entities[i].entity_id,
            state:         'unavailable',
            unit:          null,
          });
        }
      }
    }

    // Flatten numeric entity states for graphing
    const flatMetrics = {};
    for (const e of entityStates) {
      const num = parseFloat(e.state);
      if (!isNaN(num)) {
        flatMetrics[`entity__${e.entity_id.replace(/\./g, '__')}`] = num;
      }
    }

    const activeEntities = entityStates.filter(e => e.state !== 'unavailable').length;
    const metrics = { version, entityStates, activeEntities, ...flatMetrics, statusCode };
    const notifications = [];

    if (!wasOnline) {
      notifications.push({ ...L.haOnline(url, version), level: 'success', type: 'status_change' });
    }

    // Alert on entity becoming unavailable
    if (lastState?.entityStates) {
      for (const entity of entityStates) {
        const prev = lastState.entityStates.find(e => e.entity_id === entity.entity_id);
        if (entity.state === 'unavailable' && prev && prev.state !== 'unavailable') {
          notifications.push({ ...L.haEntityUnavailable(entity.friendly_name, entity.entity_id), level: 'warning', type: 'status_change' });
        } else if (entity.state !== 'unavailable' && prev?.state === 'unavailable') {
          notifications.push({ ...L.haEntityRestored(entity.friendly_name, entity.entity_id, entity.state, entity.unit), level: 'success', type: 'status_change' });
        }
      }
    }

    const hasUnavailable = entityStates.some(e => e.state === 'unavailable');
    return { status: hasUnavailable ? 'warning' : 'online', state: metrics, metrics, notifications };
  } catch (err) {
    const notifications = wasOnline ? [{ ...L.haUnreachable(url, err.message), level: 'error', type: 'status_change' }] : [];
    return { status: 'offline', state: null, metrics: null, notifications };
  }
}

async function report(config, state, lang = 'fr') {
  const L = i18n[lang] || i18n.fr;
  if (!state) return { title: 'Home Assistant', message: 'Unreachable.' };
  return L.haReport(state);
}

module.exports = { check, report };
