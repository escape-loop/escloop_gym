// controllers/billController.js
const Bill = require('../models/bill');
const Member = require('../models/member');
const GymSettings = require('../models/GymSettings');
const { generateInvoiceId } = require('../utils/invoiceUtils');
const { jsPDF } = require('jspdf');
// jspdf-autotable export format can vary by version/env, safely handle default
const autoTableModule = require('jspdf-autotable');
const autoTable = autoTableModule.default || autoTableModule;
const fs = require('fs');
const path = require('path');
const { sendInvoiceMessage } = require('../services/whatsappMessagingService');
const { invalidateRevenue } = require('../services/cacheService');
const { generateInvoicePDF } = require('../utils/pdfUtils');

exports.getBillsOverview = async (req, res) => {
  try {
    const totalRevenue = await Bill.aggregate([
      { $match: { gymId: req.user.gymId, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const outstanding = await Bill.aggregate([
      { $match: { gymId: req.user.gymId, status: { $in: ['due', 'partial', 'overdue'] } } },
      { $group: { _id: null, total: { $sum: '$balance' } } }
    ]);

    // Calculate This Month's Revenue (based on invoiceDate or updatedAt? invoiceDate seems better)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const revenueThisMonth = await Bill.aggregate([
      {
        $match: {
          gymId: req.user.gymId,
          invoiceDate: { $gte: startOfMonth }
          // We count amountPaid for bills created/invoiced this month. 
          // Note: If partial payment happens later, it updates amountPaid. 
          // Ideally we track transactions, but for now sum(amountPaid) of bills in this month is a good approx,
          // OR sum(amountPaid) of ALL bills where payment happened this month?
          // The previous frontend logic was: bills.reduce ... if isCurrentMonth(b.invoiceDate) -> sum + b.amountPaid.
          // So it sums amountPaid for bills DATED this month.
        }
      },
      { $group: { _id: null, total: { $sum: '$amountPaid' } } }
    ]);


    const recentBills = await Bill.find({ gymId: req.user.gymId, createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('memberId', 'fullName memberId');

    res.json({
      revenue: totalRevenue[0]?.total || 0,
      outstanding: outstanding[0]?.total || 0,
      revenueThisMonth: revenueThisMonth[0]?.total || 0,
      totalBills: await Bill.countDocuments({ gymId: req.user.gymId }),
      recentBills
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getBillsList = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { search, status, memberId, subscriptionId } = req.query;
    const query = { gymId: req.user.gymId };

    if (search) {
      query.$or = [
        { invoiceId: { $regex: search, $options: 'i' } },
        { memberName: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) query.status = status;
    if (memberId) query.memberId = memberId;
    if (subscriptionId) query.subscriptionId = subscriptionId;
    if (req.query.personalizedPlanId) query.personalizedPlanId = req.query.personalizedPlanId;

    const bills = await Bill.find(query)
      .populate('memberId', 'fullName memberId email status phone')
      .sort({ invoiceDate: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await Bill.countDocuments(query);

    res.json({
      success: true,
      bills,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createBill = async (req, res) => {
  try {
    const { memberId, subscriptionId, personalizedPlanId, invoiceDate, dueDate, items, discount, taxRate, paymentMode, amountPaid, notes } = req.body;

    // Validate member exists
    const member = await Member.findOne({ _id: memberId, gymId: req.user.gymId });
    if (!member) return res.status(404).json({ error: 'Member not found' });

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const discountAmount = subtotal * (discount / 100);
    const taxable = subtotal - discountAmount;
    const taxAmount = taxable * (taxRate / 100);
    const totalAmount = taxable + taxAmount;

    if (amountPaid > totalAmount) {
      return res.status(400).json({ error: `Amount paid (₹${amountPaid}) cannot exceed Total Amount (₹${totalAmount})` });
    }

    const balance = totalAmount - amountPaid;

    const billData = {
      invoiceId: await generateInvoiceId(),
      gymId: req.user.gymId,
      memberId,
      subscriptionId: subscriptionId || null, // Link to subscription if provided
      personalizedPlanId: personalizedPlanId || null, // Link to personalized plan if provided
      memberName: member.fullName,
      memberEmail: member.email,
      invoiceDate: new Date(invoiceDate),
      dueDate: new Date(dueDate),
      items,
      subtotal,
      discount,
      taxRate,
      taxAmount,
      totalAmount,
      paymentMode,
      amountPaid,
      balance,
      notes,
      status: balance === 0 ? 'paid' : balance < totalAmount ? 'partial' : 'due'
    };

    const bill = await Bill.create(billData);
    await bill.populate('memberId');
    // Populate subscription/plan before generating PDF so details are available in the PDF
    if (bill.subscriptionId) {
      await bill.populate('subscriptionId');
    }
    if (bill.personalizedPlanId) {
      await bill.populate('personalizedPlan');
    }

    // Generate PDF (now with populated subscription data)
    const pdfUrl = await generateInvoicePDF(bill);
    bill.pdfUrl = pdfUrl;
    await bill.save();

    // Fetch gym settings for whatsapp message
    const gymSettings = await GymSettings.findOne({ gymId: req.user.gymId });
    const gymName = gymSettings?.gymName || 'Gym';

    // Send invoice whatsapp message (non-blocking)
    const isAutomationEnabled = gymSettings?.automationToggles?.paymentReceipt !== false;

    if (isAutomationEnabled) {
      try {
        const fullPdfPath = path.join(__dirname, '..', 'public', pdfUrl.replace('/public/', ''));
        if (fs.existsSync(fullPdfPath)) {
          const pdfBase64 = fs.readFileSync(fullPdfPath).toString('base64');
          sendInvoiceMessage(bill, member, pdfBase64, req.user.gymId).catch(err => {
            console.warn('[WhatsApp][Warning] Invoice message triggering error:', err.message);
          });
        }
      } catch (e) {
        console.error('[WhatsApp] Error reading PDF for WhatsApp:', e.message);
      }
    } else {
      console.log(`[Bill] Payment Receipt automation is disabled for gymId: ${req.user.gymId}`);
    }

    // Check for immediate activation if fully paid
    // Update Subscription Balance & Check for Activation
    // Fix: Ensure we don't update Subscription if this is a Fitness Plan bill (even if subscriptionId is present)
    if (subscriptionId && !personalizedPlanId) {
      const Subscription = require('../models/subscription');
      const { updateMemberStatus } = require('../utils/statusUtils');

      const sub = await Subscription.findOne({ _id: subscriptionId, gymId: req.user.gymId });
      if (sub) {
        // Incrementally update amountPaid based on this bill's payment
        // NOTE: We do NOT recalculate from all bills to preserve imported data balance
        sub.amountPaid = (sub.amountPaid || 0) + (amountPaid || 0);

        const netPayable = sub.netPayable || sub.amount || 0;
        sub.balanceAmount = Math.max(0, netPayable - sub.amountPaid);

        // Auto-activate if pending and payment received
        if (sub.status === 'Pending' && sub.amountPaid > 0) {
          sub.status = 'Active';
        }

        await sub.save();

        // Sync to Member
        await Member.findOneAndUpdate({ _id: memberId, gymId: req.user.gymId }, {
          amountPaid: sub.amountPaid,
          balanceAmount: sub.balanceAmount,
          netPayable: netPayable
        });

        await updateMemberStatus(memberId);
      }
    }

    // Sync Fitness Plan balance if linked
    if (personalizedPlanId) {
      const PersonalizedPlan = require('../models/personalizedPlan');
      const plan = await PersonalizedPlan.findOne({ planId: personalizedPlanId, gymId: req.user.gymId });
      if (plan) {
        // Incrementally update amountPaid based on this bill's payment
        // Preserves imported data balance
        plan.amountPaid = (plan.amountPaid || 0) + (amountPaid || 0);
        console.log(`[Sync][FitnessPlan] Plan: ${plan.planId}, New Total Paid: ${plan.amountPaid}`);

        // Determine payment status
        if (plan.amountPaid >= plan.price) {
          plan.paymentStatus = 'paid';
        } else if (plan.amountPaid > 0) {
          plan.paymentStatus = 'partial';
        } else {
          plan.paymentStatus = 'pending';
        }

        console.log(`[Sync][FitnessPlan] New Status: ${plan.paymentStatus}`);
        plan.paymentMode = paymentMode || 'Cash';
        await plan.save();
      }
    }

    await invalidateRevenue();
    res.status(201).json(bill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getBillById = async (req, res) => {
  try {
    const bill = await Bill.findOne({ invoiceId: req.params.id, gymId: req.user.gymId })
      .populate('memberId', 'fullName memberId email phone packageName')
      .populate('subscriptionId', 'startDate endDate duration membershipType packageName amount discountType discountValue amountPaid')
      .populate({ path: 'personalizedPlan', select: 'packageName price amountPaid paymentStatus' });
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    // Calculate Already Paid amount for this specific bill context
    // Logic: Total Paid (Source of Truth) - Amount Paid in THIS bill - Amount Paid in FUTURE bills
    let alreadyPaid = 0;

    // 1. Get Base Total Paid from Subscription or Plan
    let totalSourcePaid = 0;
    let hasSourceOfTruth = false;

    // Prioritize Plan (Fitness Plan bills should reflect plan payments only)
    if (bill.personalizedPlan && bill.personalizedPlan.amountPaid !== undefined) {
      totalSourcePaid = bill.personalizedPlan.amountPaid;
      hasSourceOfTruth = true;
    } else if (bill.subscriptionId && bill.subscriptionId.amountPaid !== undefined) {
      totalSourcePaid = bill.subscriptionId.amountPaid;
      hasSourceOfTruth = true;
    }

    if (hasSourceOfTruth) {
      // 2. Find all bills created AFTER this one for the same sub/plan
      const futureBills = await Bill.find({
        gymId: req.user.gymId,
        $or: [
          { subscriptionId: bill.subscriptionId ? bill.subscriptionId._id : null, subscriptionId: { $ne: null } },
          { personalizedPlanId: bill.personalizedPlanId, personalizedPlanId: { $ne: null } }
        ],
        _id: { $ne: bill._id },
        createdAt: { $gt: bill.createdAt }
      });

      const futurePaid = futureBills.reduce((sum, b) => sum + (b.amountPaid || 0), 0);

      // 3. Calculate snapshot
      alreadyPaid = Math.max(0, totalSourcePaid - (bill.amountPaid || 0) - futurePaid);
    } else {
      // Fallback: Sum previous bills
      const previousBills = await Bill.find({
        gymId: req.user.gymId,
        $or: [
          { subscriptionId: bill.subscriptionId ? bill.subscriptionId._id : null, subscriptionId: { $ne: null } },
          { personalizedPlanId: bill.personalizedPlanId, personalizedPlanId: { $ne: null } }
        ],
        _id: { $ne: bill._id },
        createdAt: { $lt: bill.createdAt }
      });
      alreadyPaid = previousBills.reduce((sum, prev) => sum + (prev.amountPaid || 0), 0);
    }

    // Convert to plain object to add the field
    const billObj = bill.toObject();
    billObj.alreadyPaid = alreadyPaid;

    res.json(billObj);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateBill = async (req, res) => {
  try {
    const { amountPaid, paymentMode, notes, items, discount, taxRate, invoiceDate, dueDate } = req.body;
    const bill = await Bill.findOne({ invoiceId: req.params.id, gymId: req.user.gymId });
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    // 1. REVERT old payment impact
    // We need to 'undo' the previous amountPaid from the subscription/plan/member
    const oldAmountPaid = bill.amountPaid || 0;

    // We also need to recalculate the Total Amount because items/discount might have changed
    // Calculate new totals from request body (or keep existing if not provided)
    const newItems = items || bill.items;
    const newSubtotal = newItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const newDiscount = discount !== undefined ? discount : bill.discount;
    const newTaxRate = taxRate !== undefined ? taxRate : bill.taxRate;

    const discountAmount = newSubtotal * (newDiscount / 100);
    const taxable = newSubtotal - discountAmount;
    const taxAmount = taxable * (newTaxRate / 100);
    const newTotalAmount = taxable + taxAmount;

    // Validate new payment
    const newAmountPaid = amountPaid !== undefined ? amountPaid : oldAmountPaid;
    if (newAmountPaid > newTotalAmount) {
      return res.status(400).json({ error: `Amount paid (₹${newAmountPaid}) cannot exceed Total Amount (₹${newTotalAmount})` });
    }

    // Update Bill Fields
    bill.items = newItems;
    bill.subtotal = newSubtotal;
    bill.discount = newDiscount;
    bill.taxRate = newTaxRate;
    bill.taxAmount = taxAmount;
    bill.totalAmount = newTotalAmount;
    bill.amountPaid = newAmountPaid;
    bill.paymentMode = paymentMode || bill.paymentMode;
    bill.notes = notes !== undefined ? notes : bill.notes;
    if (invoiceDate) bill.invoiceDate = new Date(invoiceDate);
    if (dueDate) bill.dueDate = new Date(dueDate);

    bill.balance = newTotalAmount - newAmountPaid;
    bill.status = bill.balance === 0 ? 'paid' : bill.balance < newTotalAmount ? 'partial' : 'due';

    // 2. APPLY new payment impact (Net Change)
    // Net Change = New Paid - Old Paid
    // If Net Change is positive, we paid more. If negative, we paid less (refund/correction).
    const netPaymentChange = newAmountPaid - oldAmountPaid;

    const subscriptionId = bill.subscriptionId;
    const personalizedPlanId = bill.personalizedPlanId;

    // Sync Member and Subscription balance/netPayable
    if (subscriptionId && !personalizedPlanId) {
      const Subscription = require('../models/subscription');
      const { updateMemberStatus } = require('../utils/statusUtils');

      const sub = await Subscription.findOne({ _id: subscriptionId, gymId: req.user.gymId });
      if (sub) {
        sub.amountPaid = (sub.amountPaid || 0) + netPaymentChange;
        const netPayable = sub.netPayable || sub.amount || 0;
        sub.balanceAmount = Math.max(0, netPayable - sub.amountPaid);

        if (sub.status === 'Pending' && sub.amountPaid > 0) {
          sub.status = 'Active';
        }
        await sub.save();

        // Sync Member
        await Member.findOneAndUpdate({ _id: bill.memberId, gymId: req.user.gymId }, {
          $inc: { amountPaid: netPaymentChange, balanceAmount: -netPaymentChange } // Decrease balance by net paid increase
        });
        await updateMemberStatus(bill.memberId);
      }
    }

    // Sync Fitness Plan balance if linked
    if (personalizedPlanId) {
      const PersonalizedPlan = require('../models/personalizedPlan');
      const plan = await PersonalizedPlan.findOne({ planId: personalizedPlanId, gymId: req.user.gymId });
      if (plan) {
        plan.amountPaid = (plan.amountPaid || 0) + netPaymentChange;

        if (plan.amountPaid >= plan.price) {
          plan.paymentStatus = 'paid';
        } else if (plan.amountPaid > 0) {
          plan.paymentStatus = 'partial';
        } else {
          plan.paymentStatus = 'pending';
        }

        // Also update Member balance/paid for Fitness Plans to keep member stats accurate
        // (Assuming fitness plans also contribute to member total stats)
        await Member.findOneAndUpdate({ _id: bill.memberId, gymId: req.user.gymId }, {
          $inc: { amountPaid: netPaymentChange, balanceAmount: -netPaymentChange }
        });

        await plan.save();
      }
    }

    // If no subscription/plan linked, just update member stats directly
    if (!subscriptionId && !personalizedPlanId) {
      await Member.findOneAndUpdate({ _id: bill.memberId, gymId: req.user.gymId }, {
        $inc: { amountPaid: netPaymentChange }
        // Note: General payments might not have a specific 'balanceAmount' to target without a sub, 
        // but usually we want to track total revenue from them.
      });
    }

    await bill.save();

    // Re-generate PDF with new details
    const pdfUrl = await generateInvoicePDF(bill);
    bill.pdfUrl = pdfUrl;
    await bill.save();

    await bill.populate('memberId');
    await invalidateRevenue();
    res.json(bill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateBillPayment = async (req, res) => {
  try {
    const { amountPaid, paymentMode } = req.body;
    const bill = await Bill.findOne({ invoiceId: req.params.id, gymId: req.user.gymId });
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    if (bill.amountPaid + amountPaid > bill.totalAmount) {
      return res.status(400).json({ error: `Cumulative payment (₹${bill.amountPaid + amountPaid}) would exceed Total Amount (₹${bill.totalAmount})` });
    }

    // This handles incremental payment (partial payment)
    bill.amountPaid += amountPaid;
    bill.paymentMode = paymentMode || bill.paymentMode;
    bill.balance = bill.totalAmount - bill.amountPaid;
    bill.status = bill.balance === 0 ? 'paid' : bill.balance < bill.totalAmount ? 'partial' : 'due';

    const subscriptionId = bill.subscriptionId;
    const personalizedPlanId = bill.personalizedPlanId;

    // Sync Member and Subscription balance/netPayable (ANY payment update)
    if (subscriptionId && !personalizedPlanId) {
      const Subscription = require('../models/subscription');
      const { updateMemberStatus } = require('../utils/statusUtils');

      const sub = await Subscription.findOne({ _id: subscriptionId, gymId: req.user.gymId });
      if (sub) {
        // Incrementally update amountPaid based on the NEW payment coming in
        const paymentIncrement = amountPaid || 0;

        sub.amountPaid = (sub.amountPaid || 0) + paymentIncrement;

        const netPayable = sub.netPayable || sub.amount || 0;
        sub.balanceAmount = Math.max(0, netPayable - sub.amountPaid);

        if (sub.status === 'Pending' && sub.amountPaid > 0) {
          sub.status = 'Active';
        }

        await sub.save();

        await Member.findOneAndUpdate({ _id: bill.memberId, gymId: req.user.gymId }, {
          amountPaid: sub.amountPaid,
          balanceAmount: sub.balanceAmount,
          netPayable: netPayable
        });
        await updateMemberStatus(bill.memberId);
      }
    }

    // Sync Fitness Plan balance if linked
    if (personalizedPlanId) {
      const PersonalizedPlan = require('../models/personalizedPlan');
      const plan = await PersonalizedPlan.findOne({ planId: personalizedPlanId, gymId: req.user.gymId });
      if (plan) {
        const paymentIncrement = amountPaid || 0;
        plan.amountPaid = (plan.amountPaid || 0) + paymentIncrement;
        if (plan.amountPaid >= plan.price) {
          plan.paymentStatus = 'paid';
        } else if (plan.amountPaid > 0) {
          plan.paymentStatus = 'partial';
        } else {
          plan.paymentStatus = 'pending';
        }
        await plan.save();
      }
    }

    await bill.save();
    await bill.populate('memberId');
    await invalidateRevenue();
    res.json(bill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteBill = async (req, res) => {
  try {
    const bill = await Bill.findOne({ invoiceId: req.params.id, gymId: req.user.gymId });
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const amountToRevert = bill.amountPaid || 0;
    const subscriptionId = bill.subscriptionId;
    const personalizedPlanId = bill.personalizedPlanId;

    // 1. Revert from Subscription
    if (subscriptionId && !personalizedPlanId) {
      const Subscription = require('../models/subscription');
      const { updateMemberStatus } = require('../utils/statusUtils');

      const sub = await Subscription.findOne({ _id: subscriptionId, gymId: req.user.gymId });
      if (sub) {
        sub.amountPaid = Math.max(0, (sub.amountPaid || 0) - amountToRevert);
        const netPayable = sub.netPayable || sub.amount || 0;
        sub.balanceAmount = netPayable - sub.amountPaid;

        // Revert status if needed (optional logic, but if they paid 0 effectively, maybe pending?)
        if (sub.status === 'Active' && sub.amountPaid === 0) {
          // Maybe keep active if time based? or revert to pending? 
          // Usually safe to leave as Active unless strictly payment based activation.
          // Leaving as is for safety, or set to Pending if strict.
        }

        await sub.save();

        // Sync Member
        await Member.findOneAndUpdate({ _id: bill.memberId, gymId: req.user.gymId }, {
          $inc: { amountPaid: -amountToRevert, balanceAmount: amountToRevert }
        });
        await updateMemberStatus(bill.memberId);
      }
    }

    // 2. Revert from Fitness Plan
    if (personalizedPlanId) {
      const PersonalizedPlan = require('../models/personalizedPlan');
      const plan = await PersonalizedPlan.findOne({ planId: personalizedPlanId, gymId: req.user.gymId });
      if (plan) {
        plan.amountPaid = Math.max(0, (plan.amountPaid || 0) - amountToRevert);

        if (plan.amountPaid >= plan.price) {
          plan.paymentStatus = 'paid';
        } else if (plan.amountPaid > 0) {
          plan.paymentStatus = 'partial';
        } else {
          plan.paymentStatus = 'pending';
        }

        // Also revert Member stats for plan payments
        await Member.findOneAndUpdate({ _id: bill.memberId, gymId: req.user.gymId }, {
          $inc: { amountPaid: -amountToRevert, balanceAmount: amountToRevert }
        });

        await plan.save();
      }
    }

    // 3. Revert from Member (General Payment) if no sub/plan
    if (!subscriptionId && !personalizedPlanId) {
      await Member.findOneAndUpdate({ _id: bill.memberId, gymId: req.user.gymId }, {
        $inc: { amountPaid: -amountToRevert }
      });
    }

    // 4. Delete the bill
    await Bill.deleteOne({ _id: bill._id });

    await invalidateRevenue();
    res.json({ success: true, message: 'Bill deleted and amounts reverted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.generateInvoicePDF = async (req, res) => {
  try {
    const bill = await Bill.findOne({ invoiceId: req.params.id, gymId: req.user.gymId })
      .populate('memberId')
      .populate('personalizedPlan')
      .populate('subscriptionId'); // Ensure this is also populated for consistency
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const pdfUrl = await generateInvoicePDF(bill);
    const fullPdfPath = path.join(__dirname, '..', 'public', pdfUrl.replace('/public/', ''));
    if (!fs.existsSync(fullPdfPath)) return res.status(404).json({ error: 'PDF not generated properly' });

    const pdfBuffer = fs.readFileSync(fullPdfPath);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${bill.invoiceId}.pdf"`
    });
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};