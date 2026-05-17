const mongoose = require("mongoose");
const tenantPlugin = require('../plugins/tenantPlugin');

const MembershipPlanSchema = new mongoose.Schema({
  name: { type: String, required: true }, // unique per gym (compound index below)
  type: {
    type: String,
    enum: ["Monthly", "Quarterly", "Half-Yearly", "Yearly", "Personal Training"],
    required: true,
  },
  price: { type: Number, required: true, min: 0 },
  durationDays: { type: Number, required: true, min: 1 },
  maxMembers: { type: Number, default: 0, min: 0 }, // 0 = unlimited
  description: { type: String, maxlength: 500 },
  features: [{ type: String }],
  steamSessions: { type: Number, default: 0 },
  ptSessions: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ["Active", "Inactive"],
    default: "Active",
  },
  image: { type: String }, // URL/path to plan image
  currentMembers: { type: Number, default: 0 }, // tracked members
  planCode: { type: String }, // auto-generated, unique per gym (compound index below)
  // Offer validity (optional)
  offerValid: { type: String },

  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },

  // Multi-Tenancy
  gymId: { type: String, required: true, index: true },
});

// Auto-generate planCode
MembershipPlanSchema.pre("save", function () {
  if (!this.planCode) {
    const year = new Date().getFullYear();
    const typeCode = this.type.charAt(0).toUpperCase();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    this.planCode = `${typeCode}${year}${random}`;
  }
  this.updatedAt = Date.now();
});

// Compound unique indexes per gym (not globally unique)
MembershipPlanSchema.index({ name: 1, gymId: 1 }, { unique: true });
MembershipPlanSchema.index({ planCode: 1, gymId: 1 }, { unique: true, sparse: true });

// Apply RLS plugin
MembershipPlanSchema.plugin(tenantPlugin);

const MembershipPlanModel = mongoose.model("MembershipPlan", MembershipPlanSchema);
const createProxyModel = require('../utils/proxyModel');
module.exports = createProxyModel(MembershipPlanModel, MembershipPlanSchema);
