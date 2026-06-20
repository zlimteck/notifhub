const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  monitorId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Monitor', required: true },
  monitorName:   { type: String },
  monitorType:   { type: String },
  startedAt:     { type: Date, default: Date.now },
  resolvedAt:    { type: Date, default: null },
  duration:      { type: Number, default: null }, // ms
  triggerStatus:   { type: String }, // 'error' | 'offline' | 'warning'
  severity:        { type: String, enum: ['P1','P2','P3','P4'], default: 'P3' },
  acknowledgedAt:  { type: Date, default: null },
});

schema.index({ monitorId: 1, startedAt: -1 });
schema.index({ resolvedAt: 1 });
schema.index({ startedAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

module.exports = mongoose.model('Incident', schema);
