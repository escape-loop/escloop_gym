const mongoose = require("mongoose");
const tenantPlugin = require('../plugins/tenantPlugin');

const LeadSchema = new mongoose.Schema({
  // Basic Information
  name: { type: String, required: true },
  email: { type: String }, // unique per gym (compound index below)
  phone: { type: String, required: true },
  location: { type: String },

  // Contact Information
  lastContactedDate: { type: Date },

  // Lead Details
  source: {
    type: String,
    enum: ["website", "referral", "social_media", "walk_in", "event", "other"],
    default: "website"
  },
  status: {
    type: String,
    enum: ["new", "contacted", "follow_up", "converted", "lost"],
    default: "new"
  },
  interestLevel: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium"
  },
  nextFollowUpDate: { type: Date },
  interestedService: { type: String },

  // Additional Information
  notes: { type: String },

  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  convertedTo: { type: Boolean, default: false },
  convertedAt: { type: Date },
  convertedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastFollowUpReminderDate: { type: Date },

  // Multi-Tenancy
  gymId: { type: String, required: true, index: true },
});

// Auto-update updatedAt field and generate unique lead ID
LeadSchema.pre('save', async function () {
  this.updatedAt = new Date();

  if (this.isNew) {
    try {
      const count = await this.constructor.countDocuments();
      this.leadId = `LD${String(count + 1).padStart(4, '0')}`;
    } catch (error) {
      throw error;
    }
  }
});

// Index for search
LeadSchema.index({ name: "text", email: "text", phone: "text" });
// Compound unique: email is unique per gym, not globally
LeadSchema.index({ email: 1, gymId: 1 }, { unique: true, sparse: true });

// Apply RLS plugin
LeadSchema.plugin(tenantPlugin);

const LeadModel = mongoose.models.Lead || mongoose.model("Lead", LeadSchema);
const createProxyModel = require('../utils/proxyModel');
module.exports = createProxyModel(LeadModel, LeadSchema);