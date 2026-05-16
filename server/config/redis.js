const Redis = require('ioredis');

let redis = null;

const connectRedis = () => {
    try {
        redis = new Redis({
            host: '127.0.0.1',
            port: 6379,
            lazyConnect: true,
            retryStrategy: (times) => {
                if (times > 3) {
                    console.warn('[Redis] Max retries reached. Redis will be unavailable.');
                    return null; // Stop retrying
                }
                return Math.min(times * 200, 2000);
            },
            enableOfflineQueue: false,
        });

        redis.on('connect', () => {
            console.log('[Redis] ✅ Connected to Redis on 127.0.0.1:6379');
        });

        redis.on('error', (err) => {
            // Suppress repeated error logs — just warn once
            if (err.code === 'ECONNREFUSED') {
                console.warn('[Redis] ⚠️  Redis not available. Running without cache (all requests go to MongoDB).');
            }
        });

        redis.connect().catch(() => {
            // Silently handle initial connection failure
        });

    } catch (err) {
        console.warn('[Redis] Failed to initialize:', err.message);
    }

    return redis;
};

const getRedis = () => redis;

const getCachedPlan = async (gymId) => {
    if (!redis) return null;
    try {
        const cached = await redis.get(`plan:${gymId}`);
        return cached ? JSON.parse(cached) : null;
    } catch (err) {
        console.warn('[Redis] Error getting cached plan:', err.message);
        return null;
    }
};

const setCachedPlan = async (gymId, planData) => {
    if (!redis) return;
    try {
        // Cache plan data for 1 hour (3600 seconds)
        await redis.setex(`plan:${gymId}`, 3600, JSON.stringify(planData));
    } catch (err) {
        console.warn('[Redis] Error setting cached plan:', err.message);
    }
};

module.exports = { connectRedis, getRedis, getCachedPlan, setCachedPlan };
