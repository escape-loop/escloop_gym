const { connectDB } = require('./database/db.js');
const mongoose = require('mongoose');

const run = async () => {
    try {
        await connectDB();
        require('./models/staff');
        const Staff = mongoose.model('Staff');
        const indexes = await Staff.collection.indexes();
        console.log(JSON.stringify(indexes, null, 2));
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

run();
