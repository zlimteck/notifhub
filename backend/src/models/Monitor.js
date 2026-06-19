const mongoose = require('mongoose');

const monitorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true, enum: ['cloudflare', 'adguard', 'adguardhome', 'hms', 'ultracc', 'syncthing', 'http', 'ping', 'proxmox', 'immich', 'portainer', 'ssh', 'heartbeat', 'docker', 'unraid', 'speedtest', 'homeassistant'] },
  description: { type: String, default: '' },
  enabled: { type: Boolean, default: true },
  checkInterval: { type: Number, default: 5 },   // minutes
  reportInterval: { type: Number, default: 0 },  // hours, 0 = pas de rapport
  config: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, default: 'unknown', enum: ['online', 'offline', 'warning', 'error', 'unknown'] },
  lastChecked: { type: Date, default: null },
  lastReported: { type: Date, default: null },
  lastState: { type: mongoose.Schema.Types.Mixed, default: null },
  metrics: { type: mongoose.Schema.Types.Mixed, default: null },
  lastError: { type: String, default: null },
  category: { type: String, default: '' },
  position: { type: Number, default: 0 },
  maintenanceUntil: { type: Date, default: null },
  lastDownAt: { type: Date, default: null },
  lastDownNotified: { type: Boolean, default: false },
  cardMetric: { type: String, default: null },
  serviceUrl: { type: String, default: '' },
  showOnStatusPage: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Monitor', monitorSchema);
