// controller/revenue.js
const Bill = require('../models/bill');
const { Expense } = require('../models/expense');
const cache = require('../services/cacheService');

// Helper to get date range based on period type
const getDateRange = (periodType, selectedDate, selectedMonth, selectedYear) => {
    let startDate, endDate;
    const now = new Date();

    // If selectedYear is not provided, use current year
    const year = selectedYear ? parseInt(selectedYear) : now.getFullYear();

    // If selectedMonth is not provided, use current month
    const month = selectedMonth !== undefined ? parseInt(selectedMonth) : now.getMonth();

    if (periodType === 'daily') {
        // For specific date
        startDate = new Date(selectedDate);
        startDate.setHours(0, 0, 0, 0);

        endDate = new Date(selectedDate);
        endDate.setHours(23, 59, 59, 999);
    } else if (periodType === 'monthly') {
        // Start of the selected month in selected year
        startDate = new Date(year, month, 1);

        // End of the selected month
        endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
    } else {
        // Yearly: Start of year to end of year
        startDate = new Date(year, 0, 1);
        endDate = new Date(year, 11, 31, 23, 59, 59, 999);
    }

    return { startDate, endDate };
};

// Get Revenue Summary (Profit, Expense, Net Revenue)
const getRevenueSummary = async (req, res) => {
    try {
        const { periodType, selectedDate, selectedMonth, selectedYear } = req.query;
        const year = selectedYear || new Date().getFullYear();
        const month = selectedMonth !== undefined ? selectedMonth : new Date().getMonth();
        // Extract day for daily period type caching
        const day = periodType === 'daily' && selectedDate ? new Date(selectedDate).getDate() : null;
        const cacheKey = cache.KEYS.revenue(periodType, year, month, day);

        const summary = await cache.getOrSet(
            `${cacheKey}:summary`,
            async () => {
                const { startDate, endDate } = getDateRange(periodType, selectedDate, selectedMonth, selectedYear);

                const incomeResult = await Bill.aggregate([
                    { $match: { gymId: req.user.gymId, invoiceDate: { $gte: startDate, $lte: endDate }, status: { $in: ['paid', 'partial'] } } },
                    { $group: { _id: null, totalIncome: { $sum: "$amountPaid" } } }
                ]);
                const totalIncome = incomeResult.length > 0 ? incomeResult[0].totalIncome : 0;

                const expenseResult = await Expense.aggregate([
                    { $match: { gymId: req.user.gymId, date: { $gte: startDate, $lte: endDate } } },
                    { $group: { _id: null, totalExpense: { $sum: "$totalWithGst" } } }
                ]);
                const totalExpense = expenseResult.length > 0 ? expenseResult[0].totalExpense : 0;

                return {
                    totalRevenue: totalIncome - totalExpense,
                    totalProfit: totalIncome,
                    totalExpense
                };
            },
            cache.HOUR
        );

        res.json({ success: true, summary });
    } catch (error) {
        console.error('Error fetching revenue summary:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch revenue summary' });
    }
};

