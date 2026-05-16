const path = require('path');
const dotenv = require('dotenv');

// Load env from server root (one level up)
// Explicitly resolve path
const serverRoot = path.join(__dirname, '..');
dotenv.config({ path: path.join(serverRoot, '.env') });

// Explicit Module Loading to avoid resolution errors
const mongoose = require(path.join(serverRoot, 'node_modules/mongoose'));
const Member = require(path.join(serverRoot, 'models/member'));
const Subscription = require(path.join(serverRoot, 'models/subscription'));
const Bill = require(path.join(serverRoot, 'models/bill'));

const connectDB = async () => {
    let uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;
    if (!uri) {
        console.error("No MongoDB URI found.");
        process.exit(1);
    }

    // Auto-fix malformed URI (missing slash)
    if (uri.startsWith('mongodb+srv:/') && !uri.startsWith('mongodb+srv://')) {
        uri = uri.replace('mongodb+srv:/', 'mongodb+srv://');
        console.log("Fixed malformed URI scheme (added missing slash).");
    } else if (uri.startsWith('mongodb:/') && !uri.startsWith('mongodb://')) {
        uri = uri.replace('mongodb:/', 'mongodb://');
        console.log("Fixed malformed URI scheme (added missing slash).");
    }

    console.log(`Debug URI: ${uri.substring(0, 15)}...${uri.slice(-5)} (Length: ${uri.length})`);

    if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
        console.warn("Warning: MongoDB URI does not start with 'mongodb://' or 'mongodb+srv://'. This might indicate an invalid URI format.");
    }
    try {
        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("Database connected.");
    } catch (err) {
        console.error("Connection error:", err);
        process.exit(1);
    }
};

const run = async () => {
    await connectDB();

    try {
        console.log("Checking for members with outstanding balance...");
        const members = await Member.find({});
        let count = 0;
        let fixed = 0;

        for (const member of members) {
            const subs = await Subscription.find({ memberId: member._id });
            if (subs.length > 0) {
                let totalNet = 0;
                let totalPaid = 0;

                for (const sub of subs) {
                    const bills = await Bill.find({ subscriptionId: sub._id });
                    const billPaid = bills.reduce((sum, b) => sum + (b.amountPaid || 0), 0);
                    const effectivePaid = Math.max(billPaid, sub.amountPaid || 0);

                    totalPaid += effectivePaid;
                    totalNet += (sub.netPayable || sub.amount || 0);
                }

                const balance = Math.max(0, totalNet - totalPaid);

                if (balance > 0) {
                    if (member.status !== 'Pending') {
                        // console.log(`Setting ${member.fullName} to Pending (Balance: ${balance})`);
                        member.status = 'Pending';
                        await member.save();
                        fixed++;
                    }
                    count++;
                }
            }
        }
        console.log(`Finished. Found ${count} pending members. Updated status for ${fixed}.`);
        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
};

run();
