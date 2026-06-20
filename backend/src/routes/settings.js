const router = require('express').Router();
const Settings = require('../models/Settings');
const Monitor = require('../models/Monitor');
const { sendNotification } = require('../services/notifier');
const { encryptConfig, decryptConfig } = require('../utils/crypto');

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
  res.json(s);
});

router.put('/', async (req, res) => {
  const { appriseUrls, appriseApiUrl, weeklyReport, showGraphs, statusPage } = req.body;
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
