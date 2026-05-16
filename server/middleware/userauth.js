const jwt = require('jsonwebtoken')
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const tenantStorage = require('./tenantContext')
const License = require('../models/license.js');
const connectionManager = require('../services/connectionManager');
const gymUriCache = require('../services/gymUriCache');
const dbStorage = require('./dbContext');
const userauth = async (req, res, next) => {
    // Check for token in cookies first, then in Authorization header
    const tokenFromCookie = req.cookies.token;
    const tokenFromHeader = req.headers.authorization?.split(' ')[1];
    const token = tokenFromCookie || tokenFromHeader;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "not authorization , login again"
        })
    }
    try {
        const tokendecode = jwt.verify(token, process.env.JWT_PASS);
        if (tokendecode.id) {
            if (!req.body) req.body = {};
            req.body.userID = tokendecode.id

            // --- Multi-Branch Support ---
            // The client sends an 'x-gym-id' header when it wants to operate
            // on a specific branch. We validate that the requested gymId belongs
            // to this user's owned branches before allowing it.
            const ownedGymIds = tokendecode.ownedGymIds || [];
            const primaryGymId = tokendecode.gymId; // Original/main branch gymId

            // Determine the active gymId for this request:
            // 1. If 'x-gym-id' header is provided and validated → use it (branch switch)
            // 2. Otherwise fall back to the primary gymId from the JWT token
            const requestedGymId = req.headers['x-gym-id'];
            let activeGymId = primaryGymId;

            console.log(`[Auth] Path: ${req.path} | Header x-gym-id: ${requestedGymId} | Primary: ${primaryGymId}`);

            if (requestedGymId) {
                // Validate the requested branch belongs to this user
                const allOwnedIds = [primaryGymId, ...ownedGymIds].filter(Boolean);
                if (allOwnedIds.includes(requestedGymId)) {
                    activeGymId = requestedGymId;
                } else {
                    console.warn(`[Auth] Requested gymId ${requestedGymId} not in owned list: ${allOwnedIds.join(',')}`);
                    activeGymId = primaryGymId;
                }
            }
            
            console.log(`[Auth] Final Active GymId: ${activeGymId}`);

            req.user = {
                id: tokendecode.id,
                gymId: activeGymId,
                primaryGymId,
                ownedGymIds,
                role: tokendecode.role || 'owner'
            };

            // --- License Suspension Check ---
            // If the primary gym's license is suspended, block all access
            const license = await License.findOne({ gymId: primaryGymId });
            if (license && license.status === 'suspended') {
                return res.status(403).json({
                    success: false,
                    message: "Your subscription has been suspended please contact the admin!",
                    isSuspended: true
                });
            }

            // --- Dynamic Database Connection ---
            const gymUri = await gymUriCache.getUri(primaryGymId);
            if (!gymUri) {
                return res.status(503).json({
                    success: false,
                    message: "Database not configured for this gym. Please contact support."
                });
            }

            // Get the specific connection for this URI from the connection pool
            const gymDb = connectionManager.getConnection(gymUri);
            req.gymDb = gymDb;

            // Run the rest of the request inside the tenant context AND DB context
            tenantStorage.run(activeGymId, () => {
                dbStorage.run(gymDb, () => {
                    next();
                });
            });
        } else {
            return res.status(401).json({
                success: false,
                message: "not authorization , login again"
            })
        }
    } catch (e) {
        return res.status(401).json({
            success: false,
            message: "Invalid token",
            error: e.message
        })
    }
}

module.exports = userauth