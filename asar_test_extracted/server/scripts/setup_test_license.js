const mongoose = require('mongoose');
const { connectDB } = require('../database/db');
const UserSchema = require('../models/usermodel');
const GymSettings = require('../models/GymSettings');
const License = require('../models/license');
const bcrypt = require('bcryptjs');

async function createTestGymAdmin() {
    try {
        // Force testing script to use the new Docker Auth credentials directly 
        // to avoid any dotenv parsing issues where the string might be wrong.
        process.env.MONGODB_URI = "mongodb://admin:YourSuperSecretPassword@localhost:27018/gym_software?authSource=admin";

        await connectDB();

        // 1. Check or Create Gym Settings to act as the "Gym ID"
        let gymSettings = await GymSettings.findOne();
        let gymId;

        if (!gymSettings) {
            console.log('No GymSettings found, creating default gym settings...');
            gymSettings = new GymSettings({
                gymName: 'Stretch Fitness Club',
                address: 'Test City',
            });
            await gymSettings.save();
            gymId = gymSettings._id.toString();
            console.log(`Created default GymSettings with ID: ${gymId}`);
        } else {
            gymId = gymSettings._id.toString();
            console.log(`Found existing GymSettings with ID: ${gymId}`);
        }

        // 2. Check or Create User
        const email = 'azhagardevan99@gmail.com';
        const rawPassword = '123456';
        let user = await UserSchema.findOne({ email });

        if (user) {
            console.log(`User ${email} already exists. Updating password and gymId...`);
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(rawPassword, salt);
            user.gymId = gymId;
            await user.save();
            console.log(`Updated user password and gymId (${gymId}) successfully.`);
        } else {
            console.log(`Creating user ${email}...`);
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(rawPassword, salt);

            user = new UserSchema({
                Name: 'Admin Azhagar',
                email: email,
                password: hashedPassword,
                userID: 'TEST_USER_' + Date.now().toString().slice(-6),
                gymId: gymId  // Link user to their gym
            });
            await user.save();
            console.log(`Created new Admin User: ${user.userID} | gymId: ${gymId}`);
        }

        // 3. Create Lite Plan License
        let license = await License.findOne({ gymId });

        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

        if (license) {
            console.log(`License already exists for Gym ${gymId}. Downgrading/Setting to LITE...`);
            license.plan = 'lite';
            license.ownerEmail = email; // Tracking the owner email
            license.status = 'active';
            license.features = {
                aiBusinessInsights: false,
                aiFitnessPlan: false,
                staffMobileApp: false,
            };
            license.trialFeatures = [];
            await license.save();
        } else {
            console.log(`Creating new LITE license for Gym ${gymId}...`);
            license = new License({
                gymId: gymId,
                ownerEmail: email, // Assuming you added this from Phase 5 plan
                licenseKey: 'TEST-LITE-' + Date.now().toString(16).toUpperCase(),
                plan: 'lite',
                duration: 1,
                startDate: new Date(),
                expiryDate: oneYearFromNow,
                features: {
                    aiBusinessInsights: false,
                    aiFitnessPlan: false,
                    staffMobileApp: false,
                },
                status: 'active'
            });
            await license.save();
        }

        console.log(`\n================================`);
        console.log(`✅ TEST SETUP COMPLETE`);
        console.log(`Account: ${email}`);
        console.log(`Password: ${rawPassword}`);
        console.log(`Gym mapped to Plan: ${license.plan.toUpperCase()}`);
        console.log(`License Key: ${license.licenseKey}`);
        console.log(`================================\n`);

        process.exit(0);
    } catch (err) {
        console.error('Error setting up test user:', err);
        process.exit(1);
    }
}

createTestGymAdmin();
