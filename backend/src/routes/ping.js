const router = require('express').Router();
const Monitor = require('../models/Monitor');

// Public endpoint — no auth required
router.get('/:slug', async (req, res) => {
  const monitor = await Monitor.findOne({ type: 'heartbeat', 'config.slug': req.params.slug });
  if (!monitor) return res.status(404).json({ error: 'Heartbeat introuvable' });

  const lastState = { ...(monitor.lastState || {}), lastPing: new Date(), wasOnline: true };
  await Monitor.findByIdAndUpdate(monitor._id, { lastState, status: 'online', lastChecked: new Date() });

  res.json({ ok: true, ts: new Date() });
});

module.exports = router;
