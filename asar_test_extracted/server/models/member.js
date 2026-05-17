const mongoose = require("mongoose");
const tenantPlugin = require('../plugins/tenantPlugin');

const MemberSchema = new mongoose.Schema({
    // 1. Personal Details
    memberId: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String },
    fullName: { type: String },
    gender: { type: String, enum: ["Male", "Female", "Other"] },
    dob: { type: Date },
    phone: { type: String, required: true },
    email: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    area: { type: String },
    distanceFromGym: { type: String }, // Required if area is 'Other' (handled in logic/frontend)
    profilePhoto: { type: String },
    hearAboutUs: { type: String },
    goal: { type: String },
    lockerNumber: { type: String },

    // 2. Medical Records
    medicalConditions: { type: String },
    injuryHistory: { type: String },
    doctorRestrictions: { type: String },
    medicalReports: [{ type: String }], // URL/path to medical documents
    emergencyName: { type: String },
    emergencyPhone: { type: String },

    // 3. Subscription & Billing (Restored for system functionality)
    packageName: { type: String },
    membershipType: { type: String }, // e.g., Monthly, Yearly
    duration: { type: String }, // e.g., "3" (months)
    startDate: { type: Date },
    endDate: { type: Date },
    amount: { type: Number, default: 0 },
    discountType: { type: String, enum: ["amount", "percentage"], default: "amount" },
    discountValue: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    balanceAmount: { type: Number, default: 0 },
    netPayable: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ["Active", "Hold", "Expired", "Cancelled", "Pending"],
        default: "Pending",
    },
    installment: { type: String, enum: ["Yes", "No"], default: "No" },
    installmentAmount: { type: Number, default: 0 },

    // Metadata
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },

    // 4. Churn Prediction
    churnScore: { type: Number }, // Probability 0.0 - 1.0
    churnRisk: { type: String },  // "High Risk" or "Safe"

    // 5. Notification Logic
    lastAttendanceCalledDate: { type: Date },
    lastExpiryReminderDate: { type: Date },
    lastExpiryMilestone: { type: Number },
    lastBirthdayReminderDate: { type: Date },

    // Multi-Tenancy
    gymId: { type: String, required: true, index: true },
});

// Auto-generate fullName before saving
MemberSchema.pre("save", async function () {
    if (this.firstName || this.lastName) {
        this.fullName = `${this.firstName || ""} ${this.lastName || ""}`.trim();
    }
    this.updatedAt = Date.now();
});

// Compound Unique Indexes for Multi-Tenancy
// This ensures that "Member 0001" or phone number "123" can exist
// multiple times across the database, but only OCCUR ONCE per individual gym.
MemberSchema.index({ memberId: 1, gymId: 1 }, { unique: true });
MemberSchema.index({ phone: 1, gymId: 1 }, { unique: true });

// Apply RLS: every query is automatically scoped to the logged-in gym
MemberSchema.plugin(tenantPlugin);

const MemberModel = mongoose.models.Member || mongoose.model("Member", MemberSchema);
const createProxyModel = require('../utils/proxyModel');
module.exports = createProxyModel(MemberModel, MemberSchema);
