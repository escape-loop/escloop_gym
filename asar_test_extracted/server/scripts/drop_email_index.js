const mongoose = require('mongoose');
const path = require('path');
// Try loading from current dir (server/)
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const dropIndex = async () => {
    try {
        console.log("Attempting to connect with URI length:", process.env.MONGODB_URI ? process.env.MONGODB_URI.length : 'MISSING');

        if (!process.env.MONGODB_URI) {
            console.error("MONGODB_URI is missing in env. Current directory:", __dirname);
            // Fallback try
            require('dotenv').config();
            console.log("Retry URI length:", process.env.MONGODB_URI ? process.env.MONGODB_URI.length : 'MISSING');
            if (!process.env.MONGODB_URI) {
                process.exit(1);
            }
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const collection = mongoose.connection.collection('members');

        const indexes = await collection.indexes();
        console.log('Current indexes:', indexes);

        // Look for any index involving email
        const emailIndex = indexes.find(idx => idx.key.email === 1 || idx.key.email === -1);

        if (emailIndex) {
            console.log(`Found email index: ${emailIndex.name}. Dropping...`);
            await collection.dropIndex(emailIndex.name);
            console.log('Email index dropped successfully.');
        } else {
            console.log('No email index found.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

dropIndex();
