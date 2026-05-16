// controllers/personalizedPlanController.js
const PersonalizedPlan = require('../models/personalizedPlan');
const mongoose = require('mongoose');
const { generatePersonalizedPlanId } = require('../utils/planUtils');
const cache = require('../services/cacheService');

// Save a new personalized plan
exports.savePlan = async (req, res) => {
    try {
        const {
            memberId,
            fullName,
            mobileNumber,
            age,
            gender,
            height,
            weight,
            activityLevel,
            goal,
            isVeg,
            daysPerWeek,
            tdee,
            dietPlan,
            workoutPlan,
            price,
            memberRef,
            amountPaid,
            paymentMode,
            notes
        } = req.body;

        // Validation
        if (!fullName || !mobileNumber || !age || !gender || !height || !weight || !tdee || !dietPlan || !workoutPlan) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Generate unique plan ID
        const planId = await generatePersonalizedPlanId();

        // Generate package name: Goal + Diet Type
        const dietType = (isVeg === true || isVeg === 'true') ? 'Vegetarian' : 'Non-Vegetarian';
        const packageName = `${goal} - ${dietType}`;

        const currentPaid = parseFloat(amountPaid) || 0;
        const totalPrice = parseFloat(price) || 0;

        // Determine payment status
        let paymentStatus = 'pending';
        if (currentPaid >= totalPrice && totalPrice > 0) {
            paymentStatus = 'paid';
        } else if (currentPaid > 0) {
            paymentStatus = 'partial';
        }

        // Create new personalized plan
        const newPlan = await PersonalizedPlan.create({
            gymId: req.user.gymId,
            planId,
            memberId: memberId || null,
            memberRef: memberRef || null,
            fullName,
            mobileNumber,
            age,
            gender,
            height,
            weight,
            activityLevel,
            goal,
            isVeg: isVeg === true || isVeg === 'true',
            daysPerWeek,
            tdee,
            packageName,
            membershipType: 'Fitness Plan',
            dietPlan,
            workoutPlan,
            price: totalPrice,
            amountPaid: currentPaid,
            paymentStatus,
            paymentMode: paymentMode || 'Not Paid',
            notes: notes || '',
            status: 'active',
            createdBy: req.user?.username || 'admin'
        });

        // Create Bill if payment made
        if (currentPaid > 0) {
            const Bill = require('../models/bill');
            const { generateInvoiceId } = require('../utils/invoiceUtils');
            const Member = require('../models/member');

            let memberEmail = '';
            let validMemberId = memberRef;

            // Robust Member Resolution
            if ((!validMemberId || !mongoose.Types.ObjectId.isValid(validMemberId)) && memberId) {
                console.log(`[Sync][FitnessPlan] savePlan: memberRef invalid or missing, searching by human ID: ${memberId}`);
                const member = await Member.findOne({ memberId: memberId, gymId: req.user.gymId });
                if (member) {
                    validMemberId = member._id;
                    memberEmail = member.email;
                    // Update the newly created plan to link correctly
                    newPlan.memberRef = member._id;
                    await newPlan.save();
                }
            } else if (validMemberId && mongoose.Types.ObjectId.isValid(validMemberId)) {
                const member = await Member.findOne({ _id: validMemberId, gymId: req.user.gymId });
                if (member) memberEmail = member.email;
            }

            if (validMemberId && mongoose.Types.ObjectId.isValid(validMemberId)) {
                const billData = {
                    invoiceId: await generateInvoiceId(),
                    gymId: req.user.gymId,
                    memberId: validMemberId,
                    personalizedPlanId: planId,
                    memberName,
                    memberEmail,
                    invoiceDate: new Date(),
                    dueDate: new Date(),
                    items: [{
                        description: `Fitness Plan Payment - ${packageName}`,
                        quantity: 1,
                        rate: totalPrice,
                        amount: totalPrice
                    }],
                    subtotal: totalPrice,
                    discount: 0,
                    taxRate: 0,
                    taxAmount: 0,
                    totalAmount: totalPrice,
                    paymentMode: paymentMode || 'Cash',
                    amountPaid: currentPaid,
                    balance: Math.max(0, totalPrice - currentPaid),
                    status: currentPaid >= totalPrice ? 'paid' : 'partial',
                    notes: notes || 'Initial fitness plan payment'
                };

                await Bill.create(billData);
                console.log(`[Sync][FitnessPlan] Initial bill created: ${billData.invoiceId}`);
            } else {
                console.warn(`[Sync][FitnessPlan] Could not resolve member for bill creation in savePlan. Skipping bill.`);
            }
        }

        await cache.invalidateRevenue();
        res.status(201).json({
            success: true,
            message: 'Plan saved successfully',
            plan: {
                ...newPlan.toObject(),
                balanceAmount: newPlan.price - newPlan.amountPaid
            }
        });
    } catch (error) {
        console.error('Error saving plan:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save plan',
            error: error.message
        });
    }
};

