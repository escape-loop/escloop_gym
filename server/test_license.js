const mongoose = require('mongoose');
const User = require('./models/usermodel');
const License = require('./models/license');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        try {
            const email = 'azhagardevan999@gmail.com';
            const user = await User.findOne({ email });
            console.log('--- USER ---');
            console.log('User found:', !!user);
            if (user) {
                console.log('gymId:', user.gymId);
                console.log('ownedGymIds:', user.ownedGymIds);

                console.log('\n--- LICENSE ---');
                const license = await License.findOne({ gymId: user.gymId });
                console.log('License found:', !!license);
                if (license) {
                    console.log('Plan:', license.plan);
                    console.log('Status:', license.status);
                    console.log('Expiry:', license.expiryDate);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            process.exit(0);
        }
    })
    .catch(e => {
        console.error('DB Error:', e);
        process.exit(1);
    });
