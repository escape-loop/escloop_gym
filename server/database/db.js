const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('express');

function getDecryptedUri() {
    try {
        const secretPath = path.resolve(__dirname, '../config/secret.js');
        const payloadPath = path.resolve(__dirname, '../config/payload.json');
        
        if (fs.existsSync(secretPath) && fs.existsSync(payloadPath)) {
            const secret = require(secretPath);
            const payload = require(payloadPath);
            
            const iv = Buffer.from(payload.iv, 'hex');
            const encryptedText = Buffer.from(payload.encryptedData, 'hex');
            const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(secret.key, 'hex'), iv);
            
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            
            return decrypted.toString();
        }
    } catch (err) {
        console.error('[DB] Failed to decrypt URI:', err.message);
    }
    return null;
}

const connectDB = async () => {
    try {
        // Try to get URI from env first (for dev/cron server), then fallback to encrypted payload (for desktop app)
        const uri = process.env.MONGODB_URI || getDecryptedUri();
        
        if (!uri) {
            throw new Error('No MongoDB URI found in environment or encrypted config.');
        }

        await mongoose.connect(uri);
        console.log('MongoDB connected successfully');

        // Programmatically drop legacy email_1 unique index to prevent duplicate key errors on empty emails
        try {
            const db = mongoose.connection.db;
            const collections = await db.listCollections({ name: 'members' }).toArray();
            if (collections.length > 0) {
                const indexes = await db.collection('members').indexes();
                const emailIdx = indexes.find(idx => idx.name === 'email_1' || (idx.key && idx.key.email === 1));
                if (emailIdx) {
                    await db.collection('members').dropIndex(emailIdx.name);
                    console.log(`[DB] Successfully dropped legacy unique index: ${emailIdx.name}`);
                }
            }
        } catch (indexErr) {
            console.warn('[DB] Non-critical: Could not drop legacy email index:', indexErr.message);
        }
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
};

module.exports = { connectDB };