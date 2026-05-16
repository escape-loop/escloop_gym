// models/Expense.js
const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');
const multer = require('multer');
const path = require('path');

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/expenses/';
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `EXP-${Date.now()}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only images and PDFs allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const expenseSchema = new mongoose.Schema({
  expenseId: { type: String, required: true }, // EXP2026010001
  title: { type: String, required: true },
  category: {
    type: String,
    required: true,
    enum: ['utilities', 'rent', 'salaries', 'maintenance', 'supplies', 'marketing', 'equipment', 'subscriptions', 'miscellaneous']
  },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, required: true },
  vendor: String,
  paymentMode: {
    type: String,
    enum: ['cash', 'bank-transfer', 'upi', 'card', 'cheque'],
    default: 'cash'
  },
  recurring: { type: Boolean, default: false },
  repeatInterval: {
    type: String,
    enum: ['weekly', 'bi-weekly', 'monthly', 'quarterly', 'yearly']
  },
  attachments: [{
    url: String,
    name: String
  }],
  notes: String,
  gstAmount: { type: Number, default: 0 }, // For GST tracking
  totalWithGst: { type: Number, required: true },
  gymId: { type: String, required: true, index: true }, // Multi-Tenancy
}, { timestamps: true });

// Index for efficient filtering
expenseSchema.index({ category: 1, date: -1 });
expenseSchema.index({ date: -1 });
expenseSchema.index({ recurring: 1 });
expenseSchema.index({ expenseId: 1, gymId: 1 }, { unique: true });

// Apply RLS plugin
expenseSchema.plugin(tenantPlugin);

const createProxyModel = require('../utils/proxyModel');
module.exports = { 
    Expense: createProxyModel(mongoose.model('Expense', expenseSchema), expenseSchema), 
    upload 
};
