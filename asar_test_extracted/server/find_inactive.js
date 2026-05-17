const mongoose = require('mongoose');
const Member = require('./models/member');

async function run() {
    try {
        const mongoUri = "mongodb+srv://thiyaroshni1717:thiyaroshni1717@cluster0.dsrk4xw.mongodb.net/gym_software?retryWrites=true&w=majority";
        await mongoose.connect(mongoUri);
        const inactive = await Member.find({ status: { $in: ['Inactive', 'Hold'] } }, 'memberId fullName status phone').lean();
        console.log('--- INACTIVE/HOLD MEMBERS ---');
        inactive.forEach(m => {
            console.log(`ID: ${m.memberId} | Name: ${m.fullName} | Status: ${m.status} | Phone: ${m.phone}`);
        });
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
