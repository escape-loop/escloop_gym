// models/PersonalizedPlan.js
const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const personalizedPlanSchema = new mongoose.Schema({
    planId: { type: String, required: true }, // e.g., PPLAN2026010001

    // Member Information
    memberId: { type: String }, // Human ID (e.g. M101)
    memberRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' }, // Database ID
    fullName: { type: String, required: true },
    mobileNumber: { type: String, required: true },
    age: { type: Number, required: true },
    gender: { type: String, enum: ['male', 'female'], required: true },
    height: { type: Number, required: true }, // in cm (metric)
    weight: { type: Number, required: true }, // in kg (metric)

    // Plan Parameters
    activityLevel: { type: Number, required: true }, // 1.2, 1.375, 1.55, etc.
    goal: { type: String, required: true }, // Weight Loss, Weight Gain, Maintenance
    isVeg: { type: Boolean, required: true },
    daysPerWeek: { type: Number, required: true, min: 3, max: 6 },
    tdee: { type: Number, required: true }, // Calculated TDEE

    // Package Information
    packageName: { type: String, required: true }, // e.g., "Weight Loss - Vegetarian"
    membershipType: { type: String, default: 'Fitness Plan' }, // Always "Fitness Plan"

    // Generated Plans (stored as JSON)
    dietPlan: { type: mongoose.Schema.Types.Mixed, required: true },
    workoutPlan: { type: mongoose.Schema.Types.Mixed, required: true },

    // Pricing & Payment
    price: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'partial'],
        default: 'pending'
    },
    paymentMode: {
        type: String,
        enum: ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Not Paid'],
        default: 'Not Paid'
    },

    // Metadata
    status: {
        type: String,
        enum: ['active', 'completed', 'cancelled'],
        default: 'active'
    },
    notes: String,
    createdBy: { type: String }, // Staff/Admin who created it
    gymId: { type: String, required: true, index: true }, // Multi-Tenancy

}, { timestamps: true });

// Apply RLS plugin
personalizedPlanSchema.plugin(tenantPlugin);

personalizedPlanSchema.index({ planId: 1, gymId: 1 }, { unique: true });

// Check if model already exists to prevent overwrite error
const createProxyModel = require('../utils/proxyModel');
const PersonalizedPlanModel = mongoose.models.PersonalizedPlan || mongoose.model('PersonalizedPlan', personalizedPlanSchema);
module.exports = createProxyModel(PersonalizedPlanModel, personalizedPlanSchema);
