const dbStorage = require('../middleware/dbContext');

/**
 * Creates a Proxy around a global Mongoose model that dynamically routes
 * all queries and instantiations to the specific database connection
 * stored in the dbStorage context for the current request.
 * 
 * If no context exists (e.g., Central DB or scripts), it falls back to the global model.
 */
function createProxyModel(GlobalModel, schema) {
    return new Proxy(GlobalModel, {
        get(target, prop, receiver) {
            // Passthrough for prototype to allow instanceof checks
            if (prop === 'prototype') return target.prototype;
            
            const gymDb = dbStorage.getStore();
            if (gymDb) {
                // Get or initialize the model on the specific connection
                const dynModel = gymDb.model(target.modelName, schema);
                const val = Reflect.get(dynModel, prop, receiver);
                return typeof val === 'function' ? val.bind(dynModel) : val;
            }
            
            // Fallback to global model
            const val = Reflect.get(target, prop, receiver);
            return typeof val === 'function' ? val.bind(target) : val;
        },
        construct(target, args) {
            const gymDb = dbStorage.getStore();
            if (gymDb) {
                const dynModel = gymDb.model(target.modelName, schema);
                return new dynModel(...args);
            }
            return new target(...args);
        }
    });
}

module.exports = createProxyModel;
