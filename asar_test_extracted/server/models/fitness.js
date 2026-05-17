// models/FitnessPlan.js
const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const workoutSchema = new mongoose.Schema({
  day: { type: String, required: true }, // e.g., "Monday", "Wednesday"
  exercises: [{
    name: { type: String, required: true },
    sets: { type: Number, required: true, min: 1 },
    reps: String, // e.g., "10-12", "30s"
    rest: String, // e.g., "60s", "90s"
    notes: String
  }]
});

const fitnessPlanSchema = new mongoose.Schema({
  planId: { type: String, required: true }, // e.g., PLAN2026010001
  name: { type: String, required: true },
  description: { type: String, required: true },
  durationWeeks: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  category: {
    type: String,
    required: true,
    enum: ['strength', 'cardio', 'weight-loss', 'muscle-gain', 'yoga', 'flexibility']
  },
  intensity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high']
  },
  targetAudience: {
    type: String,
    required: true,
    enum: ['beginner', 'intermediate', 'advanced']
  },
  workoutsPerWeek: { type: Number, required: true, min: 1, max: 7 },
  workouts: [workoutSchema], // Detailed weekly schedule
  includesDiet: { type: Boolean, default: false },
  includesTracking: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['active', 'inactive', 'draft'],
    default: 'draft'
  },
  membersEnrolled: { type: Number, default: 0 },
  imageUrl: String, // Plan thumbnail
  features: [String], // e.g., ["Progress tracking", "Video demos"]
  notes: String,
  gymId: {
    type: String,
    required: true,
    index: true
  }
}, { timestamps: true });

fitnessPlanSchema.plugin(tenantPlugin);

fitnessPlanSchema.index({ planId: 1, gymId: 1 }, { unique: true });

const FitnessPlanModel = mongoose.models.FitnessPlan || mongoose.model('FitnessPlan', fitnessPlanSchema);
const createProxyModel = require('../utils/proxyModel');
module.exports = createProxyModel(FitnessPlanModel, fitnessPlanSchema);
