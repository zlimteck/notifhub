const router = require('express').Router();
const Settings = require('../models/Settings');
const { sendNotification } = require('../services/notifier');

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
  if (statusPage !== undefined) update['statusPage.title'] = statusPage.title ?? '';
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

router.post('/test', async (req, res) => {
  try {
    const sent = await sendNotification({
      title: '✅ Test NotifHub',
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
