const License = require('../models/license');
const GymSettings = require('../models/GymSettings');
const UserModels = require('../models/usermodel');
const tenantContext = require('../middleware/tenantContext');
const { getRedis, getCachedPlan, setCachedPlan } = require('../config/redis');

// Fixed plan features mapping

// Fixed plan features mapping
const PLAN_FEATURES = {
    lite: {
        maxAdminLogins: 1,
        maxStaffLogins: 2,
        attendanceType: ['keypad', 'qr'],
        staffMobileApp: false,
        aiFitnessPlan: false,
        aiBusinessInsights: false,
        multiBranch: false,
        brandedMobileApp: false,
        ptSessionBooking: false,
        biometric: false,
        rfid: false,
        faceId: false,
        whatsapp: true, members: true, membership: true, subscription: true,
        finance: true, leads: true, staff: true, equipment: true,
        billing: true, reports: true, messageAutomation: true, device: true,
    },
    pro: {
        maxAdminLogins: 1,
        maxStaffLogins: 5,
        attendanceType: ['keypad', 'qr', 'biometric', 'rfid', 'password'],
        staffMobileApp: true,
        aiFitnessPlan: true,
        aiBusinessInsights: false,
        multiBranch: false,
        brandedMobileApp: false,
        ptSessionBooking: true,
        biometric: true,
        rfid: true,
        faceId: false,
        whatsapp: true, members: true, membership: true, subscription: true,
        finance: true, leads: true, staff: true, equipment: true,
        billing: true, reports: true, messageAutomation: true, device: true,
    },
    elite: {
        maxAdminLogins: 1,
        maxStaffLogins: Infinity,
        attendanceType: ['keypad', 'qr', 'biometric', 'rfid', 'password', 'faceId'],
        staffMobileApp: true,
        aiFitnessPlan: true,
        aiBusinessInsights: true,
        multiBranch: true,
        brandedMobileApp: true,
        ptSessionBooking: true,
        biometric: true,
        rfid: true,
        faceId: true,
        whatsapp: true, members: true, membership: true, subscription: true,
        finance: true, leads: true, staff: true, equipment: true,
        billing: true, reports: true, messageAutomation: true, device: true,
    }
};

exports.validateLicense = async (req, res) => {
    try {
        const { licenseKey } = req.body;
        let gymId = req.user.primaryGymId || req.user.gymId;
        
        if (req.user.role === 'branch_manager') {
            await tenantContext.run(null, async () => {
                const owner = await UserModels.findOne({ ownedGymIds: gymId, role: 'owner' }).lean();
                if (owner) gymId = owner.gymId;
            });
        }

        const license = await License.findOne({ gymId, licenseKey });

        if (!license) {
            return res.status(404).json({ success: false, message: 'Invalid license key' });
        }

        if (license.status !== 'active') {
            return res.status(403).json({ success: false, message: 'License is not active' });
        }

        if (new Date(license.expiryDate) < new Date()) {
            return res.status(403).json({ success: false, message: 'License has expired' });
        }

        const planFeatures = PLAN_FEATURES[license.plan] || PLAN_FEATURES.lite;
        let dbFeatures = typeof license.features.toJSON === 'function' ? license.features.toJSON() : license.features;
        const features = { ...planFeatures, ...dbFeatures };

        res.json({ success: true, plan: license.plan, features });
    } catch (err) {
        console.error('Validate license error:', err);
        res.status(500).json({ success: false, message: 'Server error validating license' });
    }
};

exports.getPlan = async (req, res) => {
    try {
        let gymId = req.user.primaryGymId || req.user.gymId;
        
        if (req.user.role === 'branch_manager') {
            await tenantContext.run(null, async () => {
                const owner = await UserModels.findOne({ ownedGymIds: gymId, role: 'owner' }).lean();
                if (owner) gymId = owner.gymId;
            });
        }

        // Try to get from Redis first
        const cachedPlan = await getCachedPlan(gymId);
        if (cachedPlan) {
            return res.json({ success: true, ...cachedPlan });
        }

        const license = await License.findOne({ gymId, status: 'active' });

        let plan = 'lite';
        let customFeatures = {};
        let trials = [];

        if (license) {
            plan = license.plan;
            customFeatures = typeof license.features.toJSON === 'function' ? license.features.toJSON() : license.features;
            trials = license.trialFeatures || [];
        }

        const planFeatures = PLAN_FEATURES[plan] || PLAN_FEATURES.lite;
        const features = { ...planFeatures, ...customFeatures };

        // Apply active trials
        const now = new Date();
        trials.forEach(trial => {
            if (now >= new Date(trial.startDate) && now <= new Date(trial.expiryDate)) {
                features[trial.feature] = true;
            }
        });

        const responseData = { plan, features };

        // Save to Redis
        await setCachedPlan(gymId, responseData);

        res.json({ success: true, ...responseData });
    } catch (err) {
        console.error('Get plan error:', err);
        res.status(500).json({ success: false, message: 'Server error fetching plan' });
    }
};

exports.activateTrial = async (req, res) => {
    try {
        const { feature } = req.body;
        let gymId = req.user.primaryGymId || req.user.gymId;
        
        if (req.user.role === 'branch_manager') {
            await tenantContext.run(null, async () => {
                const owner = await UserModels.findOne({ ownedGymIds: gymId, role: 'owner' }).lean();
                if (owner) gymId = owner.gymId;
            });
        }

        const license = await License.findOne({ gymId, status: 'active' });
        if (!license) {
            return res.status(404).json({ success: false, message: 'No active license found to attach trial' });
        }

        const existingTrial = license.trialFeatures.find(t => t.feature === feature);
        if (existingTrial) {
            return res.status(400).json({ success: false, message: 'Trial already activated for this feature previously' });
        }

        const startDate = new Date();
        const expiryDate = new Date();
        expiryDate.setDate(startDate.getDate() + 7); // 7 days trial

        license.trialFeatures.push({ feature, startDate, expiryDate });
        await license.save();

        // Invalidate Redis cache if available
        const redis = getRedis();
        if (redis) {
            await redis.del(`plan:${gymId}`);
        }

        res.json({ success: true, message: `7-day trial activated for ${feature}` });
    } catch (err) {
        console.error('Activate trial error:', err);
        res.status(500).json({ success: false, message: 'Server error activating trial' });
    }
};
