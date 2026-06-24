const router = require('express').Router();
const Monitor = require('../models/Monitor');
const Incident = require('../models/Incident');
const MaintenanceWindow = require('../models/MaintenanceWindow');
const { triggerNow } = require('../monitors/runner');
const handlers = require('../monitors/handlers');

router.get('/', async (req, res) => {
  const monitors = await Monitor.find().sort({ position: 1, createdAt: 1 });
  res.json(monitors);
});

router.patch('/bulk', async (req, res) => {
  const { ids, action } = req.body;
  if (!Array.isArray(ids) || !ids.length || !action) {
    return res.status(400).json({ error: 'ids and action required' });
  }
  if (action === 'delete') {
    await Monitor.deleteMany({ _id: { $in: ids } });
    await Incident.deleteMany({ monitorId: { $in: ids } });
  } else if (action === 'enable') {
    await Monitor.updateMany({ _id: { $in: ids } }, { enabled: true });
    ids.forEach(id => triggerNow(id).catch(() => {}));
  } else if (action === 'disable') {
    await Monitor.updateMany({ _id: { $in: ids } }, { enabled: false });
  } else if (action === 'pin') {
    await Monitor.updateMany({ _id: { $in: ids } }, { pinned: true });
  } else if (action === 'unpin') {
    await Monitor.updateMany({ _id: { $in: ids } }, { pinned: false });
  } else {
    return res.status(400).json({ error: 'Unknown action' });
  }
  res.json({ ok: true, count: ids.length });
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

const TYPES = ['cloudflare', 'adguard', 'hms', 'ultracc', 'syncthing', 'http', 'ping', 'proxmox', 'immich', 'portainer', 'ssh', 'heartbeat', 'docker', 'unraid', 'jellyfin', 'dns', 'mysql', 'redis', 'ollama'];

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

router.post('/:id/clone', async (req, res) => {
  try {
    const src = await Monitor.findById(req.params.id);
    if (!src) return res.status(404).json({ error: 'Service introuvable' });
    const { _id, createdAt, updatedAt, status, lastChecked, lastReported, lastState, metrics, lastError, lastDownAt, lastDownNotified, ...fields } = src.toObject();
    const clone = await Monitor.create({ ...fields, name: `${src.name} (copy)`, status: 'unknown', enabled: false });
    res.status(201).json(clone);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/pin', async (req, res) => {
  const monitor = await Monitor.findById(req.params.id);
  if (!monitor) return res.status(404).json({ error: 'Service introuvable' });
  monitor.pinned = !monitor.pinned;
  await monitor.save();
  res.json(monitor);
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

// GET /api/monitors/:id/maintenance — history
router.get('/:id/maintenance', async (req, res) => {
  const windows = await MaintenanceWindow.find({ monitorId: req.params.id })
    .sort({ startedAt: -1 }).limit(50);
  res.json(windows);
});

// POST /api/monitors/:id/maintenance  body: { minutes: 60, startsAt?: ISO string }
router.post('/:id/maintenance', async (req, res) => {
  const { minutes, startsAt } = req.body;
  if (!minutes || minutes <= 0) return res.status(400).json({ error: 'minutes requis' });
  const start = startsAt ? new Date(startsAt) : new Date();
  const until = new Date(start.getTime() + minutes * 60 * 1000);
  const monitor = await Monitor.findByIdAndUpdate(
    req.params.id,
    { maintenanceStart: start, maintenanceUntil: until },
    { new: true }
  );
  if (!monitor) return res.status(404).json({ error: 'Service introuvable' });
  // Record in history (only immediate windows — scheduled ones are recorded when they activate)
  if (!startsAt) {
    await MaintenanceWindow.create({ monitorId: monitor._id, startedAt: start });
  }
  res.json({ ok: true, maintenanceStart: start, maintenanceUntil: until });
});

// DELETE /api/monitors/:id/maintenance
router.delete('/:id/maintenance', async (req, res) => {
  const monitor = await Monitor.findById(req.params.id);
  if (!monitor) return res.status(404).json({ error: 'Service introuvable' });
  // Close open window in history
  const now = new Date();
  await MaintenanceWindow.findOneAndUpdate(
    { monitorId: monitor._id, endedAt: null },
    { endedAt: now, canceledAt: now }
  );
  await monitor.updateOne({ maintenanceStart: null, maintenanceUntil: null });
  res.json({ ok: true });
});

// POST /api/monitors/:id/webhook-token — generate or regenerate webhook token
router.post('/:id/webhook-token', async (req, res) => {
  const { randomBytes } = require('crypto');
  const token = randomBytes(32).toString('hex');
  const monitor = await Monitor.findByIdAndUpdate(
    req.params.id,
    { webhookToken: token },
    { new: true }
  );
  if (!monitor) return res.status(404).json({ error: 'Service introuvable' });
  res.json({ webhookToken: token });
});

// DELETE /api/monitors/:id/webhook-token — revoke webhook token
router.delete('/:id/webhook-token', async (req, res) => {
  const monitor = await Monitor.findByIdAndUpdate(
    req.params.id,
    { webhookToken: null },
    { new: true }
  );
  if (!monitor) return res.status(404).json({ error: 'Service introuvable' });
  res.json({ ok: true });
});

module.exports = router;
