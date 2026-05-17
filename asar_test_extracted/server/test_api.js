const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./models/usermodel');

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        try {
            const email = 'azhagardevan999@gmail.com';
            const user = await User.findOne({ email });
            if (user) {
                const token = jwt.sign(
                    { id: user._id, gymId: user.gymId, ownedGymIds: user.ownedGymIds },
                    process.env.JWT_PASS,
                    { expiresIn: '7d' }
                );
                console.log('Token generated');

                const http = require('http');
                const req = http.request({
                    hostname: 'localhost',
                    port: 5000,
                    path: '/api/license/plan',
                    method: 'GET',
                    headers: {
                        'Cookie': `token=${token}`
                    }
                }, res => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => console.log('Response:', data));
                });
                req.on('error', console.error);
                req.end();
            }
        } catch (e) {
            console.error(e);
        }
    });

// Wait for a bit before exiting
setTimeout(() => process.exit(0), 3000);