// Get all personalized plans
exports.getAllPlans = async (req, res) => {
    try {
        const { page = 1, search, status, paymentStatus, packageName } = req.query;
        // Allow limit=0 to mean "all/unlimited" (or at least don't default to 10 if 0 is explicitly passed)
        let limit = 10;
        if (req.query.limit !== undefined) {
            const parsedLimit = parseInt(req.query.limit);
            if (!isNaN(parsedLimit)) {
                limit = parsedLimit;
            }
        }

        const query = { gymId: req.user.gymId };

        if (search) {
            query.$or = [
                { planId: { $regex: search, $options: 'i' } },
                { fullName: { $regex: search, $options: 'i' } },
                { mobileNumber: { $regex: search, $options: 'i' } },
                { memberId: { $regex: search, $options: 'i' } }
            ];
        }

        if (status && status !== 'all') query.status = status;
        if (paymentStatus && paymentStatus !== 'all') query.paymentStatus = paymentStatus;
        if (packageName && packageName !== 'all') query.packageName = packageName;

        const total = await PersonalizedPlan.countDocuments(query);

        let plansQuery = PersonalizedPlan.find(query).sort({ createdAt: -1 });

        // Only apply limit/skip if limit > 0
        if (limit > 0) {
            plansQuery = plansQuery.limit(limit).skip((page - 1) * limit);
        }

        const plans = await plansQuery.select('-dietPlan -workoutPlan');

        // Fetch financial stats
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const Bill = require('../models/bill');

        const monthlyProfitAgg = await Bill.aggregate([
            { $match: { gymId: req.user.gymId, personalizedPlanId: { $ne: null }, invoiceDate: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: '$amountPaid' } } }
        ]);

        const todayProfitAgg = await Bill.aggregate([
            { $match: { gymId: req.user.gymId, personalizedPlanId: { $ne: null }, invoiceDate: { $gte: startOfToday } } },
            { $group: { _id: null, total: { $sum: '$amountPaid' } } }
        ]);

        const pendingBalanceAgg = await PersonalizedPlan.aggregate([
            { $match: { gymId: req.user.gymId } },
            { $group: { _id: null, total: { $sum: { $subtract: ['$price', '$amountPaid'] } } } }
        ]);

        res.json({
            success: true,
            plans: plans.map(p => {
                const obj = p.toObject();
                obj.balanceAmount = (parseFloat(obj.price) || 0) - (parseFloat(obj.amountPaid) || 0);
                return obj;
            }),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: limit > 0 ? Math.ceil(total / limit) : 1
            },
            financialStats: {
                monthlyProfit: monthlyProfitAgg[0]?.total || 0,
                todayProfit: todayProfitAgg[0]?.total || 0,
                totalPending: pendingBalanceAgg[0]?.total || 0
            }
        });
    } catch (error) {
        console.error('Error fetching plans:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch plans',
            error: error.message
        });
    }
};

// Get a single plan by ID
exports.getPlanById = async (req, res) => {
    try {
        const { planId } = req.params;
        const plan = await PersonalizedPlan.findOne({ planId, gymId: req.user.gymId }).populate('memberRef');

        if (!plan) {
            return res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
        }

        // Add balanceAmount and memberDatabaseId for frontend compatibility if needed
        const planObj = plan.toObject();
        planObj.balanceAmount = (parseFloat(planObj.price) || 0) - (parseFloat(planObj.amountPaid) || 0);
        if (plan.memberRef && plan.memberRef._id) {
            planObj.memberDatabaseId = plan.memberRef._id;
        }

        res.json({
            success: true,
            plan: planObj
        });
    } catch (error) {
        console.error('Error fetching plan:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch plan',
            error: error.message
        });
    }
};

// Update payment status
exports.updatePayment = async (req, res) => {
    try {
        const { planId } = req.params;
        const { amountPaid, paymentMode } = req.body;

        const plan = await PersonalizedPlan.findOne({ planId, gymId: req.user.gymId });

        if (!plan) {
            return res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
        }

        // Update payment details (increment existing amountPaid)
        plan.amountPaid += parseFloat(amountPaid) || 0;
        plan.paymentMode = paymentMode || 'Cash';

        // Determine payment status
        if (plan.amountPaid >= plan.price) {
            plan.paymentStatus = 'paid';
        } else if (plan.amountPaid > 0) {
            plan.paymentStatus = 'partial';
        } else {
            plan.paymentStatus = 'pending';
        }

        await plan.save();
        await cache.invalidateRevenue();

        res.json({
            success: true,
            message: 'Payment updated successfully',
            plan
        });
    } catch (error) {
        console.error('Error updating payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update payment',
            error: error.message
        });
    }
};

