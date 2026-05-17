/**
 * automationService.js
 * 
 * Contains per-gym background job functions.
 * Each function accepts a (gymId, gymName) pair and only processes
 * that gym's data inside tenantStorage.run() context.
 * 
 * These functions are triggered from the login controller so they
 * run ONLY for the gym whose admin just logged in.
 */

const tenantStorage = require('../middleware/tenantContext');
const {
    sendExpiryReminderMessage,
    sendLeadFollowUpMessage,
    sendBirthdayReminderMessage,
    sendAttendanceReminderMessage
} = require('./whatsappMessagingService.js');

// ========================================
// EXPIRY REMINDER AUTOMATION
// ========================================

/**
 * Run expiry reminder automation for a specific gym.
 * Finds Active members with endDate within 7, 3, 1 days and expired at -1, -5, -15 days.
 * @param {string} gymId
 * @param {string} gymName
 */
async function runExpiryReminderAutomation(gymId, gymName) {
    try {
        const MemberModel = require('../models/member.js');
        const SubscriptionModel = require('../models/subscription.js');

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Helper function for specific day offset
        const getOffsetDate = (days) => {
            const d = new Date(today);
            d.setDate(today.getDate() + days);
            return d;
        };

        const targetDays = [7, 3, 1, -1, -5, -15];
        const targetDates = targetDays.map(days => {
            const start = getOffsetDate(days);
            const end = new Date(start);
            end.setHours(23, 59, 59, 999);
            return { days, start, end };
        });

        await tenantStorage.run(gymId, async () => {
            const GymSettings = require('../models/GymSettings.js');
            const settings = await GymSettings.findOne({ gymId }).lean();
            if (settings?.automationToggles?.subscriptionRenewal === false) {
                console.log(`[Expiry Reminder][${gymName}] Automation is disabled in settings. Skipping.`);
                return;
            }

            let totalSentCount = 0;

            for (const target of targetDates) {
                // Find members whose endDate falls in the target date range
                const expiringMembers = await MemberModel.find({
                    status: target.days >= 0 ? 'Active' : { $in: ['Active', 'Expired'] },
                    endDate: { $gte: target.start, $lte: target.end },
                    $or: [
                        { lastExpiryReminderDate: { $exists: false } },
                        { lastExpiryReminderDate: null },
                        { lastExpiryReminderDate: { $lt: today } }
                    ]
                });

                console.log(`[Expiry Reminder][${gymName}] Found ${expiringMembers.length} members needing reminder for offset ${target.days} days`);

                for (const member of expiringMembers) {
                    const newerPlan = await SubscriptionModel.findOne({
                        memberId: member._id,
                        status: { $in: ['Active', 'Pending'] },
                        endDate: { $gt: member.endDate }
                    });

                    if (newerPlan) {
                        console.log(`[Expiry Reminder][${gymName}] Skipping ${member.fullName} - has newer active plan`);
                        continue;
                    }

                    await sendExpiryReminderMessage(member, target.days, gymId, gymName);

                    member.lastExpiryReminderDate = new Date();
                    await member.save();

                    totalSentCount++;
                    console.log(`[Expiry Reminder][${gymName}] Sent reminder for ${member.fullName} (${target.days} days left/ago)`);
                }
            }

            console.log(`[Expiry Reminder][${gymName}] Done. Sent ${totalSentCount} total reminders.`);
        });
    } catch (error) {
        console.error(`[Expiry Reminder][${gymName}] Automation error:`, error.message);
    }
}

// ========================================
// LEAD FOLLOW-UP AUTOMATION
// ========================================

/**
 * Run lead follow-up automation for a specific gym.
 * Finds leads with nextFollowUpDate <= today and haven't been reminded today.
 * @param {string} gymId
 * @param {string} gymName
 */
async function runLeadFollowUpAutomation(gymId, gymName) {
    try {
        const LeadModel = require('../models/lead.js');

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await tenantStorage.run(gymId, async () => {
            const GymSettings = require('../models/GymSettings.js');
            const settings = await GymSettings.findOne({ gymId }).lean();
            if (settings?.automationToggles?.enquiryFollowup === false) {
                console.log(`[Lead Follow-up][${gymName}] Automation is disabled in settings. Skipping.`);
                return;
            }

            const leadsToFollowUp = await LeadModel.find({
                nextFollowUpDate: { $lte: today },
                status: { $nin: ['converted', 'lost'] },
                $or: [
                    { lastFollowUpReminderDate: { $exists: false } },
                    { lastFollowUpReminderDate: null },
                    { lastFollowUpReminderDate: { $lt: today } }
                ]
            });

            console.log(`[Lead Follow-up][${gymName}] Found ${leadsToFollowUp.length} leads needing follow-up`);
            let sentCount = 0;

            for (const lead of leadsToFollowUp) {
                await sendLeadFollowUpMessage(lead, gymId, gymName);
                lead.lastFollowUpReminderDate = new Date();
                await lead.save();
                sentCount++;
                console.log(`[Lead Follow-up][${gymName}] Sent reminder for ${lead.name}`);
            }

            console.log(`[Lead Follow-up][${gymName}] Done. Sent ${sentCount} reminders.`);
        });
    } catch (error) {
        console.error(`[Lead Follow-up][${gymName}] Automation error:`, error.message);
    }
}

