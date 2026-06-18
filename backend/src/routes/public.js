const router = require('express').Router();
const Monitor = require('../models/Monitor');
const MetricSnapshot = require('../models/MetricSnapshot');
const Incident = require('../models/Incident');
const Settings = require('../models/Settings');

// GET /api/public/status
router.get('/status', async (req, res) => {
  try {
    const [monitors, settings] = await Promise.all([
      Monitor.find({ enabled: true, showOnStatusPage: { $ne: false } }, 'name description category status type lastChecked serviceUrl metrics').lean(),
      Settings.findOne({ key: 'global' }, 'statusPage').lean(),
    ]);

    const title = settings?.statusPage?.title || 'System Status';

    const now = Date.now();
    const since24h = new Date(now - 24 * 3600 * 1000);
    const since7d  = new Date(now - 7 * 24 * 3600 * 1000);
    const since90d = new Date(now - 90 * 24 * 3600 * 1000);

    // Uptime per monitor
    const uptimeData = await Promise.all(monitors.map(async m => {
      const snapshots = await MetricSnapshot.find(
        { monitorId: m._id, ts: { $gte: since90d } },
        'ts status'
      ).lean();

      const calc = (since) => {
        const rel = snapshots.filter(s => new Date(s.ts) >= since);
        if (!rel.length) return null;
        const online = rel.filter(s => s.status === 'online').length;
        return Math.round((online / rel.length) * 1000) / 10;
      };

      // Daily uptime for 90-day bar
      const byDay = {};
      for (const s of snapshots) {
        const day = new Date(s.ts).toISOString().slice(0, 10);
        if (!byDay[day]) byDay[day] = { total: 0, online: 0 };
        byDay[day].total++;
        if (s.status === 'online') byDay[day].online++;
      }
      const days = [];
      for (let i = 89; i >= 0; i--) {
        const day = new Date(now - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
        const d = byDay[day];
        days.push(d ? Math.round((d.online / d.total) * 1000) / 10 : null);
      }

      return { id: m._id, h24: calc(since24h), d7: calc(since7d), days };
    }));

    const uptimeMap = Object.fromEntries(uptimeData.map(u => [u.id, u]));

    const safeMonitors = monitors.map(m => ({
      _id: m._id,
      name: m.name,
      description: m.description,
      category: m.category,
      status: m.status,
      type: m.type,
      lastChecked: m.lastChecked,
      serviceUrl: m.serviceUrl || null,
      faviconUrl: m.metrics?.faviconUrl || null,
      uptime: { h24: uptimeMap[m._id]?.h24 ?? null, d7: uptimeMap[m._id]?.d7 ?? null },
      days: uptimeMap[m._id]?.days ?? [],
    }));

    // Recent incidents
    const [openIncidents, resolvedIncidents] = await Promise.all([
      Incident.find({ resolvedAt: null }).sort({ startedAt: -1 }).limit(5).lean(),
      Incident.find({ resolvedAt: { $ne: null } }).sort({ resolvedAt: -1 }).limit(10).lean(),
    ]);

    res.json({
      title,
      monitors: safeMonitors,
      openIncidents,
      recentIncidents: resolvedIncidents,
      updatedAt: new Date(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
