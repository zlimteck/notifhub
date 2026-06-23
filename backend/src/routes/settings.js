const router = require('express').Router();
const axios = require('axios');
const Settings = require('../models/Settings');
const Monitor = require('../models/Monitor');
const { sendNotification } = require('../services/notifier');
const { encryptConfig, decryptConfig } = require('../utils/crypto');
const { getProxyAgents } = require('../monitors/proxyAgent');

router.get('/', async (req, res) => {
  let s = await Settings.findOneAndUpdate(
    { key: 'global' },
    { $setOnInsert: { key: 'global' } },
    { upsert: true, new: true }
  );
  if (!s.mcpApiKey) {
    const mcpApiKey = require('crypto').randomBytes(24).toString('hex');
    s = await Settings.findOneAndUpdate({ key: 'global' }, { $set: { mcpApiKey } }, { new: true });
  }
  // Migrate legacy defaultProxy → proxies
  if (s.defaultProxy && (!s.proxies || s.proxies.length === 0)) {
    const migrated = { ...decryptConfig(s.defaultProxy), name: 'Proxy par défaut', active: !!s.defaultProxy.enabled };
    delete migrated.enabled;
    s = await Settings.findOneAndUpdate(
      { key: 'global' },
      { $set: { proxies: [encryptConfig(migrated)] }, $unset: { defaultProxy: '' } },
      { new: true }
    );
  }
  const obj = s.toObject();
  obj.proxies = (obj.proxies || []).map(p => decryptConfig(p));
  delete obj.defaultProxy;
  res.json(obj);
});

router.put('/', async (req, res) => {
  const { appriseUrls, appriseApiUrl, weeklyReport, showGraphs, statusPage, notificationLanguage, adaptivePolling, notificationCooldown } = req.body;
  const update = { appriseUrls, appriseApiUrl };
  if (weeklyReport !== undefined) {
    update['weeklyReport.enabled']   = weeklyReport.enabled   ?? false;
    update['weeklyReport.dayOfWeek'] = weeklyReport.dayOfWeek ?? 1;
    update['weeklyReport.hour']      = weeklyReport.hour      ?? 8;
  }
  if (showGraphs !== undefined) update.showGraphs = showGraphs;
  if (statusPage !== undefined) {
    update['statusPage.title']       = statusPage.title       ?? '';
    update['statusPage.description'] = statusPage.description ?? '';
    update['statusPage.logoUrl']     = statusPage.logoUrl     ?? '';
    update['statusPage.accentColor'] = statusPage.accentColor ?? '';
    update['statusPage.footerText']  = statusPage.footerText  ?? '';
  }
  if (notificationLanguage !== undefined) update.notificationLanguage = notificationLanguage;
  if (adaptivePolling !== undefined) {
    update['adaptivePolling.enabled']       = adaptivePolling.enabled       ?? true;
    update['adaptivePolling.errorInterval'] = adaptivePolling.errorInterval ?? 30;
  }
  if (notificationCooldown !== undefined) update.notificationCooldown = notificationCooldown;
  const s = await Settings.findOneAndUpdate(
    { key: 'global' },
    update,
    { upsert: true, new: true }
  );
  res.json(s);
});

router.post('/mcp/regenerate', async (req, res) => {
  const mcpApiKey = require('crypto').randomBytes(24).toString('hex');
  const s = await Settings.findOneAndUpdate(
    { key: 'global' },
    { mcpApiKey },
    { upsert: true, new: true }
  );
  res.json({ mcpApiKey: s.mcpApiKey });
});

router.get('/export', async (req, res) => {
  const [monitors, settings] = await Promise.all([
    Monitor.find({}),
    Settings.findOne({ key: 'global' }).lean(),
  ]);

  const safeMonitors = monitors.map(m => {
    const obj = m.toObject(); // triggers post('init') decrypt
    const { _id, __v, createdAt, updatedAt, lastChecked, lastReported,
            lastState, metrics, status, lastError, lastDownAt, lastDownNotified, ...rest } = obj;
    return { ...rest, dependsOn: [] }; // clear dependsOn — IDs won't match on another instance
  });

  const { mcpApiKey, _id, __v, key, ...safeSettings } = settings || {};

  res.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: safeSettings,
    monitors: safeMonitors,
  });
});

