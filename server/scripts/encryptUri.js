const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const ENCRYPTION_KEY = crypto.randomBytes(32); // 256-bit key
const IV_LENGTH = 16; // AES block size

function encrypt(text) {
    let iv = crypto.randomBytes(IV_LENGTH);
    let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return {
        iv: iv.toString('hex'),
        encryptedData: encrypted.toString('hex')
    };
}

const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error("No MONGODB_URI found in .env");
    process.exit(1);
}

const encrypted = encrypt(uri);

// Save the payload
const payloadPath = path.resolve(__dirname, '../config/payload.json');
fs.writeFileSync(payloadPath, JSON.stringify(encrypted, null, 2));

// Save the secret key as a JS module so it gets compiled
const secretPath = path.resolve(__dirname, '../config/secret.js');
const secretContent = `// Auto-generated. Do not modify.
module.exports = {
    key: "${ENCRYPTION_KEY.toString('hex')}"
};
`;
fs.writeFileSync(secretPath, secretContent);

console.log("Central DB URI successfully encrypted and saved to config/payload.json");
