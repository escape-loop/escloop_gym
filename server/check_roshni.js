const mongoose = require('mongoose');
const Member = require('./models/member');

async function run() {
    try {
        const mongoUri = "mongodb+srv://thiyaroshni1717:thiyaroshni1717@cluster0.dsrk4xw.mongodb.net/gym_software?retryWrites=true&w=majority";
        await mongoose.connect(mongoUri);

        const roshnis = await Member.find({ fullName: /Roshni/i }).lean();
        console.log(`Found ${roshnis.length} Roshnis`);
        roshnis.forEach(r => {
            console.log(`- ${r.fullName} (ID: ${r.memberId}, Status: ${r.status}, Phone: ${r.phone}, DB_ID: ${r._id})`);
        });
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