router.post('/import', async (req, res) => {
  const { monitors: importMonitors = [], settings: importSettings } = req.body;
  if (!Array.isArray(importMonitors)) return res.status(400).json({ error: 'monitors doit être un tableau' });

  let created = 0, updated = 0;

  for (const m of importMonitors) {
    const { _id, dependsOn, ...data } = m;
    data.dependsOn = [];
    data.config = encryptConfig(data.config || {});
    const existing = await Monitor.findOne({ name: m.name });
    if (existing) {
      await Monitor.findByIdAndUpdate(existing._id, { ...data, lastChecked: null });
      updated++;
    } else {
      await Monitor.create({ ...data, status: 'unknown', lastChecked: null });
      created++;
    }
  }

  if (importSettings) {
    const { appriseUrls, appriseApiUrl, weeklyReport, showGraphs, statusPage } = importSettings;
    const update = {};
    if (appriseUrls   !== undefined) update.appriseUrls   = appriseUrls;
    if (appriseApiUrl !== undefined) update.appriseApiUrl = appriseApiUrl;
    if (showGraphs    !== undefined) update.showGraphs    = showGraphs;
    if (weeklyReport  !== undefined) {
      update['weeklyReport.enabled']   = weeklyReport.enabled   ?? false;
      update['weeklyReport.dayOfWeek'] = weeklyReport.dayOfWeek ?? 1;
      update['weeklyReport.hour']      = weeklyReport.hour      ?? 8;
    }
    if (statusPage !== undefined) {
      update['statusPage.title']       = statusPage.title       ?? '';
      update['statusPage.description'] = statusPage.description ?? '';
      update['statusPage.logoUrl']     = statusPage.logoUrl     ?? '';
      update['statusPage.accentColor'] = statusPage.accentColor ?? '';
      update['statusPage.footerText']  = statusPage.footerText  ?? '';
    }
    await Settings.findOneAndUpdate({ key: 'global' }, update, { upsert: true });
  }

  res.json({ ok: true, created, updated });
});

// ── Proxy CRUD ────────────────────────────────────────────────────────────────

router.post('/proxies', async (req, res) => {
  const { name, type, host, port, username, password, privateKey } = req.body;
  const proxy = encryptConfig({ name: name || 'Proxy', active: false, type: type || 'http', host: host || '', port, username: username || '', password: password || '', privateKey: privateKey || '' });
  const s = await Settings.findOneAndUpdate(
    { key: 'global' },
    { $push: { proxies: proxy } },
    { upsert: true, new: true }
  );
  const created = s.proxies[s.proxies.length - 1];
  res.json(decryptConfig(created.toObject()));
});

router.put('/proxies/:id', async (req, res) => {
  const { name, type, host, port, username, password, privateKey } = req.body;
  const update = encryptConfig({ name, type, host, port, username: username || '', password: password || '', privateKey: privateKey || '' });
  const s = await Settings.findOneAndUpdate(
    { key: 'global', 'proxies._id': req.params.id },
    {
      $set: {
        'proxies.$.name':       update.name,
        'proxies.$.type':       update.type,
        'proxies.$.host':       update.host,
        'proxies.$.port':       update.port,
        'proxies.$.username':   update.username,
        'proxies.$.password':   update.password,
        'proxies.$.privateKey': update.privateKey,
      },
    },
    { new: true }
  );
  if (!s) return res.status(404).json({ error: 'Not found' });
  const updated = s.proxies.id(req.params.id);
  res.json(decryptConfig(updated.toObject()));
});

router.delete('/proxies/:id', async (req, res) => {
  await Settings.findOneAndUpdate(
    { key: 'global' },
    { $pull: { proxies: { _id: req.params.id } } }
  );
  res.json({ ok: true });
});

router.patch('/proxies/:id/activate', async (req, res) => {
  const s = await Settings.findOne({ key: 'global' });
  if (!s) return res.status(404).json({ error: 'Not found' });
  const target = s.proxies.id(req.params.id);
  if (!target) return res.status(404).json({ error: 'Proxy not found' });
  const newActive = !target.active;
  // Deactivate all, then set target
  for (const p of s.proxies) p.active = false;
  target.active = newActive;
  await s.save();
  res.json({ ok: true, active: newActive });
});

// ── Proxy test ────────────────────────────────────────────────────────────────

router.post('/proxy/test', async (req, res) => {
  const { proxy } = req.body;
  if (!proxy?.host) {
    return res.status(400).json({ error: 'Proxy config incomplete' });
  }
  if (proxy.type !== 'ssh' && !proxy.port) {
    return res.status(400).json({ error: 'Proxy config incomplete' });
  }
  try {
    const proxyAgents = getProxyAgents(proxy);
    const start = Date.now();
    await axios.get('https://cloudflare.com', {
      httpsAgent: proxyAgents.httpsAgent,
      httpAgent: proxyAgents.httpAgent,
      timeout: 10000,
      validateStatus: () => true,
      maxRedirects: 3,
    });
    res.json({ ok: true, ms: Date.now() - start });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

router.post('/test', async (req, res) => {
  try {
    const sent = await sendNotification({
      title: 'Test Orveil',
      message: 'La notification de test a bien été reçue !',
      level: 'info',
      type: 'test',
    });
    res.json({ sent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
