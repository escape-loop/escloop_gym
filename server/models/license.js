// server/models/License.js
const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const LicenseSchema = new mongoose.Schema({
  gymId: { type: String, required: true, unique: true },
  licenseKey: { type: String, required: true, unique: true },
  plan: { type: String, enum: ['lite', 'pro', 'elite'], required: true },
  duration: { type: Number, required: true }, // years
  startDate: { type: Date, default: Date.now },
  expiryDate: { type: Date, required: true },
  features: {
    biometric: Boolean,
    rfid: Boolean,
    faceId: Boolean,
    staffMobileApp: Boolean,
    aiFitnessPlan: Boolean,
    aiBusinessInsights: Boolean,
    multiBranch: Boolean,
    brandedMobileApp: Boolean,
    ptSessionBooking: Boolean,
    maxStaffLogins: Number,
  },
  trialFeatures: [{
    feature: String,
    startDate: Date,
    expiryDate: Date,
  }],
  status: { type: String, enum: ['active', 'expired', 'suspended'], default: 'active' },
});

// NOTE: gymId and licenseKey indexes are already created by unique:true on the field definition above.
// Do NOT add LicenseSchema.index() duplicates here — they cause Mongoose warnings.

LicenseSchema.plugin(tenantPlugin);

module.exports = mongoose.model('License', LicenseSchema);