// Update plan details
exports.updatePlan = async (req, res) => {
    try {
        const { planId } = req.params;
        const updates = req.body;

        // Fetch the plan first to handle status recalculation logic
        const plan = await PersonalizedPlan.findOne({ planId, gymId: req.user.gymId });

        if (!plan) {
            return res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
        }

        // Capture old payment to detect transaction deltas
        const oldPaid = parseFloat(plan.amountPaid) || 0;

        // Apply updates manually
        console.log('Update Plan: Received updates:', updates);
        Object.keys(updates).forEach(key => {
            // Prevent overwriting planId and _id
            if (key !== 'planId' && key !== '_id') {
                plan[key] = updates[key];
            }
        });
        console.log('Update Plan: New Price set to:', plan.price);

        // RECALCULATE PAYMENT STATUS since Price might have changed
        // Ensure price and amountPaid are numbers
        const currentPrice = parseFloat(plan.price) || 0;
        const currentPaid = parseFloat(plan.amountPaid) || 0;

        // Auto-update status based on balance
        if (currentPaid >= currentPrice && currentPrice > 0) {
            plan.paymentStatus = 'paid';
        } else if (currentPaid > 0) {
            plan.paymentStatus = 'partial';
        } else {
            plan.paymentStatus = 'pending'; // Default if paid is 0
            if (currentPrice === 0) plan.paymentStatus = 'paid'; // Free plan?
        }

        // Save to trigger any middleware and persist changes
        await plan.save();

        if (!plan) {
            return res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
        }

        // SYNC BILL: Create a NEW bill record if a new payment is recorded
        const Bill = require('../models/bill');
        const { generateInvoiceId } = require('../utils/invoiceUtils');

        const paymentDelta = currentPaid - oldPaid;

        if (paymentDelta > 0) {
            console.log(`[Sync][FitnessPlan] Recording new payment transaction for ${planId}: ${paymentDelta}`);

            const Member = require('../models/member');
            let memberEmail = '';
            let validMemberId = plan.memberRef;

            // Robust Member Resolution: Ensure we have an ObjectId for the Bill
            if (!validMemberId && plan.memberId) {
                console.log(`[Sync][FitnessPlan] memberRef missing, searching by human ID: ${plan.memberId}`);
                const member = await Member.findOne({ memberId: plan.memberId, gymId: req.user.gymId });
                if (member) {
                    validMemberId = member._id;
                    memberEmail = member.email;
                    // Sync the plan record too for future updates
                    plan.memberRef = member._id;
                    await plan.save();
                }
            } else if (validMemberId && mongoose.Types.ObjectId.isValid(validMemberId)) {
                const member = await Member.findOne({ _id: validMemberId, gymId: req.user.gymId });
                if (member) memberEmail = member.email;
            }

            if (!validMemberId) {
                console.error(`[Sync][FitnessPlan] Critical: Could not resolve ObjectId for member ${plan.memberId || plan.fullName}. Aborting bill creation.`);
                return res.json({
                    success: true,
                    message: 'Plan updated but bill creation failed: Member link missing',
                    plan
                });
            }

            const totalPrice = parseFloat(plan.price) || 0;

            const billData = {
                invoiceId: await generateInvoiceId(),
                gymId: req.user.gymId,
                memberId: validMemberId,
                personalizedPlanId: plan.planId,
                memberName: plan.fullName,
                memberEmail,
                invoiceDate: new Date(),
                dueDate: new Date(),
                items: [{
                    description: `Fitness Plan Payment - ${plan.packageName}`,
                    quantity: 1,
                    rate: totalPrice,
                    amount: totalPrice
                }],
                subtotal: totalPrice,
                discount: 0,
                taxRate: 0,
                taxAmount: 0,
                totalAmount: totalPrice,
                paymentMode: updates.paymentMode || 'Cash',
                amountPaid: paymentDelta, // This specific transaction amount
                balance: Math.max(0, totalPrice - currentPaid), // Remaining balance after this payment
                notes: updates.notes || 'Additional payment',
                status: currentPaid >= totalPrice ? 'paid' : 'partial'
            };

            await Bill.create(billData);
            console.log(`[Sync][FitnessPlan] New transaction bill created: ${billData.invoiceId}`);
        } else {
            console.log(`[Sync][FitnessPlan] No payment increase detected for ${planId}.`);
        }
        await cache.invalidateRevenue();

        res.json({
            success: true,
            message: 'Plan updated successfully',
            plan
        });
    } catch (error) {
        console.error('Error updating plan:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update plan',
            error: error.message
        });
    }
};

// Delete a plan
exports.deletePlan = async (req, res) => {
    try {
        const { planId } = req.params;
        const plan = await PersonalizedPlan.findOneAndDelete({ planId, gymId: req.user.gymId });

        if (!plan) {
            return res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
        }

        await cache.invalidateRevenue();
        res.json({
            success: true,
            message: 'Plan deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting plan:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete plan',
            error: error.message
        });
    }
};

module.exports = exports;