const mongoose = require('mongoose');
const Member = require('./models/member');
const Staff = require('./models/staff');

async function run() {
    try {
        const mongoUri = "mongodb+srv://thiyaroshni1717:thiyaroshni1717@cluster0.dsrk4xw.mongodb.net/gym_software?retryWrites=true&w=majority";
        await mongoose.connect(mongoUri);

        const staff = await Staff.find({ $or: [{ staffId: '1' }, { staffId: '001' }, { staffId: '0001' }] }).lean();
        console.log(`Conflicting Staff count: ${staff.length}`);
        staff.forEach(s => {
            console.log(`Staff ID: ${s.staffId} | Name: ${s.fullName} | Status: ${s.status}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
