const mongoose = require('mongoose');
const { encryptConfig, decryptConfig } = require('../utils/crypto');

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
  dependsOn: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Monitor' }],
}, { timestamps: true });

// Encrypt sensitive config fields before any save
monitorSchema.pre('save', function (next) {
  if (this.isModified('config') && this.config) {
    this.config = encryptConfig(this.config);
  }
  next();
});

// Encrypt when using findByIdAndUpdate / findOneAndUpdate
monitorSchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate();
  const cfg = update?.config ?? update?.$set?.config;
  if (cfg) {
    const encrypted = encryptConfig(cfg);
    if (update.config)      update.config          = encrypted;
    if (update.$set?.config) update.$set.config     = encrypted;
  }
});

// Decrypt after any document is loaded from DB
monitorSchema.post('init', function () {
  if (this.config) this.config = decryptConfig(this.config);
});

// Decrypt the document returned by findOneAndUpdate
monitorSchema.post('findOneAndUpdate', function (doc) {
  if (doc?.config) doc.config = decryptConfig(doc.config);
});

module.exports = mongoose.model('Monitor', monitorSchema);
