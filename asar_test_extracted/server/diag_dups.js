const mongoose = require('mongoose');
const Member = require('./models/member');
const Staff = require('./models/staff');

async function run() {
    try {
        const mongoUri = "mongodb+srv://thiyaroshni1717:thiyaroshni1717@cluster0.dsrk4xw.mongodb.net/gym_software?retryWrites=true&w=majority";

        await mongoose.connect(mongoUri);
        console.log('Connected to DB');

        console.log('\n--- Duplicate Member IDs ---');
        const memberIdDups = await Member.aggregate([
            { $group: { _id: '$memberId', count: { $sum: 1 }, docs: { $push: { name: '$fullName', status: '$status', id: '$_id' } } } },
            { $match: { count: { $gt: 1 } } }
        ]);
        console.log(JSON.stringify(memberIdDups, null, 2));

        console.log('\n--- Duplicate Phones ---');
        const phoneDups = await Member.aggregate([
            { $group: { _id: '$phone', count: { $sum: 1 }, docs: { $push: { name: '$fullName', memberId: '$memberId', status: '$status' } } } },
            { $match: { count: { $gt: 1 } } }
        ]);
        console.log(JSON.stringify(phoneDups, null, 2));

        console.log('\n--- ID Conflict between Member and Staff ---');
        const members = await Member.find({}, 'memberId fullName').lean();
        for (const m of members) {
            if (!m.memberId) continue;
            const s = await Staff.findOne({ staffId: m.memberId }).lean();
            if (s) {
                console.log(`Conflict: ID ${m.memberId} exists as Member (${m.fullName}) and Staff (${s.fullName})`);
            }
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
