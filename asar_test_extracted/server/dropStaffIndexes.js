const { connectDB } = require('./database/db.js');
const mongoose = require('mongoose');

const dropSafe = async (modelName, indexName) => {
    try {
        const Model = mongoose.models[modelName] || mongoose.model(modelName);
        await Model.collection.dropIndex(indexName);
        console.log(`Successfully dropped ${indexName} from ${modelName}`);
    } catch (e) {
        if (e.code === 27) {
            console.log(`Index ${indexName} not found in ${modelName}`);
        } else {
            console.error(`Error dropping ${indexName} in ${modelName}:`, e.message);
        }
    }
};

const run = async () => {
    try {
        await connectDB();
        require('./models/staff');

        await dropSafe('Staff', 'staffId_1');
        await dropSafe('Staff', 'phone_1');
        await dropSafe('Staff', 'referralCode_1');
        
    } catch (e) {
        console.error('Connection error:', e);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

run();
