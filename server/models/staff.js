const mongoose = require("mongoose");
const tenantPlugin = require('../plugins/tenantPlugin');

const StaffSchema = new mongoose.Schema({
  // Personal Details
  staffId: { type: String }, // Numeric ID (4-6 digits)
  firstName: { type: String, required: true },
  lastName: { type: String, required: false },
  fullName: { type: String }, // auto-generated
  gender: { type: String, enum: ["Male", "Female", "Other"], required: true },
  dob: { type: Date },
  phone: { type: String, required: true }, // unique per gym (enforced via compound index)
  email: { type: String, required: false, sparse: true },
  emergencyContact: { type: String },
  emergencyPhone: { type: String },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  pincode: { type: String },
  profilePhoto: { type: String }, // URL/path

  // Employment Details
  role: {
    type: String,
    enum: [
      "Receptionist",
      "Trainer",
      "Manager",
      "Cleaner",
      "Admin",
      "Security",
      "Nutritionist",
    ],
    required: true,
  },
  department: {
    type: String,
    enum: ["Front Desk", "Training", "Management", "Maintenance", "Security"],
  },
  joinDate: { type: Date, required: false },
  employmentType: {
    type: String,
    enum: ["Full-time", "Part-time", "Contract"],
    default: "Full-time",
  },
  salary: { type: Number, required: true, min: 0 },
  salaryPaymentMode: { type: String, enum: ["Bank", "Cash"], default: "Bank" },
  bankAccount: { type: String, sparse: true },
  ifsc: { type: String },
  panNumber: { type: String, sparse: true },
  aadhaarNumber: { type: String, sparse: true },

  // Referral System
  referralCode: { type: String }, // unique per gym (compound index below)
  referralDiscountPercentage: { type: Number, default: 0, min: 0, max: 100 },

  // Work Schedule
  shiftType: {
    type: String,
    enum: [
      "Morning",
      "Afternoon",
      "Night",
      "Flexible",
    ],
    required: true,
  },
  workDays: { type: [String], required: true }, // ["Monday", "Tuesday"]
  workHoursStart: { type: String, required: true }, // "06:00"
  workHoursEnd: { type: String, required: true }, // "14:00"
  breakDuration: { type: Number, min: 0 }, // minutes

  // Certifications & Skills
  certifications: { type: String },
  specializations: { type: String },
  qualifications: { type: String },
  certificates: [{ type: String }], // Array of file paths

  // Gym Assignment
  assignedBranch: { type: String },
  assignedBatches: [{ type: String }], // ["6-7AM", "7-8AM"]
  assignedMembers: [
    {
      memberId: { type: String },
      name: { type: String },
      fitnessGoal: { type: String },
      ptSessionsRemaining: { type: Number, default: 0 },
      membershipType: { type: String },
    },
  ],

  // Status
  status: {
    type: String,
    enum: ["Active", "Inactive", "On Leave"],
    default: "Active",
  },

  probationPeriod: { type: Boolean, default: false },
  probationEndDate: { type: Date },

  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },

  // Multi-Tenancy
  gymId: { type: String, required: true, index: true },
});

// Note: Auto-generation logic moved to controller to avoid middleware conflicts

// Index for search
StaffSchema.index({ fullName: "text", email: "text", staffId: "text" });

// Compound unique indexes (unique per gym, not globally)
StaffSchema.index({ staffId: 1, gymId: 1 }, { unique: true, sparse: true });
StaffSchema.index({ phone: 1, gymId: 1 }, { unique: true });
StaffSchema.index({ referralCode: 1, gymId: 1 }, { unique: true, sparse: true });
StaffSchema.index({ panNumber: 1, gymId: 1 }, { unique: true, sparse: true });
StaffSchema.index({ aadhaarNumber: 1, gymId: 1 }, { unique: true, sparse: true });
StaffSchema.index({ bankAccount: 1, gymId: 1 }, { unique: true, sparse: true });

// Apply RLS plugin
StaffSchema.plugin(tenantPlugin);

const StaffModel = mongoose.models.Staff || mongoose.model("Staff", StaffSchema);
const createProxyModel = require('../utils/proxyModel');
module.exports = createProxyModel(StaffModel, StaffSchema);