// ========================================
// BIRTHDAY REMINDER AUTOMATION
// ========================================

/**
 * Run birthday reminder automation for a specific gym.
 * Finds members with birthdays today and sends whatsapp message.
 * Only sends once per day per member (tracks lastBirthdayReminderDate).
 * @param {string} gymId
 * @param {string} gymName
 */
async function runBirthdayReminderAutomation(gymId, gymName) {
    try {
        const MemberModel = require('../models/member.js');

        const today = new Date();
        const currentMonth = today.getMonth() + 1; // 1-12
        const currentDay = today.getDate(); // 1-31
        today.setHours(0, 0, 0, 0);

        await tenantStorage.run(gymId, async () => {
            const GymSettings = require('../models/GymSettings.js');
            const settings = await GymSettings.findOne({ gymId }).lean();
            if (settings?.automationToggles?.birthdayWish === false) {
                console.log(`[Birthday Reminder][${gymName}] Automation is disabled in settings. Skipping.`);
                return;
            }

            const birthdayMembers = await MemberModel.aggregate([
                {
                    $addFields: {
                        dobMonth: { $month: "$dob" },
                        dobDay: { $dayOfMonth: "$dob" }
                    }
                },
                {
                    $match: {
                        gymId: gymId,
                        dobMonth: currentMonth,
                        dobDay: currentDay,
                        dob: { $ne: null },
                        $or: [
                            { lastBirthdayReminderDate: { $exists: false } },
                            { lastBirthdayReminderDate: null },
                            { lastBirthdayReminderDate: { $lt: today } }
                        ]
                    }
                }
            ]);

            console.log(`[Birthday Reminder][${gymName}] Found ${birthdayMembers.length} members with birthdays today`);
            let sentCount = 0;

            for (const memberData of birthdayMembers) {
                const member = await MemberModel.findById(memberData._id);
                if (!member) continue;

                await sendBirthdayReminderMessage(member, gymId, gymName);

                member.lastBirthdayReminderDate = new Date();
                await member.save();

                sentCount++;
                console.log(`[Birthday Reminder][${gymName}] Sent reminder for ${member.fullName || member.memberId}`);
            }

            console.log(`[Birthday Reminder][${gymName}] Done. Sent ${sentCount} birthday reminders.`);
        });
    } catch (error) {
        console.error(`[Birthday Reminder][${gymName}] Automation error:`, error.message);
    }
}

// ========================================
// ATTENDANCE ENQUIRY AUTOMATION
// ========================================

/**
 * Run attendance reminder automation for a specific gym.
 * Finds members who have been absent for a specific number of days.
 * @param {string} gymId
 * @param {string} gymName
 */
async function runAttendanceReminderAutomation(gymId, gymName) {
    try {
        const MemberModel = require('../models/member.js');
        const AttendanceModel = require('../models/attendance.js');

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const SEVEN_DAYS_AGO = new Date(today);
        SEVEN_DAYS_AGO.setDate(today.getDate() - 7);

        await tenantStorage.run(gymId, async () => {
            const GymSettings = require('../models/GymSettings.js');
            const settings = await GymSettings.findOne({ gymId }).lean();
            if (settings?.automationToggles?.attendanceAlert === false) {
                console.log(`[Attendance Reminder][${gymName}] Automation is disabled in settings. Skipping.`);
                return;
            }

            // Find all active members
            const activeMembers = await MemberModel.find({
                status: 'Active',
                $or: [
                    { lastAttendanceReminderDate: { $exists: false } },
                    { lastAttendanceReminderDate: null },
                    // Send reminder at most once every 7 days
                    { lastAttendanceReminderDate: { $lt: SEVEN_DAYS_AGO } }
                ]
            });

            console.log(`[Attendance Reminder][${gymName}] Checking ${activeMembers.length} active members`);
            let sentCount = 0;

            for (const member of activeMembers) {
                // Check their last attendance
                const lastAttendance = await AttendanceModel.findOne({
                    entityId: member.memberId,
                    type: 'member',
                    status: 'present'
                }).sort({ date: -1 });
                
                if (lastAttendance) {
                    const lastDate = new Date(lastAttendance.date);
                    const timeDiff = today.getTime() - lastDate.getTime();
                    const daysAbsent = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                    
                    // Specific threshold: exactly 5 days or exactly 10 days
                    if (daysAbsent === 5 || daysAbsent === 10) {
                        await sendAttendanceReminderMessage(member, daysAbsent, gymId, gymName);
                        member.lastAttendanceReminderDate = new Date();
                        await member.save();
                        sentCount++;
                        console.log(`[Attendance Reminder][${gymName}] Sent reminder for ${member.fullName} (${daysAbsent} days absent)`);
                    }
                }
            }

            console.log(`[Attendance Reminder][${gymName}] Done. Sent ${sentCount} reminders.`);
        });
    } catch (error) {
        console.error(`[Attendance Reminder][${gymName}] Automation error:`, error.message);
    }
}


module.exports = {
    runExpiryReminderAutomation,
    runLeadFollowUpAutomation,
    runBirthdayReminderAutomation,
    runAttendanceReminderAutomation
};
