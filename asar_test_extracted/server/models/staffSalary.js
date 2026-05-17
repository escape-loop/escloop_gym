const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const staffSalarySchema = new mongoose.Schema({
    staffId: { type: String, required: true },
    month: { type: String, required: true }, // Format: YYYY-MM
    baseSalary: { type: Number, required: true },
    presentDays: { type: Number, required: true },
    absentDays: { type: Number, required: true },
    totalWorkingDays: { type: Number, required: true },
    finalAmount: { type: Number, required: true },
    status: { type: String, enum: ['Paid', 'Unpaid'], default: 'Unpaid' },
    paymentDate: { type: Date },
    paymentMode: { type: String, enum: ['Cash', 'Bank Transfer', 'UPI', 'Cheque'] },
    transactionId: { type: String },
    payslipUrl: { type: String }, // S3 URL
    gymId: { type: String, required: true, index: true }, // Multi-Tenancy
}, { timestamps: true });

// Ensure unique record per staff member per month per gym
staffSalarySchema.index({ staffId: 1, month: 1, gymId: 1 }, { unique: true });

// Apply RLS plugin
staffSalarySchema.plugin(tenantPlugin);

const createProxyModel = require('../utils/proxyModel');
const StaffSalaryModel = mongoose.models.StaffSalary || mongoose.model('StaffSalary', staffSalarySchema);
module.exports = createProxyModel(StaffSalaryModel, staffSalarySchema);
