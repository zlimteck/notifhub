const router = require('express').Router();
const Monitor = require('../models/Monitor');
const Incident = require('../models/Incident');
const { triggerNow } = require('../monitors/runner');

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

const TYPES = ['cloudflare', 'adguard', 'hms', 'ultracc', 'syncthing', 'http', 'ping', 'proxmox', 'immich', 'portainer', 'ssh', 'heartbeat', 'docker', 'unraid'];

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
