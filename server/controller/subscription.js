const SubscriptionModel = require("../models/subscription");
const MemberModel = require("../models/member");
const Bill = require("../models/bill");
const { generateInvoiceId } = require('../utils/invoiceUtils');
const { sendNewSubscriptionMessage } = require('../services/whatsappMessagingService');
const cache = require('../services/cacheService');

// Add new subscription
const addSubscription = async (req, res) => {
    try {
        const { memberId, ...subData } = req.body;

        if (!memberId) {
            return res.json({ success: false, message: "Member ID is required" });
        }

        const member = await MemberModel.findOne({ _id: memberId, gymId: req.user.gymId });
        if (!member) {
            return res.json({ success: false, message: "Member not found" });
        }

        // Create new subscription record
        const MembershipPlanModel = require('../models/membership');
        const plan = await MembershipPlanModel.findOne({ name: subData.packageName, gymId: req.user.gymId });

        // Calculate netPayable
        let netPayable = subData.amount || 0;
        if (subData.amount) {
            let discount = 0;
            if (subData.discountType === 'percentage') {
                discount = subData.amount * (subData.discountValue / 100);
            } else {
                discount = subData.discountValue || 0;
            }
            netPayable = subData.amount - discount;
        }

        if (subData.amountPaid > netPayable) {
            return res.json({ success: false, message: `Amount paid (₹${subData.amountPaid}) cannot exceed net payable (₹${netPayable})` });
        }

        const newSubscription = new SubscriptionModel({
            memberId,
            gymId: req.user.gymId,
            ...subData,
            netPayable,
            steamSessionsTotal: subData.steamSessionsTotal || (plan ? plan.steamSessions : 0),
            ptSessionsTotal: subData.ptSessionsTotal || (plan ? plan.ptSessions : 0),
        });

        await newSubscription.save();

        // Increment currentMembers in MembershipPlan
        if (plan) {
            plan.currentMembers = (plan.currentMembers || 0) + 1;
            await plan.save();
        }

        // Update member's current subscription details
        // We update the member model to reflect the *latest* subscription info
        const updateFields = {
            packageName: subData.packageName,
            membershipType: subData.membershipType,
            duration: subData.duration,
            startDate: subData.startDate,
            endDate: subData.endDate,
            amount: subData.amount,
            discountType: subData.discountType,
            discountValue: subData.discountValue,
            amountPaid: subData.amountPaid,
            balanceAmount: subData.balanceAmount,
            netPayable,
            status: subData.status,
            // Don't necessarily update trainer on member unless we want to track 'current trainer' there too
        };

        await MemberModel.findOneAndUpdate({ _id: memberId, gymId: req.user.gymId }, updateFields);

        if (subData.amountPaid > 0) {
            const billData = {
                invoiceId: await generateInvoiceId(),
                gymId: req.user.gymId,
                memberId: memberId,
                subscriptionId: newSubscription._id,
                memberName: member.fullName,
                memberEmail: member.email,
                invoiceDate: new Date(),
                dueDate: new Date(),
                items: [{
                    description: `${subData.packageName} Subscription Payment`,
                    quantity: 1,
                    rate: netPayable,
                    amount: netPayable
                }],
                subtotal: netPayable,
                discount: 0,
                taxRate: 0,
                taxAmount: 0,
                totalAmount: netPayable,
                paymentMode: subData.paymentMode || 'Cash',
                amountPaid: subData.amountPaid,
                balance: Math.max(0, netPayable - subData.amountPaid),
                status: subData.amountPaid >= netPayable ? 'paid' : 'partial',
                notes: subData.notes || 'Initial payment'
            };

            await Bill.create(billData);
        }

        // Send webhook notification for new subscription
        // We do this non-blocking (no await) so it doesn't delay the response
        const GymSettings = require('../models/GymSettings');
        const gymSettings = await GymSettings.findOne({ gymId: req.user.gymId });
        const gymName = gymSettings ? gymSettings.gymName : 'Stretch Fitness Club';

        // Check if New Registration automation is enabled
        const isAutomationEnabled = gymSettings?.automationToggles?.newRegistration !== false;

        if (isAutomationEnabled) {
            sendNewSubscriptionMessage(member, newSubscription, req.user.gymId, gymName).catch(err => {
                console.error('[Subscription] WhatsApp Message trigger failed:', err.message);
            });
        } else {
            console.log(`[Subscription] New Registration automation is disabled for gymId: ${req.user.gymId}`);
        }

        // Invalidate caches after adding subscription
        await cache.invalidateSubscriptions();
        await cache.invalidateMembers();
        await cache.invalidateRevenue();

        res.json({
            success: true,
            message: "Subscription added successfully",
            subscription: newSubscription,
        });
    } catch (error) {
        console.error("Add subscription error:", error);
        res.json({ success: false, message: error.message });
    }
};

