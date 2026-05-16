const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const attendanceSchema = new mongoose.Schema({
  type: { type: String, enum: ['member', 'staff'], required: true },
  entityId: { type: String, required: true },  // attendance ID
  mobile: { type: String, required: true },
  date: { type: Date, required: true },  // ISO date only
  status: { type: String, enum: ['present', 'absent', 'pending', 'expired'], default: 'present' },
  time: { type: String, required: true },  // HH:MM AM/PM
  gymId: { type: String, required: true, index: true }, // Multi-Tenancy
  createdAt: { type: Date, default: Date.now }
});

// Apply RLS plugin
attendanceSchema.plugin(tenantPlugin);

const createProxyModel = require('../utils/proxyModel');
const AttendanceModel = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);
module.exports = createProxyModel(AttendanceModel, attendanceSchema);
