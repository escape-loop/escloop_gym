const mongoose = require('mongoose');
const Member = require('./models/member');

async function run() {
    try {
        const mongoUri = "mongodb+srv://thiyaroshni1717:thiyaroshni1717@cluster0.dsrk4xw.mongodb.net/gym_software?retryWrites=true&w=majority";
        await mongoose.connect(mongoUri);

        const nonActive = await Member.find({ status: { $ne: 'Active' } }, 'memberId fullName status').lean();
        console.log(`Non-Active Members Count: ${nonActive.length}`);
        nonActive.forEach(m => {
            console.log(`ID: ${m.memberId} | Name: ${m.fullName} | Status: ${m.status}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
