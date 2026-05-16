require('dotenv').config();
const cron = require('node-cron');
const mongoose = require('mongoose');
const GymSettings = require('./models/GymSettings');
const gymUriCache = require('./services/gymUriCache');
const connectionManager = require('./services/connectionManager');
const dbStorage = require('./middleware/dbContext');
const {
    runExpiryReminderAutomation,
    runLeadFollowUpAutomation,
    runBirthdayReminderAutomation,
    runAttendanceReminderAutomation
} = require('./services/automationService');
const { runChurnAnalysis } = require('./services/churnService');

async function connectCentralDb() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('[Cron] Connected to Central DB');
    } catch (err) {
        console.error('[Cron] Failed to connect to Central DB:', err.message);
        process.exit(1);
    }
}

async function processAllGyms() {
    console.log('[Cron] Starting daily automation cycle...');
    try {
        // Find all settings
        const allGyms = await GymSettings.find({}).lean();
        
        for (const gym of allGyms) {
            const gymId = gym.gymId;
            const gymName = gym.gymName || 'Unknown Gym';
            
            console.log(`\n[Cron] Processing Gym: ${gymName} (${gymId})`);
            
            // Get URI
            let uri = gym.mongoUri;
            if (!uri && gym.isBranch && gym.parentGymId) {
                const parent = await GymSettings.findOne({ gymId: gym.parentGymId }).lean();
                if (parent) uri = parent.mongoUri;
            }
            
            if (!uri) {
                console.log(`[Cron] Skipping ${gymName} - no MongoDB URI found.`);
                continue;
            }
            
            // Connect to gym DB
            const gymDb = connectionManager.getConnection(uri);
            
            // Run automations sequentially
            await new Promise((resolve) => {
                dbStorage.run(gymDb, async () => {
                    try {
                        await runExpiryReminderAutomation(gymId, gymName);
                        await runLeadFollowUpAutomation(gymId, gymName);
                        await runBirthdayReminderAutomation(gymId, gymName);
                        await runAttendanceReminderAutomation(gymId, gymName);
                        await runChurnAnalysis(gymId, gymName);
                    } catch (automationErr) {
                        console.error(`[Cron] Error running automations for ${gymName}:`, automationErr.message);
                    }
                    resolve();
                });
            });
        }
        
        console.log('\n[Cron] Daily automation cycle completed.');
        
    } catch (err) {
        console.error('[Cron] Error processing gyms:', err.message);
    }
}

// Connect immediately
connectCentralDb().then(() => {
    // Schedule for 8:00 AM every day
    cron.schedule('0 8 * * *', () => {
        processAllGyms();
    });
    
    console.log('[Cron] Cron server is running. Scheduled for 8:00 AM daily.');
    
    // Uncomment the following line to run immediately upon startup (useful for testing)
    // processAllGyms(); 
});
