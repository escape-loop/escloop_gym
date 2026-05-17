const tenantStorage = require('../middleware/tenantContext');

module.exports = function tenantPlugin(schema) {

    // --- READ / UPDATE / DELETE OPERATIONS (Query Middleware) ---
    // In Mongoose 9, query pre-hooks should be async functions (no `next` param).
    // We hook into each operation type individually for maximum compatibility.
    const queryOps = [
        'find',
        'findOne',
        'countDocuments',
        'findOneAndUpdate',
        'findOneAndDelete',
        'updateOne',
        'updateMany',
        'deleteOne',
        'deleteMany',
        'replaceOne',
    ];

    schema.pre(queryOps, function () {
        const currentGymId = tenantStorage.getStore();
        if (currentGymId) {
            this.where({ gymId: currentGymId });
        }
    });

    // --- AGGREGATION PIPELINES ---
    // Aggregation bypasses normal query hooks. We MUST inject a $match stage 
    // at the very beginning of the pipeline to ensure RLS for reports/dashboards.
    schema.pre('aggregate', function () {
        const currentGymId = tenantStorage.getStore();
        if (currentGymId) {
            this.pipeline().unshift({ $match: { gymId: currentGymId } });
        }
    });

    // --- WRITE: New Documents (Document Middleware) ---
    // Document middleware MUST hook into 'validate' (not 'save') because Mongoose
    // runs schema validation checks (like required: true) before the 'save' hook fires.
    schema.pre('validate', function () {
        const currentGymId = tenantStorage.getStore();
        if (currentGymId && !this.gymId) {
            this.gymId = currentGymId;
        }
    });

    // --- WRITE: Bulk Insert ---
    schema.pre('insertMany', function (docs) {
        const currentGymId = tenantStorage.getStore();
        if (currentGymId && Array.isArray(docs)) {
            docs.forEach(doc => {
                if (!doc.gymId) {
                    doc.gymId = currentGymId;
                }
            });
        }
    });
};

