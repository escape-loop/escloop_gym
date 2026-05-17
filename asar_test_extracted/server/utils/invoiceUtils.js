// utils/invoiceUtils.js
const Bill = require('../models/bill');
const tenantStorage = require('../middleware/tenantContext');

exports.generateInvoiceId = async () => {
  const date = new Date();
  const todayStr = date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0');

  // Find the latest invoice for today to determine the next sequence number
  // This prevents duplicates if a bill is deleted (which reduces the count but leaves higher IDs)
  const prefix = `INV${todayStr}`;

  // Find last created bill with this prefix for this specific gym
  const gymId = tenantStorage.getStore();
  const lastBill = await Bill.findOne({
    gymId,
    invoiceId: { $regex: `^${prefix}` }
  }).sort({ invoiceId: -1 });

  let nextSequence = 1;
  if (lastBill && lastBill.invoiceId) {
    const lastSequenceStr = lastBill.invoiceId.replace(prefix, '');
    const lastSequence = parseInt(lastSequenceStr, 10);
    if (!isNaN(lastSequence)) {
      nextSequence = lastSequence + 1;
    }
  }

  return `${prefix}${nextSequence.toString().padStart(4, '0')}`;
};