// Get all subscriptions for a member with aggregated bill payments
const getMemberSubscriptions = async (req, res) => {
    try {
        const { memberId } = req.params;

        // Auto-update statuses before fetching
        const { checkExpirationStatus } = require('../utils/statusUtils');
        await checkExpirationStatus(memberId);

        const subscriptions = await SubscriptionModel.find({ memberId, gymId: req.user.gymId }).sort({ startDate: -1, createdAt: -1 });

        // Calculate total amount paid from Bills for this member
        // Logic: specific subscription payment matching is complex without linking individual bills to subscription IDs.
        // For now, we will return the raw subscription 'amountPaid' (which user manually tracks) 
        // AND potentially a reference total from Bills if needed.
        // HOWEVER, user asked "amount paid field should be fetched from the bill data base".
        // If we have subscriptionId in bills, we can aggregate.

        const subscriptionsWithBills = await Promise.all(subscriptions.map(async (sub) => {
            const subObj = sub.toObject();

            // Find bills linked to this subscription (Robust query)
            const linkedBills = await Bill.find({
                gymId: req.user.gymId,
                $or: [
                    { subscriptionId: sub._id },
                    {
                        memberId: sub.memberId,
                        subscriptionId: { $exists: false },
                        personalizedPlanId: { $exists: false },
                        invoiceDate: { $gte: sub.startDate }
                    },
                    {
                        memberId: sub.memberId,
                        subscriptionId: null,
                        personalizedPlanId: null,
                        invoiceDate: { $gte: sub.startDate }
                    }
                ]
            });
            const billPaid = linkedBills.reduce((sum, bill) => sum + (bill.amountPaid || 0), 0);

            // Logic match with members listing: Use max of bill aggregate and stored amountPaid
            const totalPaid = Math.max(billPaid, subObj.amountPaid || 0);

            // Calculate net amount considering discount if netPayable is missing/zero
            let totalAmount = subObj.netPayable;
            if (!totalAmount || totalAmount === 0) {
                totalAmount = subObj.amount || 0;
                if (subObj.amount) {
                    let discount = 0;
                    if (subObj.discountType === 'percentage') {
                        discount = subObj.amount * (subObj.discountValue || 0) / 100;
                    } else {
                        discount = subObj.discountValue || 0;
                    }
                    totalAmount = subObj.amount - discount;
                }
            }

            subObj.netPayable = totalAmount;
            subObj.amountPaid = totalPaid;
            subObj.balanceAmount = Math.max(0, totalAmount - totalPaid);

            return subObj;
        }));

        res.json({
            success: true,
            subscriptions: subscriptionsWithBills,
        });
    } catch (error) {
        console.error("Get member subscriptions error:", error);
        res.json({ success: false, message: error.message });
    }
};

