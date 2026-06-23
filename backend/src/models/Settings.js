const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key: { type: String, default: 'global', unique: true },
  appriseUrls: { type: [String], default: [] },
  appriseApiUrl: { type: String, default: 'http://apprise:8000' },
  weeklyReport: {
    enabled:    { type: Boolean, default: false },
    dayOfWeek:  { type: Number, default: 1 },  // 0=Sun … 6=Sat (UTC)
    hour:       { type: Number, default: 8 },   // UTC hour
    lastSentAt: { type: Date, default: null },
  },
  showGraphs: { type: Boolean, default: true },
  statusPage: {
    title:       { type: String, default: '' },
    description: { type: String, default: '' },
    logoUrl:     { type: String, default: '' },
    accentColor: { type: String, default: '' },
    footerText:  { type: String, default: '' },
  },
  mcpApiKey:       { type: String, default: () => require('crypto').randomBytes(24).toString('hex') },
  anthropicApiKey:   { type: String, default: null },
  anthropicModel:    { type: String, default: 'claude-sonnet-4-6' },
  defaultProxy: { type: mongoose.Schema.Types.Mixed, default: null }, // legacy, migrated to proxies on first GET
  proxies: {
    type: [{
      name:       { type: String, default: 'Proxy' },
      active:     { type: Boolean, default: false },
      type:       { type: String, default: 'http' },
      host:       { type: String, default: '' },
      port:       { type: Number },
      username:   { type: String, default: '' },
      password:   { type: String, default: '' },
      privateKey: { type: String, default: '' },
    }],
    default: [],
  },
  notificationLanguage: { type: String, default: 'fr' },
  notificationCooldown: { type: Number, default: 0 }, // minutes, 0 = disabled
  adaptivePolling: {
    enabled:       { type: Boolean, default: true },
    errorInterval: { type: Number,  default: 30 },  // seconds
  },
});

module.exports = mongoose.model('Settings', settingsSchema);
