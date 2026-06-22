const router = require('express').Router();
const Incident = require('../models/Incident');
const Monitor = require('../models/Monitor');

// GET /api/incidents/timeline?hours=24
router.get('/timeline', async (req, res) => {
  const hours = Math.min(parseInt(req.query.hours) || 24, 7 * 24);
  const now = new Date();
  const windowStart = new Date(now.getTime() - hours * 60 * 60 * 1000);

  const [monitors, incidentsRaw] = await Promise.all([
    Monitor.find({}, 'name type category status').sort({ order: 1, name: 1 }).lean(),
    Incident.find({
      $or: [
        { startedAt: { $gte: windowStart } },
        { resolvedAt: null },
        { resolvedAt: { $gte: windowStart } },
      ],
    }).sort({ startedAt: 1 }).lean(),
  ]);

  const byMonitor = {};
  for (const inc of incidentsRaw) {
    const key = String(inc.monitorId);
    if (!byMonitor[key]) byMonitor[key] = [];
    byMonitor[key].push(inc);
  }

  const rows = monitors.map(m => {
    const mIncidents = byMonitor[String(m._id)] || [];
    const segments = [];
    let cursor = windowStart.getTime();

    for (const inc of mIncidents) {
      const start = Math.max(new Date(inc.startedAt).getTime(), windowStart.getTime());
      const end = inc.resolvedAt ? Math.min(new Date(inc.resolvedAt).getTime(), now.getTime()) : now.getTime();

      if (cursor < start) {
        segments.push({ start: cursor, end: start, status: 'online' });
      }
      if (end > start) {
        segments.push({ start, end, status: inc.triggerStatus || 'error', incidentId: String(inc._id), severity: inc.severity, reason: inc.reason || null });
      }
      cursor = Math.max(cursor, end);
    }

    if (cursor < now.getTime()) {
      segments.push({ start: cursor, end: now.getTime(), status: 'online' });
    }

    return {
      monitorId: String(m._id),
      monitorName: m.name,
      monitorType: m.type,
      category: m.category || '',
      currentStatus: m.status,
      segments,
    };
  });

  res.json({ windowStart: windowStart.toISOString(), windowEnd: now.toISOString(), rows });
});

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

// PATCH /api/incidents/:id/severity
router.patch('/:id/severity', async (req, res) => {
  const { severity } = req.body;
  if (!['P1','P2','P3','P4'].includes(severity)) return res.status(400).json({ error: 'Sévérité invalide' });
  const incident = await Incident.findByIdAndUpdate(req.params.id, { severity }, { new: true });
  if (!incident) return res.status(404).json({ error: 'Incident introuvable' });
  res.json(incident);
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

// PATCH /api/incidents/:id/postmortem
router.patch('/:id/postmortem', async (req, res) => {
  const { summary, rootCause, impact, resolution, lessons } = req.body;
  const incident = await Incident.findByIdAndUpdate(
    req.params.id,
    { postmortem: { summary, rootCause, impact, resolution, lessons, updatedAt: new Date() } },
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
