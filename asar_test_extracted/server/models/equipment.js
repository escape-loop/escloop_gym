const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const equipmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: false,
    enum: ['cardio', 'strength', 'free-weights', 'machines', 'accessories', 'functional']
  },
  brand: {
    type: String,
    required: false,
    trim: true
  },
  model: {
    type: String,
    required: false,
    trim: true
  },
  serialNumbers: [{
    type: String,
    required: false
  }],
  statuses: [{
    type: String,
    required: false,
    enum: ['available', 'in-use', 'maintenance', 'repair', 'retired']
  }],
  purchaseDate: {
    type: Date,
    required: false
  },
  unitPrice: {
    type: Number,
    required: false,
    min: 0
  },
  quantity: {
    type: Number,
    required: false,
    min: 1
  },
  totalPrice: {
    type: Number,
    required: false,
    min: 0
  },
  maintenanceSchedule: {
    type: Date,
    required: true
  },
  lastServiced: {
    type: Date
  },
  maintenanceDays: {
    type: Number,
    required: true,
    enum: [7, 15, 30, 60, 90, 180, 365]
  },
  warrantyExpiry: {
    type: Date
  },
  serviceContactNumber: {
    type: String,
    required: false,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },

  // Multi-Tenancy
  gymId: { type: String, required: true, index: true },
});

// Update the updatedAt field before saving
equipmentSchema.pre('save', function () {
  this.updatedAt = new Date();
});

// Apply RLS plugin
equipmentSchema.plugin(tenantPlugin);

const EquipmentModel = mongoose.models.Equipment || mongoose.model('Equipment', equipmentSchema);
const createProxyModel = require('../utils/proxyModel');
module.exports = createProxyModel(EquipmentModel, equipmentSchema);