const mongoose = require('mongoose');
const Member = require('./models/member');

async function run() {
    try {
        const mongoUri = "mongodb+srv://thiyaroshni1717:thiyaroshni1717@cluster0.dsrk4xw.mongodb.net/gym_software?retryWrites=true&w=majority";
        await mongoose.connect(mongoUri);

        // 1. Force Activate Roshni
        const result = await Member.updateMany(
            { fullName: /Roshni/i },
            { $set: { status: 'Active' } }
        );
        console.log(`Updated ${result.modifiedCount} records to Active`);

        // 2. Clear any 'Hold' or 'Inactive' for her specifically
        const roshni = await Member.findOne({ fullName: /Roshni/i }).lean();
        console.log(`Current Status for ${roshni.fullName}: ${roshni.status}`);

        // 3. Check for any other record with same phone or ID
        const others = await Member.find({
            $or: [{ memberId: roshni.memberId }, { phone: roshni.phone }],
            _id: { $ne: roshni._id }
        }).lean();
        console.log(`Other conflicting records: ${others.length}`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
