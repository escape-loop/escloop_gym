const { getCachedPlan } = require('../config/redis');
const License = require('../models/license');
const GymSettings = require('../models/GymSettings');

const requireFeature = (featureName) => {
    return async (req, res, next) => {
        try {
            // Get the primary gymId from the user's JWT so we check the main account's plan
            let gymId = 'default-gym-id';
            if (req.user) {
                gymId = req.user.primaryGymId || req.user.gymId;
            }

            // 1. Try to get plan and features from Redis
            let planData = await getCachedPlan(gymId);

            // 2. If not in Redis, fetch from API controller logic (or db directly)
            if (!planData) {
                const license = await License.findOne({ gymId, status: 'active' });

                if (!license) {
                    // Default to lite if no license found just to not break local setup completely initially
                    planData = { plan: 'lite', features: {} };
                } else {
                    // We shouldn't duplicate all the trial/feature logic here, 
                    // ideally we'd just call the getPlan controller, but for middleware 
                    // we need it inline or extracted to a service.
                    // For now, we will just parse the static features from the DB doc:
                    const dbFeatures = typeof license.features.toJSON === 'function' ? license.features.toJSON() : license.features;
                    planData = { plan: license.plan, features: dbFeatures };

                    // Apply trials manually for the fallback
                    const now = new Date();
                    const trials = license.trialFeatures || [];
                    trials.forEach(trial => {
                        if (now >= new Date(trial.startDate) && now <= new Date(trial.expiryDate)) {
                            planData.features[trial.feature] = true;
                        }
                    });
                }
            }

            // 3. Check if the required feature is true in their current plan
            const hasAccess = planData.features && planData.features[featureName] === true;

            // Also need to check if the plan inherently has this feature via the hardcoded map.
            // (We handle this implicitly since our getPlan controller merges them, 
            // so we rely on Redis having the merged object)

            if (hasAccess) {
                return next(); // User has the feature, proceed
            }

            // User does not have the feature, block the API request
            return res.status(403).json({
                success: false,
                message: 'This feature requires a higher plan.',
                currentPlan: planData.plan,
                featureRequested: featureName
            });

        } catch (error) {
            console.error('PlanGate middleware error:', error);
            res.status(500).json({ success: false, message: 'Server error checking plan features' });
        }
    };
};

module.exports = requireFeature;
