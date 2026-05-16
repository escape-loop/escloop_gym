// models/Bill.js
const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const billItemSchema = new mongoose.Schema({
    description: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 }
});

const billSchema = new mongoose.Schema({
    invoiceId: { type: String, required: true }, // e.g., INV2026010001
    memberId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Member' },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' }, // Optional link to specific subscription
    personalizedPlanId: { type: String }, // Optional link to personalized fitness plan
    memberName: { type: String, required: true },
    memberEmail: String,
    invoiceDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    items: [billItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paymentMode: { type: String, enum: ['Cash', 'UPI', 'Card', 'Bank Transfer'], default: 'Cash' },
    amountPaid: { type: Number, default: 0, min: 0 },
    balance: { type: Number, required: true, min: 0 },
    status: {
        type: String,
        enum: ['paid', 'partial', 'due', 'overdue'],
        default: 'due'
    },
    pdfUrl: String, // S3 URL to generated PDF
    notes: String,
    gymId: { type: String, required: true, index: true }, // Multi-Tenancy
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// Apply tenant plugin
billSchema.plugin(tenantPlugin);

// Compound unique index per gym
billSchema.index({ invoiceId: 1, gymId: 1 }, { unique: true });

// Add virtual reference to PersonalizedPlan
billSchema.virtual('personalizedPlan', {
    ref: 'PersonalizedPlan',
    localField: 'personalizedPlanId',
    foreignField: 'planId',
    justOne: true
});

// Check if model already exists to prevent overwrite error
const createProxyModel = require('../utils/proxyModel');
const BillModel = mongoose.models.Bill || mongoose.model('Bill', billSchema);
module.exports = createProxyModel(BillModel, billSchema);
