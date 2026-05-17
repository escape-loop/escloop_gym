const mongoose = require("mongoose");
const tenantPlugin = require('../plugins/tenantPlugin');

const SubscriptionSchema = new mongoose.Schema({
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        required: true
    },
    packageName: { type: String, required: true },
    trainerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff'
    },
    trainerName: { type: String },
    membershipType: { type: String }, // e.g., Monthly, Yearly
    duration: { type: String }, // e.g., "3" (months)
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    amount: { type: Number, default: 0 },
    discountType: { type: String, enum: ["amount", "percentage"], default: "amount" },
    discountValue: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    balanceAmount: { type: Number, default: 0 },
    netPayable: { type: Number, default: 0 },
    steamSessionsTotal: { type: Number, default: 0 },
    steamSessionsUsed: { type: Number, default: 0 },
    ptSessionsTotal: { type: Number, default: 0 },
    ptSessionsUsed: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ["Active", "Hold", "Expired", "Cancelled", "Pending"],
        default: "Pending",
    },
    paymentMode: {
        type: String,
        enum: ['Cash', 'UPI', 'Card', 'Bank Transfer'],
        default: 'Cash'
    },
    notes: { type: String },
    gymId: { type: String, required: true, index: true }, // Multi-Tenancy
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

SubscriptionSchema.pre("save", async function () {
    this.updatedAt = Date.now();
});

// Apply RLS plugin
SubscriptionSchema.plugin(tenantPlugin);

const SubscriptionModel = mongoose.models.Subscription || mongoose.model("Subscription", SubscriptionSchema);
const createProxyModel = require('../utils/proxyModel');
module.exports = createProxyModel(SubscriptionModel, SubscriptionSchema);
