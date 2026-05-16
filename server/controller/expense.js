// controllers/expenseController.js
const Expense = require('../models/expense').Expense;
const { generateExpenseId } = require('../utils/expenseUtils');
const fs = require('fs');
const path = require('path');
const { invalidateRevenue } = require('../services/cacheService');

exports.getExpensesOverview = async (req, res) => {
  try {
    const currentMonth = new Date();
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [todayExpenses, currentMonthExpenses, monthMaintenance, monthSalary] = await Promise.all([
      Expense.aggregate([
        { $match: { gymId: req.user.gymId, date: { $gte: todayStart, $lte: todayEnd } } },
        { $group: { _id: null, total: { $sum: '$totalWithGst' } } }
      ]),
      Expense.aggregate([
        { $match: { gymId: req.user.gymId, date: { $gte: monthStart, $lte: monthEnd } } },
        { $group: { _id: null, total: { $sum: '$totalWithGst' } } }
      ]),
      Expense.aggregate([
        { $match: { gymId: req.user.gymId, date: { $gte: monthStart, $lte: monthEnd }, category: 'maintenance' } },
        { $group: { _id: null, total: { $sum: '$totalWithGst' } } }
      ]),
      Expense.aggregate([
        { $match: { gymId: req.user.gymId, date: { $gte: monthStart, $lte: monthEnd }, category: 'salaries' } },
        { $group: { _id: null, total: { $sum: '$totalWithGst' } } }
      ])
    ]);

    res.json({
      todayExpense: todayExpenses[0]?.total || 0,
      thisMonthExpense: currentMonthExpenses[0]?.total || 0,
      thisMonthMaintenance: monthMaintenance[0]?.total || 0,
      thisMonthSalary: monthSalary[0]?.total || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getExpensesList = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, category, month, paymentMode, date } = req.query;
    const query = { gymId: req.user.gymId };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { vendor: { $regex: search, $options: 'i' } },
        { expenseId: { $regex: search, $options: 'i' } }
      ];
    }
    if (category && category !== 'all') query.category = category;

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.date = { $gte: startOfDay, $lte: endOfDay };
    } else if (month && month !== 'all') {
      const startDate = new Date(month + '-01');
      const endDate = new Date(month + '-01');
      endDate.setMonth(endDate.getMonth() + 1);
      query.date = { $gte: startDate, $lt: endDate };
    }

    if (paymentMode && paymentMode !== 'all') query.paymentMode = paymentMode;

    const expenses = await Expense.find(query)
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Expense.countDocuments(query);

    res.json({
      expenses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createExpense = async (req, res) => {
  try {
    const { title, category, amount, date, vendor, paymentMode, recurring, repeatInterval, notes, gstAmount } = req.body;

    const totalWithGst = amount + (gstAmount || 0);
    const expenseId = generateExpenseId();
    const gymId = req.user.gymId;

    const expenseData = {
      expenseId,
      gymId,
      title,
      category,
      amount: parseFloat(amount),
      date: new Date(date),
      vendor,
      paymentMode,
      recurring: recurring === 'true',
      repeatInterval: recurring === 'true' ? repeatInterval : undefined,
      notes,
      gstAmount: parseFloat(gstAmount || 0),
      totalWithGst
    };

    // Handle file upload
    if (req.file) {
      expenseData.attachments = [{
        url: `/uploads/expenses/${req.file.filename}`,
        name: req.file.originalname
      }];
    }

    const expense = await Expense.create(expenseData);
    await invalidateRevenue();
    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getExpenseById = async (req, res) => {
  try {
    const expense = await Expense.findOne({ expenseId: req.params.id, gymId: req.user.gymId });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateExpense = async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (req.file) {
      // Delete old attachments if exist
      const oldExpense = await Expense.findOne({ expenseId: req.params.id, gymId: req.user.gymId });
      if (oldExpense?.attachments && oldExpense.attachments.length > 0) {
        oldExpense.attachments.forEach(attachment => {
          const oldFilePath = path.join(__dirname, '..', 'public', attachment.url);
          fs.unlink(oldFilePath, (err) => {
            if (err) console.error('Error deleting old file:', err);
          });
        });
      }
      updateData.attachments = [{
        url: `/uploads/expenses/${req.file.filename}`,
        name: req.file.originalname
      }];
    }

    updateData.totalWithGst = parseFloat(req.body.amount) + parseFloat(req.body.gstAmount || 0);

    const expense = await Expense.findOneAndUpdate(
      { expenseId: req.params.id, gymId: req.user.gymId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    
    await invalidateRevenue();
    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findOne({ expenseId: req.params.id, gymId: req.user.gymId });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    // Delete attachment files
    if (expense.attachments && expense.attachments.length > 0) {
      expense.attachments.forEach(attachment => {
        const filePath = path.join(__dirname, '..', 'public', attachment.url);
        fs.unlink(filePath, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      });
    }

    await Expense.findOneAndDelete({ expenseId: req.params.id, gymId: req.user.gymId });
    await invalidateRevenue();
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Category-wise summary
exports.getCategorySummary = async (req, res) => {
  try {
    const { month } = req.query;
    const match = { gymId: req.user.gymId };
    if (month && month !== 'all') {
      match.date = {
        $gte: new Date(month + '-01'),
        $lt: new Date(new Date(month + '-01').setMonth(new Date(month + '-01').getMonth() + 1))
      };
    }

    const summary = await Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$totalWithGst' },
          count: { $sum: 1 },
          avg: { $avg: '$totalWithGst' }
        }
      },
      { $sort: { total: -1 } }
    ]);

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};