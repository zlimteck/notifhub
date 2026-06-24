const router = require('express').Router();
const crypto = require('crypto');
const Monitor = require('../models/Monitor');
const Changelog = require('../models/Changelog');

// POST /api/webhook/changelog
// Public — authenticated by webhookToken in body
router.post('/changelog', async (req, res) => {
  try {
    const { token, version, description, deployedAt } = req.body;
    if (!token) return res.status(401).json({ error: 'Token manquant' });
    if (!version) return res.status(400).json({ error: 'version requis' });

    const monitor = await Monitor.findOne({ webhookToken: token }).lean();
    if (!monitor) return res.status(401).json({ error: 'Token invalide' });

    const entry = await Changelog.create({
      monitorId: monitor._id,
      version,
      description: description || '',
      deployedAt: deployedAt ? new Date(deployedAt) : new Date(),
    });

    res.status(201).json({ ok: true, entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
