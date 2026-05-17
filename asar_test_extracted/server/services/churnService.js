const mongoose = require('mongoose');
const Member = require('../models/member');
const Attendance = require('../models/attendance');
const tenantStorage = require('../middleware/tenantContext');

/**
 * Rule-based churn scoring + prediction.
 * 
 * Inputs and logic provided by user.
 */
function predictChurn({
    distanceKm,
    tenureMonths,
    contractLength,
    visitsLast7D,
    avgGapDays,
    hasPersonalTrainer
}) {
    let score = 0;

    // 1) Distance
    // If distance > 20 → +3
    if (distanceKm > 20) {
        score += 3;
    }

    // 2) Tenure months
    if (tenureMonths < 6) {
        score -= 2;
    } else if (tenureMonths > 6 && tenureMonths <= 10) {
        score -= 1;
    } else if (tenureMonths > 10 && tenureMonths < 12) {
        score += 1;
    } else if (tenureMonths >= 12) {
        score += 2;
    }

    // 3) Contract length
    // <4 months → less likely to churn → -1
    // >=4       → more likely to churn → +1
    if (contractLength < 4) {
        score -= 1;
    } else {
        score += 1;
    }

    // 4) Visits last 7 days:
    if (visitsLast7D > 7) {
        score -= 3;
    } else if (visitsLast7D > 5) {
        score -= 2;
    } else if (visitsLast7D > 4) {
        score -= 1;
    } else if (visitsLast7D < 2) {
        score += 2;
    } else if (visitsLast7D < 4) {
        score += 1;
    }

    // 5) Avg day gap:
    if (avgGapDays < 3) {
        score += 1;
    } else if (avgGapDays === 3) {
        score += 0;
    } else if (avgGapDays > 3) {
        score += 1;
    }

    // 6) Personal training
    if (hasPersonalTrainer === 1) {
        score -= 2;
    } else {
        score += 1;
    }

    // --- Convert score to label and percentage ---
    const MIN_SCORE = -8;
    const MAX_SCORE = 10;

    // Normalize to 0–1
    let normalized = (score - MIN_SCORE) / (MAX_SCORE - MIN_SCORE);
    if (normalized < 0) normalized = 0;
    if (normalized > 1) normalized = 1;

    // Treat normalized score as churn probability
    const probability = normalized;

    // Thresholds:
    // > 0.75 -> High Risk
    // > 0.50 -> At Risk
    // <= 0.50 -> Safe
    let status = "Safe";
    if (probability > 0.75) {
        status = "High Risk";
    } else if (probability > 0.5) {
        status = "At Risk";
    }

    return {
        score,
        probability,
        status
    };
}

/**
 * Calculates tenure in months between two dates
 */
const calculateTenureMonths = (createdAt) => {
    const start = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now - start);
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
    return diffMonths;
};

/**
 * Gets visit count in the last 7 days
 */
const getVisitsLast7Days = async (memberMobile, attendanceId) => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const count = await Attendance.countDocuments({
        $or: [{ mobile: memberMobile }, { entityId: attendanceId }],
        date: { $gte: sevenDaysAgo },
        status: 'present'
    });

    return count;
};

/**
 * Calculates average gap days in last 15 days
 */
const getAvgGapDays = async (memberMobile, attendanceId) => {
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

    const attendances = await Attendance.find({
        $or: [{ mobile: memberMobile }, { entityId: attendanceId }],
        date: { $gte: fifteenDaysAgo },
        status: 'present'
    }).sort({ date: 1 }); // Oldest first

    if (attendances.length <= 1) {
        return 7.5; // Arbitrary fallback
    }

    let totalGap = 0;
    for (let i = 1; i < attendances.length; i++) {
        const date1 = new Date(attendances[i - 1].date);
        const date2 = new Date(attendances[i].date);
        const diffTime = Math.abs(date2 - date1);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        totalGap += diffDays;
    }
    return parseFloat((totalGap / (attendances.length - 1)).toFixed(2));
};

/**
 * Run churn analysis for a specific gym.
 * @param {string} gymId
 * @param {string} gymName
 */
const runChurnAnalysis = async (gymId, gymName = 'Unknown Gym') => {
    try {
        console.log(`--- [Churn] Starting analysis for gym: ${gymName} ---`);

        await tenantStorage.run(gymId, async () => {
            // 1. Get Active Members (tenantPlugin auto-scopes to this gymId)
            const members = await Member.find({ status: 'Active' });
            console.log(`[Churn][${gymName}] Found ${members.length} active members for analysis.`);

            // 2. Process each member
            for (const member of members) {
                try {
                    // Feature: Exclude members joined within last 15 days
                    const now = new Date();
                    const joinedDate = new Date(member.createdAt);
                    const diffTime = Math.abs(now - joinedDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays <= 15) {
                        member.churnScore = 0;
                        member.churnRisk = "Safe";
                        await member.save();
                        console.log(`[Churn][${gymName}] - Skipping ${member.fullName} (joined ${diffDays} days ago)`);
                        continue;
                    }

                    // Prepare Features
                    const tenure = calculateTenureMonths(member.createdAt);
                    const visits7d = await getVisitsLast7Days(member.phone, member.memberId);
                    const avgGap = await getAvgGapDays(member.phone, member.memberId);
                    const contractLen = parseInt(member.duration) || 1;
                    const hasPT = member.hasPT ? (member.hasPT.toLowerCase() === 'yes' ? 1 : 0) : 0;
                    const distStr = member.distanceFromGym || "0";
                    const distVal = parseFloat(distStr) || 0;

                    // Execute Prediction (Synchronous JS call)
                    const result = predictChurn({
                        distanceKm: distVal,
                        tenureMonths: tenure,
                        contractLength: contractLen,
                        visitsLast7D: visits7d,
                        avgGapDays: avgGap,
                        hasPersonalTrainer: hasPT
                    });

                    // Update Member
                    member.churnScore = result.probability;
                    member.churnRisk = result.status;
                    await member.save();

                    console.log(`[Churn][${gymName}] ✓ Processed ${member.fullName}: ${result.status} (Score: ${result.score}, Prob: ${(result.probability * 100).toFixed(1)}%)`);

                } catch (err) {
                    console.error(`[Churn][${gymName}] Failed for ${member.memberId}:`, err.message);
                }
            }

            console.log(`--- [Churn] Analysis complete for gym: ${gymName} ---`);
        });

    } catch (error) {
        console.error(`[Churn][${gymName}] Fatal error:`, error);
    }
};

module.exports = { runChurnAnalysis };
