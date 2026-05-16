/**
 * tenantBinder.js
 * 
 * Restores the AsyncLocalStorage context for gymId.
 * This is required because certain middleware (like Multer for file uploads)
 * break the Node.js async hook context chain. By placing this middleware
 * just before the controller (and after Multer), we ensure the context
 * is active when Mongoose models are called.
 */
const tenantStorage = require('./tenantContext');

const tenantBinder = (req, res, next) => {
    if (req.user && req.user.gymId) {
        tenantStorage.run(req.user.gymId, () => {
            next();
        });
    } else {
        next();
    }
};

module.exports = tenantBinder;
