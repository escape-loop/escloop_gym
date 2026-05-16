const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('Error connecting to MongoDB:', err.message);
        process.exit(1);
    }
};

const repairData = async () => {
    await connectDB();

    try {
        // Define Models
        const Bill = mongoose.model('Bill', new mongoose.Schema({
            invoiceId: String,
            memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
            subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
            personalizedPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'PersonalizedPlan' },
            amountPaid: Number,
            totalAmount: Number,
            balance: Number,
            status: String,
            createdAt: Date
        }));

        const Subscription = mongoose.model('Subscription', new mongoose.Schema({
            memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
            amount: Number,
            netPayable: Number,
            amountPaid: Number,
            balanceAmount: Number,
            status: String
        }));

        const Member = mongoose.model('Member', new mongoose.Schema({
            fullName: String,
            amountPaid: Number,
            balanceAmount: Number,
            netPayable: Number,
            status: String
        }));

        console.log('--- STARTING RECALCULATION REPAIR ---');

        // 1. Fetch all Subscriptions
        const subscriptions = await Subscription.find({});
        console.log(`Found ${subscriptions.length} subscriptions to check.`);

        let fixedCount = 0;

        for (const sub of subscriptions) {
            // 2. Find VALID bills for this subscription
            // Valid = Linked to Sub AND NOT Linked to Plan
            // Also exclude deleted bills if any (though we don't have isDeleted usually)
            const validBills = await Bill.find({
                subscriptionId: sub._id,
                personalizedPlanId: null // EXCLUDE Fitness Plan bills
            });

            // 3. Calculate Correct Total
            const correctTotalPaid = validBills.reduce((sum, b) => sum + (b.amountPaid || 0), 0);

            // 4. Update if different
            // Allow small float diffs
            if (Math.abs(correctTotalPaid - (sub.amountPaid || 0)) > 1) {
                console.log(`Fixing Sub ${sub._id} (${sub.status}): Paid ${sub.amountPaid} -> ${correctTotalPaid}`);

                sub.amountPaid = correctTotalPaid;

                const netPayable = sub.netPayable || sub.amount || 0;
                sub.balanceAmount = Math.max(0, netPayable - sub.amountPaid);

                // Recalculate Status
                if (sub.balanceAmount === 0 && netPayable > 0) {
                    // Fully paid
                    // Status logic: If Active/Pending, keep Active?
                    // Usually we don't change status to 'Paid' for subscriptions, we keep them Active until Expired.
                    if (sub.status === 'Pending') sub.status = 'Active';
                } else if (sub.balanceAmount > 0) {
                    // Not fully paid
                    // If it was Active but mistakenly thought fully paid?
                    // If User manually set to Active, we respect it?
                    // Or revert to Pending?
                    // "SHOWING IT STATUS AS ACTIVE INSTEAD OF PENDING" -> User wants it Pending if not paid!
                    if (sub.status === 'Active' && sub.amountPaid < netPayable) {
                        console.log(`  -> Reverting Status Active -> Pending`);
                        sub.status = 'Pending';
                    }
                }

                await sub.save();
                fixedCount++;

                // Sync Member
                if (sub.memberId) {
                    const member = await Member.findById(sub.memberId);
                    if (member) {
                        // Only sync if this is the latest/active sub?
                        // If we just fixed it, we should sync.
                        // But if the member has a NEWER active sub?
                        // Let's check if this sub is 'current'
                        if (member.status !== 'expired') { // simple check
                            member.amountPaid = sub.amountPaid;
                            member.balanceAmount = sub.balanceAmount;
                            await member.save();
                        }
                    }
                }
            }
        }

        console.log(`--- REPAIR COMPLETE. Fixed ${fixedCount} subscriptions. ---`);
        process.exit(0);

    } catch (err) {
        console.error('Repair failed:', err);
        process.exit(1);
    }
};

repairData();
