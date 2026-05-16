const GymSettings = require('../models/GymSettings');
const UserModels = require('../models/usermodel');
const fs = require('fs');
const path = require('path');
const cache = require('../services/cacheService');
const tenantContext = require('../middleware/tenantContext');

// Get gym settings
const getGymSettings = async (req, res) => {
    try {
        const gymId = req.user && req.user.gymId ? req.user.gymId.toString() : null;
        if (!gymId) return res.status(401).json({ success: false, message: 'No gym context found.' });

        const settings = await cache.getOrSet(
            cache.KEYS.GYM_SETTINGS,
            async () => {
                let s = await GymSettings.findOne({ gymId });
                if (!s) {
                    console.log("[GymSettings] No settings found, creating default for gymId:", gymId);
                    s = await GymSettings.create({ gymId, gymName: 'My Gym', address: '', mobile: '', email: '' });
                }
                return s.toObject ? s.toObject() : s;
            },
            cache.DAY
        );
        console.log("[GymSettings] Fetched Settings:", { gymName: settings.gymName });
        res.json({ success: true, settings });
    } catch (error) {
        console.error('[GymSettings] Error fetching settings:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update gym settings
const updateGymSettings = async (req, res) => {
    try {
        const userId = req.user.id;
        const currentGymId = req.user && req.user.gymId ? req.user.gymId.toString() : null;
        if (!currentGymId) return res.status(401).json({ success: false, message: 'No gym context found.' });

        // Fetch user to get all owned branches
        let user = null;
        await tenantContext.run(null, async () => {
            user = await UserModels.findById(userId).lean();
        });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const allGymIds = [user.gymId, ...(user.ownedGymIds || [])].filter(Boolean);
        console.log(`[GymSettings] Syncing settings for branches: ${allGymIds.join(', ')}`);

        console.log("[GymSettings] Received Update Body:", req.body);
        const updateData = { ...req.body };

        // Handle file uploads if present
        if (req.files) {
            if (req.files.gymLogo) {
                updateData.gymLogo = `/uploads/gym/${req.files.gymLogo[0].filename}`;
            }
            if (req.files.authorizerSignature) {
                updateData.authorizerSignature = `/uploads/gym/${req.files.authorizerSignature[0].filename}`;
            }
        }

        // Explicitly handle lat/long to avoid CastError on empty strings
        if (updateData.latitude !== undefined) {
            if (updateData.latitude === '' || updateData.latitude === null || updateData.latitude === 'null') {
                updateData.latitude = null;
            } else {
                updateData.latitude = parseFloat(updateData.latitude);
            }
        }
        if (updateData.longitude !== undefined) {
            if (updateData.longitude === '' || updateData.longitude === null || updateData.longitude === 'null') {
                updateData.longitude = null;
            } else {
                updateData.longitude = parseFloat(updateData.longitude);
            }
        }

        console.log("[GymSettings] Processed Update Data for active branch:", updateData);

        // --- Fix: Remove loop and update ONLY the current active branch ---
        let settings = await GymSettings.findOne({ gymId: currentGymId });
        
        if (settings) {
            // Delete old images only for the current gym context to avoid duplicate unlinks
            if (updateData.gymLogo && settings.gymLogo && updateData.gymLogo !== settings.gymLogo) {
                const oldPath = path.join(__dirname, '..', settings.gymLogo);
                if (fs.existsSync(oldPath)) {
                    try { fs.unlinkSync(oldPath); } catch (e) { console.error("Error unlinking logo:", e); }
                }
            }
            if (updateData.authorizerSignature && settings.authorizerSignature && updateData.authorizerSignature !== settings.authorizerSignature) {
                const oldPath = path.join(__dirname, '..', settings.authorizerSignature);
                if (fs.existsSync(oldPath)) {
                    try { fs.unlinkSync(oldPath); } catch (e) { console.error("Error unlinking sig:", e); }
                }
            }

            // Secure update: use gymId in filter and force it in the update body
            settings = await GymSettings.findOneAndUpdate(
                { gymId: currentGymId }, 
                { ...updateData, gymId: currentGymId }, 
                { new: true, runValidators: true }
            );
        } else {
            console.log("[GymSettings] Creating NEW settings document for gym branch:", currentGymId);
            settings = await GymSettings.create({ ...updateData, gymId: currentGymId });
        }

        // Invalidate gym settings cache for this specific branch
        await cache.invalidateGymSettings();

        console.log("[GymSettings] Update Complete for gymId:", currentGymId);

        res.json({ success: true, message: 'Gym settings updated successfully', settings });
    } catch (error) {
        console.error('[GymSettings] Error updating settings:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get public gym settings for branding (No Auth)
const getPublicGymSettings = async (req, res) => {
    try {
        const { gymId } = req.params;
        if (!gymId) return res.status(400).json({ success: false, message: 'Gym ID is required.' });

        const settings = await cache.getOrSet(
            cache.KEYS.GYM_SETTINGS_PUBLIC(gymId),
            async () => {
                const s = await GymSettings.findOne({ gymId }).lean();
                if (!s) return null;
                // Return only non-sensitive branding info
                return {
                    gymName: s.gymName,
                    gymLogo: s.gymLogo,
                    address: s.address,
                    mobile: s.mobile
                };
            },
            cache.DAY
        );

        if (!settings) return res.status(404).json({ success: false, message: 'Gym not found.' });
        res.json({ success: true, settings });
    } catch (error) {
        console.error('[GymSettings] Error fetching public settings:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get automation toggles
const getAutomationToggles = async (req, res) => {
    try {
        const gymId = req.user && req.user.gymId ? req.user.gymId.toString() : null;
        if (!gymId) return res.status(401).json({ success: false, message: 'No gym context found.' });

        const settings = await GymSettings.findOne({ gymId }).select('automationToggles');
        if (!settings) {
            return res.json({ success: true, toggles: {
                subscriptionRenewal: true,
                newRegistration: true,
                paymentReceipt: true,
                attendanceAlert: true,
                birthdayWish: true,
                enquiryFollowup: true,
                personalizedPlan: true
            }});
        }
        res.json({ success: true, toggles: settings.automationToggles });
    } catch (error) {
        console.error('[GymSettings] Error fetching toggles:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update automation toggles
const updateAutomationToggles = async (req, res) => {
    try {
        const gymId = req.user && req.user.gymId ? req.user.gymId.toString() : null;
        if (!gymId) return res.status(401).json({ success: false, message: 'No gym context found.' });

        const { toggles } = req.body;
        if (!toggles) return res.status(400).json({ success: false, message: 'Toggles data required.' });

        const settings = await GymSettings.findOneAndUpdate(
            { gymId },
            { $set: { automationToggles: toggles } },
            { new: true, upsert: true }
        );

        // Invalidate cache
        await cache.invalidateGymSettings();

        res.json({ success: true, message: 'Automation toggles updated', toggles: settings.automationToggles });
    } catch (error) {
        console.error('[GymSettings] Error updating toggles:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getGymSettings,
    updateGymSettings,
    getPublicGymSettings,
    getAutomationToggles,
    updateAutomationToggles
};

