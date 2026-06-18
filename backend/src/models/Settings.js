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
    title: { type: String, default: '' },
  },
});

module.exports = mongoose.model('Settings', settingsSchema);