// Update existing subscription
const updateSubscription = async (req, res) => {
    try {
        const { id } = req.params;
        const subData = req.body;

        const subscription = await SubscriptionModel.findOne({ _id: id, gymId: req.user.gymId });
        if (!subscription) {
            return res.json({ success: false, message: "Subscription not found" });
        }

        // Capture old payment to detect transaction deltas
        const oldPaid = parseFloat(subscription.amountPaid) || 0;


        // Calculate netPayable
        let netPayable = subData.amount || subscription.amount;
        let dType = subData.discountType || subscription.discountType;
        let dVal = subData.discountValue !== undefined ? subData.discountValue : subscription.discountValue;

        if (netPayable) {
            let discount = 0;
            if (dType === 'percentage') {
                discount = netPayable * (dVal / 100);
            } else {
                discount = dVal || 0;
            }
            netPayable = netPayable - discount;
        }

        if (subData.amountPaid !== undefined && subData.amountPaid > netPayable) {
            return res.json({ success: false, message: `Amount paid (₹${subData.amountPaid}) cannot exceed net payable (₹${netPayable})` });
        }

        // --- SESSION RESET LOGIC ---
        // If the plan changed or session totals were modified, reset the "used" counts to zero.
        if (
            (subData.packageName && subData.packageName !== subscription.packageName) ||
            (subData.ptSessionsTotal !== undefined && subData.ptSessionsTotal !== subscription.ptSessionsTotal) ||
            (subData.steamSessionsTotal !== undefined && subData.steamSessionsTotal !== subscription.steamSessionsTotal)
        ) {
            subData.ptSessionsUsed = 0;
            subData.steamSessionsUsed = 0;
        }

        const updatedSubscription = await SubscriptionModel.findOneAndUpdate(
            { _id: id, gymId: req.user.gymId },
            { ...subData, netPayable, updatedAt: Date.now() },
            { new: true }
        );

        // Handle currentMembers count if package name or status changed
        const activeStatuses = ['Active', 'Pending'];
        const wasActive = activeStatuses.includes(subscription.status);
        const isActive = activeStatuses.includes(subData.status || subscription.status);

        const MembershipPlanModel = require('../models/membership');

        // Case 1: Package changed
        if (subData.packageName && subData.packageName !== subscription.packageName) {
            // Decrement old plan if it was active
            if (wasActive) {
                const oldPlan = await MembershipPlanModel.findOne({ name: subscription.packageName, gymId: req.user.gymId });
                if (oldPlan) {
                    oldPlan.currentMembers = Math.max(0, (oldPlan.currentMembers || 0) - 1);
                    await oldPlan.save();
                }
            }

            // Increment new plan if it is active
            if (isActive) {
                const newPlan = await MembershipPlanModel.findOne({ name: subData.packageName, gymId: req.user.gymId });
                if (newPlan) {
                    newPlan.currentMembers = (newPlan.currentMembers || 0) + 1;
                    await newPlan.save();
                }
            }
        }
        // Case 2: Package same, but status changed between active/inactive
        else if (wasActive !== isActive) {
            const plan = await MembershipPlanModel.findOne({ name: subscription.packageName, gymId: req.user.gymId });
            if (plan) {
                if (wasActive && !isActive) {
                    plan.currentMembers = Math.max(0, (plan.currentMembers || 0) - 1);
                } else if (!wasActive && isActive) {
                    plan.currentMembers = (plan.currentMembers || 0) + 1;
                }
                await plan.save();
            }
        }

        // If this is the latest subscription, update the Member model too.
        const latestSub = await SubscriptionModel.findOne({ memberId: subscription.memberId, gymId: req.user.gymId }).sort({ createdAt: -1 });

        if (latestSub && latestSub._id.toString() === id) {
            await MemberModel.findOneAndUpdate({ _id: subscription.memberId, gymId: req.user.gymId }, {
                packageName: subData.packageName || latestSub.packageName,
                membershipType: subData.membershipType || latestSub.membershipType,
                duration: subData.duration || latestSub.duration,
                startDate: subData.startDate || latestSub.startDate,
                endDate: subData.endDate || latestSub.endDate,
                amount: subData.amount || latestSub.amount,
                discountType: subData.discountType || latestSub.discountType,
                discountValue: subData.discountValue || latestSub.discountValue,
                amountPaid: subData.amountPaid || latestSub.amountPaid,
                balanceAmount: subData.balanceAmount || latestSub.balanceAmount,
                netPayable: netPayable || latestSub.netPayable,
                status: subData.status || latestSub.status,
            });
        }

        // SYNC BILL: Create a NEW bill record if a new payment is recorded
        const currentPaid = parseFloat(updatedSubscription.amountPaid) || 0;
        const paymentDelta = currentPaid - oldPaid;

        if (paymentDelta > 0) {
            console.log(`[Sync][Subscription] Recording new payment transaction for ${id}: ${paymentDelta}`);

            const member = await MemberModel.findOne({ _id: subscription.memberId, gymId: req.user.gymId });
            if (!member) {
                console.error(`[Sync][Subscription] Warning: Member ${subscription.memberId} not found during payment sync.`);
            }
            const billData = {
                invoiceId: await generateInvoiceId(),
                gymId: req.user.gymId,
                memberId: subscription.memberId,
                subscriptionId: subscription._id,
                memberName: member ? member.fullName : "Unknown",
                memberEmail: member ? member.email : "",
                invoiceDate: new Date(),
                dueDate: new Date(),
                items: [{
                    description: `${subData.packageName || subscription.packageName} Subscription Payment`,
                    quantity: 1,
                    rate: netPayable,
                    amount: netPayable
                }],
                subtotal: netPayable,
                discount: 0,
                taxRate: 0,
                taxAmount: 0,
                totalAmount: netPayable,
                paymentMode: subData.paymentMode || subscription.paymentMode || 'Cash',
                amountPaid: paymentDelta, // This specific transaction amount
                balance: Math.max(0, netPayable - currentPaid), // Remaining balance after this payment
                notes: subData.notes || 'Additional subscription payment',
                status: currentPaid >= netPayable ? 'paid' : 'partial'
            };

            await Bill.create(billData);
            console.log(`[Sync][Subscription] New transaction bill created: ${billData.invoiceId}`);
        } else {
            console.log(`[Sync][Subscription] No payment increase detected for ${id}.`);
        }

        // Invalidate caches after update
        await cache.invalidateSubscriptions();
        await cache.invalidateMembers();
        await cache.invalidateRevenue();

        res.json({
            success: true,
            message: "Subscription updated successfully",
            subscription: updatedSubscription,
        });
    } catch (error) {
        console.error("Update subscription error:", error);
        res.json({ success: false, message: error.message });
    }
};