// Get Revenue Trend (for charts)
const getRevenueTrend = async (req, res) => {
    try {
        const { periodType, selectedMonth, selectedYear } = req.query;
        // This handles monthly (daily breakdown) and yearly (monthly breakdown)
        const { startDate, endDate } = getDateRange(periodType, null, selectedMonth, selectedYear);

        // Grouping format based on period
        let groupByFormat;
        if (periodType === 'monthly') {
            // Group by day of month (YYYY-MM-DD)
            groupByFormat = { $dateToString: { format: "%Y-%m-%d", date: "$invoiceDate" } };
        } else {
            // Group by month (YYYY-MM)
            groupByFormat = { $dateToString: { format: "%Y-%m", date: "$invoiceDate" } };
        }

        // Aggregate Income
        const incomeTrend = await Bill.aggregate([
            {
                $match: {
                    gymId: req.user.gymId,
                    invoiceDate: { $gte: startDate, $lte: endDate },
                    status: { $in: ['paid', 'partial'] }
                }
            },
            {
                $group: {
                    _id: groupByFormat,
                    income: { $sum: "$amountPaid" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Aggregate Expenses
        // Expense date format grouping
        let expGroupBy;
        if (periodType === 'monthly') {
            expGroupBy = { $dateToString: { format: "%Y-%m-%d", date: "$date" } };
        } else {
            expGroupBy = { $dateToString: { format: "%Y-%m", date: "$date" } };
        }

        const expenseTrend = await Expense.aggregate([
            {
                $match: {
                    gymId: req.user.gymId,
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: expGroupBy,
                    expense: { $sum: "$totalWithGst" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Merge Data
        const trendMap = {};

        incomeTrend.forEach(item => {
            trendMap[item._id] = {
                name: item._id,
                income: item.income,
                expense: 0,
                revenue: item.income // Default net if 0 expense
            };
        });

        expenseTrend.forEach(item => {
            if (!trendMap[item._id]) {
                trendMap[item._id] = { name: item._id, income: 0, expense: 0, revenue: 0 };
            }
            trendMap[item._id].expense = item.expense;
            // Recalculate Net Revenue = Income - Expense
            trendMap[item._id].revenue = trendMap[item._id].income - item.expense;
        });

        // Convert to array and sort
        const trendData = Object.values(trendMap).sort((a, b) => a.name.localeCompare(b.name));

        // Format labels for UI (Day or Month Name)
        const formattedData = trendData.map(item => {
            const d = new Date(item.name);
            let label;
            if (periodType === 'monthly') {
                label = d.getDate().toString(); // Just the day number
            } else {
                label = d.toLocaleString('default', { month: 'short' }); // Month name
            }

            return {
                name: label, // usage for XAxis
                day: label, // alias
                month: label, // alias
                income: item.income, // User's "Profit"
                expense: item.expense,
                revenue: item.revenue // User's "Revenue" (Net)
            };
        });

        // Fill in missing days/months? 
        // For simplicity, we stick to existing data points, or frontend handles gaps. 
        // Recharts handles gaps well if XAxis is categorical.

        res.json({
            success: true,
            trendData: formattedData
        });
    } catch (error) {
        console.error('Error fetching revenue trend:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch revenue trend' });
    }
}

// Get Revenue Analytics
const getRevenueAnalytics = async (req, res) => {
    try {
        const { periodType, selectedDate, selectedMonth, selectedYear } = req.query;
        const { startDate, endDate } = getDateRange(periodType, selectedDate, selectedMonth, selectedYear);

        // 1. Revenue by Payment Method
        const paymentMethodStats = await Bill.aggregate([
            {
                $match: {
                    gymId: req.user.gymId,
                    invoiceDate: { $gte: startDate, $lte: endDate },
                    status: { $in: ['paid', 'partial'] }
                }
            },
            {
                $group: {
                    _id: { $toLower: "$paymentMode" },
                    totalAmount: { $sum: "$amountPaid" }
                }
            }
        ]);

        const byPaymentMethod = {
            cash: 0,
            upi: 0,
            card: 0,
            bankTransfer: 0
        };

        paymentMethodStats.forEach(stat => {
            const mode = stat._id; // 'cash', 'upi', etc.
            if (mode === 'bank transfer') {
                byPaymentMethod.bankTransfer = stat.totalAmount;
            } else if (byPaymentMethod[mode] !== undefined) {
                byPaymentMethod[mode] = stat.totalAmount;
            }
        });

        // 2. Revenue by Source (Membership Type)
        // We look at items.description to categorize
        const sourceStats = await Bill.aggregate([
            {
                $match: {
                    gymId: req.user.gymId,
                    invoiceDate: { $gte: startDate, $lte: endDate },
                    status: { $in: ['paid', 'partial'] }
                }
            },
            // Lookup subscription details to get accurate membership type
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "subscriptionId",
                    foreignField: "_id",
                    as: "subDetails"
                }
            },
            { $unwind: { path: "$subDetails", preserveNullAndEmptyArrays: true } },
            { $unwind: "$items" },
            {
                $project: {
                    amount: "$items.amount", // Use item amount for breakdown
                    description: { $toLower: "$items.description" },
                    subType: { $toLower: { $ifNull: ["$subDetails.membershipType", ""] } }
                }
            },
            {
                $project: {
                    amount: 1,
                    category: {
                        $switch: {
                            branches: [
                                // Priority 1: Check for direct Personalized Plan ID
                                { case: { $and: [{ $ne: ["$personalizedPlanId", null] }, { $ne: ["$personalizedPlanId", ""] }] }, then: "fitnessPlan" },

                                // Priority 2: Check Subscription Type
                                { case: { $regexMatch: { input: "$subType", regex: /half[- ]?yearly/i } }, then: "halfYearly" },
                                { case: { $regexMatch: { input: "$subType", regex: /yearly/i } }, then: "yearly" },
                                { case: { $regexMatch: { input: "$subType", regex: /quarterly/i } }, then: "quarterly" },
                                { case: { $regexMatch: { input: "$subType", regex: /monthly/i } }, then: "monthly" },
                                { case: { $regexMatch: { input: "$subType", regex: /fitness[ -]?plan/i } }, then: "fitnessPlan" },

                                // Priority 3: Fallback to Description
                                { case: { $regexMatch: { input: "$description", regex: /half[- ]?yearly/i } }, then: "halfYearly" },
                                { case: { $regexMatch: { input: "$description", regex: /yearly/i } }, then: "yearly" },
                                { case: { $regexMatch: { input: "$description", regex: /quarterly/i } }, then: "quarterly" },
                                { case: { $regexMatch: { input: "$description", regex: /monthly/i } }, then: "monthly" },
                                { case: { $regexMatch: { input: "$description", regex: /fitness[ -]?plan/i } }, then: "fitnessPlan" },
                                { case: { $regexMatch: { input: "$description", regex: /personal training|\bpt\b/i } }, then: "personalTraining" },
                                { case: { $regexMatch: { input: "$description", regex: /membership|subscription/i } }, then: "subscriptions" },
                                { case: { $regexMatch: { input: "$description", regex: /registration|admission/i } }, then: "registration" }
                            ],
                            default: "other"
                        }
                    }
                }
            },
            {
                $group: {
                    _id: "$category",
                    count: { $sum: 1 },
                    revenue: { $sum: "$amount" }
                }
            }
        ]);

        const bySource = {
            yearly: 0, yearlyCount: 0,
            halfYearly: 0, halfYearlyCount: 0,
            quarterly: 0, quarterlyCount: 0,
            monthly: 0, monthlyCount: 0,
            fitnessPlan: 0, fitnessPlanCount: 0,
            personalTraining: 0, personalTrainingCount: 0
        };

        sourceStats.forEach(stat => {
            if (bySource[stat._id] !== undefined) {
                bySource[stat._id] = stat.revenue;
                bySource[`${stat._id}Count`] = stat.count;
            }
        });

        // 3. Membership Analytics (New vs Renewal)
        // OLD LOGIC: Based on description text "renew"
        // NEW LOGIC (2025-01-22): Based on whether the member has earlier subscriptions in history
        const membershipStats = await Bill.aggregate([
            {
                $match: {
                    gymId: req.user.gymId,
                    invoiceDate: { $gte: startDate, $lte: endDate },
                    status: { $in: ['paid', 'partial'] }
                }
            },
            // Lookup the subscription for this bill to get createdAt/Date
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "subscriptionId",
                    foreignField: "_id",
                    as: "currentSub"
                }
            },
            { $unwind: { path: "$currentSub", preserveNullAndEmptyArrays: true } },

            // Now verify if there are ANY subscriptions for this member created BEFORE this one
            {
                $lookup: {
                    from: "subscriptions",
                    let: {
                        memberId: "$currentSub.memberId",
                        currentSubDate: "$currentSub.createdAt"
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$gymId", req.user.gymId] },
                                        { $eq: ["$memberId", "$$memberId"] },
                                        // Find subs created strictly before the current one
                                        { $lt: ["$createdAt", "$$currentSubDate"] }
                                    ]
                                }
                            }
                        },
                        { $limit: 1 } // We only need to know if ONE exists
                    ],
                    as: "priorSubs"
                }
            },

            // Unwind items to sum amounts correctly as per previous logic structure
            // (Assumes bill total corresponds to these items)
            { $unwind: "$items" },

            {
                $project: {
                    amount: "$items.amount",
                    description: { $toLower: "$items.description" },
                    hasPriorSubs: { $gt: [{ $size: "$priorSubs" }, 0] },
                    // Fallback for bills without subscriptionId (migrated data?): use text
                    hasSubLink: { $ifNull: ["$currentSub._id", false] }
                }
            },
            {
                $project: {
                    amount: 1,
                    type: {
                        $cond: {
                            if: { $eq: ["$hasSubLink", false] },
                            // If no sub link, fallback to text match
                            then: {
                                $cond: {
                                    if: { $regexMatch: { input: "$description", regex: /renew/i } },
                                    then: "renewals",
                                    else: "newMemberships"
                                }
                            },
                            // If sub link exists, use history check
                            else: {
                                $cond: {
                                    if: "$hasPriorSubs",
                                    then: "renewals",
                                    else: "newMemberships"
                                }
                            }
                        }
                    }
                }
            },
            {
                $group: {
                    _id: "$type",
                    count: { $sum: 1 },
                    revenue: { $sum: "$amount" }
                }
            }
        ]);

        const memberships = {
            renewals: 0, renewalsRevenue: 0,
            newMemberships: 0, newMembershipsRevenue: 0
        };

        membershipStats.forEach(stat => {
            if (memberships[stat._id] !== undefined) {
                memberships[stat._id] = stat.count;
                memberships[`${stat._id}Revenue`] = stat.revenue;
            }
        });

        // Add total payment stats for consistency
        const paymentStats = {
            totalPayments: membershipStats.reduce((acc, curr) => acc + curr.count, 0),
            totalRevenue: membershipStats.reduce((acc, curr) => acc + curr.revenue, 0)
        };

        res.json({
            success: true,
            analytics: {
                byPaymentMethod,
                bySource,
                memberships,
                paymentStats
            }
        });
    } catch (error) {
        console.error('Error fetching revenue analytics:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch revenue analytics' });
    }
};

module.exports = {
    getRevenueSummary,
    getRevenueTrend,
    getRevenueAnalytics
};