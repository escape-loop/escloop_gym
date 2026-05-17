const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });
const UserModels = require('../models/usermodel.js');
const GymSettings = require('../models/GymSettings.js');

async function cleanup() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const email = 'azhagardevan999@gmail.com';
        const user = await UserModels.findOne({ email });

        if (!user) {
            console.log(`User not found with email: ${email}`);
            process.exit(1);
        }

        const branchesToDelete = user.ownedGymIds || [];

        if (branchesToDelete.length === 0) {
            console.log('No branches to delete.');
            process.exit(0);
        }

        console.log(`Found ${branchesToDelete.length} branches to delete:`, branchesToDelete);

        // Delete GymSettings for these branches
        const deletedSettings = await GymSettings.deleteMany({ gymId: { $in: branchesToDelete } });
        console.log(`Deleted ${deletedSettings.deletedCount} GymSettings documents.`);

        // Clear ownedGymIds
        user.ownedGymIds = [];
        await user.save();
        console.log('Cleared ownedGymIds for user:', email);

        console.log('Cleanup complete!');
        process.exit(0);
    } catch (error) {
        console.error('Error during cleanup:', error);
        process.exit(1);
    }
}

cleanup();
