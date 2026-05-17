const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const GymSettingsSchema = new mongoose.Schema({
    isBranch: { type: Boolean, default: false },
    parentGymId: { type: String, default: null },
    gymName: {
        type: String,
        required: true,
        default: 'My Gym'
    },
    mongoUri: {
        type: String,
        default: ''
    },
    gymLogo: {
        type: String, // Path to the logo image
        default: ''
    },
    authorizerSignature: {
        type: String, // Path to the signature image
        default: ''
    },
    address: {
        type: String,
        default: ''
    },
    email: {
        type: String,
        default: ''
    },
    mobile: {
        type: String,
        default: ''
    },
    landmark: {
        type: String,
        default: ''
    },
    instagram: {
        type: String,
        default: ''
    },
    facebook: {
        type: String,
        default: ''
    },
    twitter: {
        type: String,
        default: ''
    },
    website: {
        type: String,
        default: ''
    },
    latitude: {
        type: Number,
        default: null
    },
    longitude: {
        type: Number,
        default: null
    },
    publicUrl: {
        type: String,
        default: ''
    },
    whatsappInstanceName: {
        type: String,
        default: ''
    },
    automationToggles: {
        subscriptionRenewal: { type: Boolean, default: true },
        newRegistration: { type: Boolean, default: true },
        paymentReceipt: { type: Boolean, default: true },
        attendanceAlert: { type: Boolean, default: true },
        birthdayWish: { type: Boolean, default: true },
        enquiryFollowup: { type: Boolean, default: true },
        personalizedPlan: { type: Boolean, default: true },
        salaryPayslip: { type: Boolean, default: true },
        revenueReportToOwner: { type: Boolean, default: true }
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    gymId: {
        type: String,
        required: true,
        index: true
    }
}, { timestamps: true });

GymSettingsSchema.plugin(tenantPlugin);

module.exports = mongoose.model('GymSettings', GymSettingsSchema);