// Get all subscriptions (cache-all, paginate in Node.js)
const getAllSubscriptions = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const status = req.query.status || 'all';

        // Fetch all subscriptions from cache or DB
        const allSubs = await cache.getOrSet(
            cache.KEYS.SUBSCRIPTIONS_ALL,
            async () => {
                const subs = await SubscriptionModel.find({ gymId: req.user.gymId }).sort({ startDate: -1 }).lean();
                return subs;
            },
            cache.DAY
        );

        // Filter in Node.js memory
        let filtered = allSubs;
        if (status !== 'all') {
            filtered = filtered.filter(s => s.status === status);
        }
        if (search) {
            const q = search.toLowerCase();
            filtered = filtered.filter(s =>
                (s.packageName || '').toLowerCase().includes(q) ||
                (s.membershipType || '').toLowerCase().includes(q)
            );
        }

        const total = filtered.length;
        const subscriptions = filtered.slice((page - 1) * limit, page * limit);

        res.json({
            success: true,
            subscriptions,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        console.error("Get all subscriptions error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete a subscription
const deleteSubscription = async (req, res) => {
    try {
        const { id } = req.params;
        const subscription = await SubscriptionModel.findOneAndDelete({ _id: id, gymId: req.user.gymId });

        if (!subscription) {
            return res.json({ success: false, message: "Subscription not found" });
        }

        // Decrement currentMembers in MembershipPlan if it was active
        const activeStatuses = ['Active', 'Pending'];
        if (activeStatuses.includes(subscription.status)) {
            const MembershipPlanModel = require('../models/membership');
            const plan = await MembershipPlanModel.findOne({ name: subscription.packageName, gymId: req.user.gymId });
            if (plan) {
                plan.currentMembers = Math.max(0, (plan.currentMembers || 0) - 1);
                await plan.save();
            }
        }

        // Check if we deleted the latest one; if so, sync the NEW latest one to Member model
        const latestSub = await SubscriptionModel.findOne({ memberId: subscription.memberId, gymId: req.user.gymId }).sort({ createdAt: -1 });

        if (latestSub) {
            await MemberModel.findOneAndUpdate({ _id: subscription.memberId, gymId: req.user.gymId }, {
                packageName: latestSub.packageName,
                membershipType: latestSub.membershipType,
                duration: latestSub.duration,
                startDate: latestSub.startDate,
                endDate: latestSub.endDate,
                amount: latestSub.amount,
                discountType: latestSub.discountType,
                discountValue: latestSub.discountValue,
                amountPaid: latestSub.amountPaid,
                balanceAmount: latestSub.balanceAmount,
                status: latestSub.status,
            });
        } else {
            // No subscriptions left? Clear member subscription data (or keep last known? clearing is safer)
            // Or maybe set status to 'Inactive'
            await MemberModel.findOneAndUpdate({ _id: subscription.memberId, gymId: req.user.gymId }, {
                packageName: null,
                status: 'Inactive'
            });
        }

        // Invalidate caches after update
        await cache.invalidateSubscriptions();
        await cache.invalidateMembers();
        await cache.invalidateRevenue();

        res.json({ success: true, message: "Subscription deleted successfully" });
    } catch (error) {
        console.error("Delete subscription error:", error);
        res.json({ success: false, message: error.message });
    }
};

module.exports = {
    addSubscription,
    getMemberSubscriptions,
    getAllSubscriptions,
    updateSubscription,
    deleteSubscription
};