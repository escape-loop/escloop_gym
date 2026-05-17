const mongoose = require('mongoose');
const { connectDB } = require('../database/db');
const UserSchema = require('../models/usermodel');
const GymSettings = require('../models/GymSettings');
const License = require('../models/license');
const bcrypt = require('bcryptjs');

async function createSecondGymAdmin() {
    try {
        process.env.MONGODB_URI = "mongodb://admin:YourSuperSecretPassword@localhost:27018/gym_software?authSource=admin";
        await connectDB();

        const email = 'thiyaroshni1717@gmail.com';
        const rawPassword = '123456';
        const gymName = "Elite Fitness Studio (2nd Tenant)";

        // 1. Create a BRAND NEW GymSettings for strict isolation
        const newGymSettings = new GymSettings({
            gymName: gymName,
            address: 'Second City',
        });
        await newGymSettings.save();
        const gymId = newGymSettings._id.toString();
        console.log(`Created new isolated GymSettings with ID: ${gymId} for ${gymName}`);

        // 2. Check or Create User
        let user = await UserSchema.findOne({ email });

        if (user) {
            console.log(`User ${email} already exists. Updating password and gymId...`);
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(rawPassword, salt);
            user.gymId = gymId;
            await user.save();
            console.log(`Updated user successfully. Linked to Gym ID: ${gymId}`);
        } else {
            console.log(`Creating user ${email}...`);
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(rawPassword, salt);

            user = new UserSchema({
                Name: 'Roshni (Elite Admin)',
                email: email,
                password: hashedPassword,
                userID: 'ELITE_USER_' + Date.now().toString().slice(-6),
                gymId: gymId
            });
            await user.save();
            console.log(`Created new Admin User: ${user.userID} linked to Gym ID: ${gymId}`);
        }

        // 3. Create PRO Plan License for this gym
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

        console.log(`Creating new ELITE license for Gym ${gymId}...`);
        const license = new License({
            gymId: gymId,
            ownerEmail: email,
            licenseKey: 'TEST-ELITE-' + Date.now().toString(16).toUpperCase(),
            plan: 'elite',
            duration: 1,
            startDate: new Date(),
            expiryDate: oneYearFromNow,
            features: {
                aiBusinessInsights: true,
                aiFitnessPlan: true,
                staffMobileApp: true,
                biometric: true,
                multiBranch: true,
            },
            status: 'active'
        });
        await license.save();

        console.log(`\n================================`);
        console.log(`✅ SECOND TENANT SETUP COMPLETE`);
        console.log(`Account: ${email}`);
        console.log(`Password: ${rawPassword}`);
        console.log(`Gym mapped to Plan: ${license.plan.toUpperCase()}`);
        console.log(`License Key: ${license.licenseKey}`);
        console.log(`================================\n`);

        process.exit(0);
    } catch (err) {
        console.error('Error setting up second tenant:', err);
        process.exit(1);
    }
}

createSecondGymAdmin();
