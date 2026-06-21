const router = require('express').Router();
const Monitor = require('../models/Monitor');
const Incident = require('../models/Incident');
const { triggerNow } = require('../monitors/runner');
const handlers = require('../monitors/handlers');

router.get('/', async (req, res) => {
  const monitors = await Monitor.find().sort({ position: 1, createdAt: 1 });
  res.json(monitors);
});

router.patch('/reorder', async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items requis' });
  await Promise.all(items.map(({ id, position }) =>
    Monitor.findByIdAndUpdate(id, { position })
  ));
  res.json({ ok: true });
});

router.get('/stats', async (req, res) => {
  const monitors = await Monitor.find();
  const total   = monitors.length;
  const online  = monitors.filter(m => m.enabled && m.status === 'online').length;
  const warning = monitors.filter(m => m.enabled && ['warning', 'offline'].includes(m.status)).length;
  const error   = monitors.filter(m => m.enabled && m.status === 'error').length;
  const disabled = monitors.filter(m => !m.enabled).length;
  res.json({ total, online, warning, error, disabled });
});

const TYPES = ['cloudflare', 'adguard', 'hms', 'ultracc', 'syncthing', 'http', 'ping', 'proxmox', 'immich', 'portainer', 'ssh', 'heartbeat', 'docker', 'unraid', 'jellyfin', 'dns', 'mysql', 'redis'];

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (TYPES.includes(id)) {
    const monitors = await Monitor.find({ type: id }).sort({ createdAt: -1 });
    return res.json(monitors);
  }
  const monitor = await Monitor.findById(id);
  if (!monitor) return res.status(404).json({ error: 'Service introuvable' });
  res.json(monitor);
});

router.post('/', async (req, res) => {
  try {
    const monitor = await Monitor.create(req.body);
    if (monitor.enabled) triggerNow(monitor._id).catch(() => {});
    res.status(201).json(monitor);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const monitor = await Monitor.findByIdAndUpdate(
      req.params.id,
      { ...req.body, lastChecked: null },
      { new: true, runValidators: true }
    );
    if (!monitor) return res.status(404).json({ error: 'Service introuvable' });
    if (monitor.enabled) triggerNow(monitor._id).catch(() => {});
    res.json(monitor);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/toggle', async (req, res) => {
  const monitor = await Monitor.findById(req.params.id);
  if (!monitor) return res.status(404).json({ error: 'Service introuvable' });
  monitor.enabled = !monitor.enabled;
  monitor.lastChecked = null;
  await monitor.save();
  if (monitor.enabled) triggerNow(monitor._id).catch(() => {});
  res.json(monitor);
});

router.post('/:id/run', async (req, res) => {
  const monitor = await Monitor.findById(req.params.id);
  if (!monitor) return res.status(404).json({ error: 'Service introuvable' });
  await triggerNow(monitor._id);
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  await Monitor.findByIdAndDelete(req.params.id);
  await Incident.deleteMany({ monitorId: req.params.id });
  res.json({ ok: true });
});

// POST /api/monitors/homeassistant/entities — proxy to fetch HA entity list
router.post('/homeassistant/entities', async (req, res) => {
  const { url, token, rejectUnauthorized = true } = req.body;
  if (!url || !token) return res.status(400).json({ error: 'url et token requis' });
  const axios = require('axios');
  const base  = url.replace(/\/$/, '');
  const httpsAgent = rejectUnauthorized ? undefined : new (require('https').Agent)({ rejectUnauthorized: false });
  try {
    const r = await axios.get(`${base}/api/states`, {
      timeout: 15000,
      httpsAgent,
      headers: { Authorization: `Bearer ${token}` },
    });
    const entities = r.data.map(e => ({
      entity_id:     e.entity_id,
      friendly_name: e.attributes?.friendly_name || e.entity_id,
      state:         e.state,
      domain:        e.entity_id.split('.')[0],
    })).sort((a, b) => a.entity_id.localeCompare(b.entity_id));
    res.json({ entities });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/monitors/test — test a config without saving (for new services)
router.post('/test', async (req, res) => {
  const { type, config } = req.body;
  if (!type || !config) return res.status(400).json({ error: 'type et config requis' });
  const handler = handlers[type];
  if (!handler) return res.status(400).json({ error: `Type inconnu: ${type}` });
  try {
    const result = await handler.check(config, null);
    res.json({ status: result.status, metrics: result.metrics, error: result.lastError || null });
  } catch (err) {
    res.json({ status: 'error', error: err.message });
  }
});

// POST /api/monitors/:id/test — run a check and return the result without saving
router.post('/:id/test', async (req, res) => {
  const monitor = await Monitor.findById(req.params.id);
  if (!monitor) return res.status(404).json({ error: 'Service introuvable' });
  const handler = handlers[monitor.type];
  if (!handler) return res.status(400).json({ error: `Type inconnu: ${monitor.type}` });
  try {
    const result = await handler.check(monitor.config, monitor.lastState);
    res.json({ status: result.status, metrics: result.metrics, error: result.lastError || null });
  } catch (err) {
    res.json({ status: 'error', error: err.message });
  }
});

// POST /api/monitors/:id/maintenance  body: { minutes: 60 }
router.post('/:id/maintenance', async (req, res) => {
  const { minutes } = req.body;
  if (!minutes || minutes <= 0) return res.status(400).json({ error: 'minutes requis' });
  const until = new Date(Date.now() + minutes * 60 * 1000);
  const monitor = await Monitor.findByIdAndUpdate(req.params.id, { maintenanceUntil: until }, { new: true });
  if (!monitor) return res.status(404).json({ error: 'Service introuvable' });
  res.json({ ok: true, maintenanceUntil: until });
});

// DELETE /api/monitors/:id/maintenance
router.delete('/:id/maintenance', async (req, res) => {
  const monitor = await Monitor.findByIdAndUpdate(req.params.id, { maintenanceUntil: null }, { new: true });
  if (!monitor) return res.status(404).json({ error: 'Service introuvable' });
  res.json({ ok: true });
});

module.exports = router;
