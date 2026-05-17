// utils/expenseUtils.js
const Expense = require('../models/expense').Expense;
const tenantStorage = require('../middleware/tenantContext');

exports.generateExpenseId = async () => {
  const date = new Date();
  const today = date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0');

  // Find the latest expense created today to determine the next sequence number
  const gymId = tenantStorage.getStore();
  const latestExpense = await Expense.findOne({
    gymId,
    expenseId: { $regex: `^EXP${today}` }
  }).sort({ expenseId: -1 });

  let count = 1;
  if (latestExpense && latestExpense.expenseId) {
    const lastSequence = parseInt(latestExpense.expenseId.slice(-4));
    if (!isNaN(lastSequence)) {
      count = lastSequence + 1;
    }
  }

  // Ensure uniqueness with a loop (double check)
  let expenseId = `EXP${today}${count.toString().padStart(4, '0')}`;
  let exists = await Expense.findOne({ gymId, expenseId });

  while (exists) {
    count++;
    expenseId = `EXP${today}${count.toString().padStart(4, '0')}`;
    exists = await Expense.findOne({ gymId, expenseId });
  }

  return expenseId;
};
