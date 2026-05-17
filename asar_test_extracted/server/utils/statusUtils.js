const Subscription = require('../models/subscription');
const Member = require('../models/member');
const tenantStorage = require('../middleware/tenantContext');

/**
 * Checks and updates status for expired subscriptions
 * @param {string} memberId - Optional: check only for specific member
 */
exports.checkExpirationStatus = async (memberId = null) => {
    try {
        const gymId = tenantStorage.getStore();
        if (!gymId) {
            console.warn('[StatusUtils] checkExpirationStatus called without gymId context. Failsafe activated.');
            return;
        }

        const query = { status: 'Active', gymId };
        if (memberId) query.memberId = memberId;

        const activeSubscriptions = await Subscription.find(query);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const MembershipPlanModel = require('../models/membership');

        for (const sub of activeSubscriptions) {
            if (new Date(sub.endDate) < today) {
                sub.status = 'Expired';
                await sub.save();

                // Decrement currentMembers in MembershipPlan
                if (sub.packageName) {
                    const plan = await MembershipPlanModel.findOne({ name: sub.packageName, gymId });
                    if (plan) {
                        plan.currentMembers = Math.max(0, (plan.currentMembers || 0) - 1);
                        await plan.save();
                    }
                }

                // Update Member status if this is their latest subscription
                await exports.updateMemberStatus(sub.memberId);
            }
        }
    } catch (error) {
        console.error('Error in checkExpirationStatus:', error);
    }
};

/**
 * Updates member status based on their subscriptions
 * @param {string} memberId 
 */
exports.updateMemberStatus = async (memberId) => {
    try {
        const gymId = tenantStorage.getStore();
        if (!gymId) return;

        const subscriptions = await Subscription.find({ memberId, gymId });
        const member = await Member.findOne({ _id: memberId, gymId });

        if (!member) return;

        // Logic: 
        // 1. If ANY subscription is Active, Member is Active.
        // 2. If NO Active subs, but has Expired ones, Member is Expired.
        // 3. Otherwise Pending (or keep as is).

        const hasActive = subscriptions.some(s => s.status === 'Active');
        const hasExpired = subscriptions.some(s => s.status === 'Expired');

        if (hasActive) {
            member.status = 'Active';
        } else if (hasExpired) {
            member.status = 'Expired';
        }
        // If neither (e.g. only Pending), we might leave it or set to Pending.
        // Preserving 'Cancelled' or 'Hold' requires more logic, keeping it simple for now.

        await member.save();
    } catch (error) {
        console.error('Error updating member status:', error);
    }
};
