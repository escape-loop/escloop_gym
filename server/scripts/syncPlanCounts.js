const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const MembershipPlanModel = require('../models/membership');
const SubscriptionModel = require('../models/subscription');
const { connectDB } = require('../database/db');

async function syncCounts() {
    try {
        await connectDB();
        console.log('Connected to database...');

        const plans = await MembershipPlanModel.find({});
        console.log(`Found ${plans.length} plans. Syncing counts...`);

        for (const plan of plans) {
            // Count active/pending subscriptions for this plan
            // Note: We count all subscriptions that are not Expired/Cancelled
            const count = await SubscriptionModel.countDocuments({
                packageName: plan.name,
                status: { $in: ['Active', 'Pending'] }
            });

            plan.currentMembers = count;
            await plan.save();
            console.log(`Updated plan "${plan.name}": ${count} members.`);
        }

        console.log('Sync completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Sync failed:', error);
        process.exit(1);
    }
}

syncCounts();
