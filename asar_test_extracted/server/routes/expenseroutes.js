const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createExpense, getExpensesList, getExpenseById, updateExpense, deleteExpense, getExpensesOverview } = require('../controller/expense');
const userauth = require('../middleware/userauth');
const tenantBinder = require('../middleware/tenantBinder');
const Expense = require('../models/expense').Expense;
const { generateExpenseId } = require('../utils/expenseUtils');
const { invalidateRevenue } = require('../services/cacheService');

const Router = express.Router();

// Multer setup for expense attachments
const expenseStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = "uploads/expenses/";
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname +
      "-" +
      uniqueSuffix +
      path.extname(file.originalname).toLowerCase()
    );
  },
});

const expenseUpload = multer({
  storage: expenseStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and PDF files are allowed'));
    }
  }
});

// Apply authentication middleware to all expense routes
Router.use(userauth);

// Add single expense
Router.post('/add', expenseUpload.single('attachment'), tenantBinder, createExpense);

// Add multiple expenses (for the new form)
Router.post('/add-multiple', expenseUpload.array('attachments', 10), tenantBinder, async (req, res) => {
  try {
    const { date, expenses, notes } = req.body;
    const attachments = req.files || [];

    if (!date || !expenses) {
      return res.status(400).json({ success: false, message: 'Date and expenses are required' });
    }

    const expenseArray = JSON.parse(expenses);
    const savedExpenses = [];

    const attachmentData = attachments.map(file => ({
      url: `/uploads/expenses/${file.filename}`,
      name: file.originalname
    }));

    // Add existing attachments if provided (e.g. during an edit)
    if (req.body.existingAttachments) {
      try {
        const existing = JSON.parse(req.body.existingAttachments);
        if (Array.isArray(existing)) {
          attachmentData.push(...existing);
        }
      } catch (err) {
        console.error("Error parsing existingAttachments:", err);
      }
    }

    for (let i = 0; i < expenseArray.length; i++) {
      const expenseData = expenseArray[i];
      const expenseId = await generateExpenseId(); // Await the Promise

      const expense = new Expense({
        expenseId: expenseId,
        gymId: req.user.gymId,
        title: expenseData.title || `Expense ${i + 1}`,
        category: expenseData.category,
        amount: expenseData.amount,
        gstAmount: expenseData.gstAmount || 0,
        totalWithGst: expenseData.totalWithGst || expenseData.amount,
        date: new Date(date),
        paymentMode: expenseData.paymentMode || 'cash',
        notes: expenseData.notes || notes || '',
        attachments: attachmentData
      });

      await expense.save();
      savedExpenses.push(expense);
    }

    await invalidateRevenue();

    res.json({
      success: true,
      message: 'Expenses added successfully',
      expenses: savedExpenses
    });
  } catch (error) {
    console.error('Error adding multiple expenses (Detailed):', error);
    // Log validation errors specifically
    if (error.name === 'ValidationError') {
      console.error('Validation Error Details:', JSON.stringify(error.errors, null, 2));
    }
    res.status(500).json({
      success: false,
      message: 'Error adding expenses: ' + error.message,
      error: error.message,
      details: error.errors ? JSON.stringify(error.errors) : undefined
    });
  }
});

// Get expense overview (stats)
Router.get('/overview', getExpensesOverview);

// Get all expenses with pagination and filtering
Router.get('/', getExpensesList);

// Get single expense by ID
Router.get('/:id', getExpenseById);

// Update expense
Router.put('/:id', expenseUpload.single('attachment'), tenantBinder, updateExpense);

// Delete all expenses by date
Router.delete('/delete-by-date', tenantBinder, async (req, res) => {
  try {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    // Use local time logic consistent with 'add' (which uses new Date(date))
    // Assuming date string is YYYY-MM-DD
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await Expense.deleteMany({
      gymId: req.user.gymId,
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });

    if (result.deletedCount > 0) {
      await invalidateRevenue();
      res.json({
        success: true,
        message: `Successfully deleted ${result.deletedCount} expense(s) for ${date}`
      });
    } else {
      res.json({
        success: true,
        message: `No expenses found for ${date}`
      });
    }
  } catch (error) {
    console.error('Error deleting expenses by date:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting expenses',
      error: error.message
    });
  }
});

// Delete expense
Router.delete('/:id', deleteExpense);

module.exports = Router;