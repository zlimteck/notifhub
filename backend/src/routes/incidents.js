const router = require('express').Router();
const Incident = require('../models/Incident');

// GET /api/incidents?monitorId=xxx&open=true&limit=50
router.get('/', async (req, res) => {
  const { monitorId, open, limit = 50 } = req.query;
  const filter = {};
  if (monitorId) filter.monitorId = monitorId;
  if (open === 'true') filter.resolvedAt = null;

  const incidents = await Incident.find(filter)
    .sort({ startedAt: -1 })
    .limit(parseInt(limit))
    .lean();

  res.json(incidents);
});

// POST /api/incidents/:id/acknowledge
router.post('/:id/acknowledge', async (req, res) => {
  const incident = await Incident.findByIdAndUpdate(
    req.params.id,
    { acknowledgedAt: new Date() },
    { new: true }
  );
  if (!incident) return res.status(404).json({ error: 'Incident introuvable' });
  res.json(incident);
});

// DELETE /api/incidents/:id
router.delete('/:id', async (req, res) => {
  await Incident.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
