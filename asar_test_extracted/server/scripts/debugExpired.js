const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const MemberModel = require('../models/member');
const { connectDB } = require('../database/db');

async function debugExpired() {
    try {
        await connectDB();
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const expiredMembers = await MemberModel.find({
            $or: [
                { status: 'Expired' },
                { endDate: { $lt: now }, status: { $nin: ['Cancelled', 'Hold'] } }
            ]
        });

        let debugOutput = `Found ${expiredMembers.length} members counted as expired:\n`;
        expiredMembers.forEach(m => {
            debugOutput += `- ${m.fullName} (ID: ${m.memberId}): Status = ${m.status}, EndDate = ${m.endDate}\n`;
        });

        fs.writeFileSync(path.join(__dirname, 'debug_results.txt'), debugOutput);
        console.log('Results saved to debug_results.txt');
        process.exit(0);
    } catch (error) {
        console.error('Debug failed:', error);
        process.exit(1);
    }
}

debugExpired();
