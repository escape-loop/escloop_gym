const GymSettings = require('../models/GymSettings');

class GymUriCache {
    constructor() {
        // Map of gymId -> mongoUri
        this.cache = new Map();
    }

    /**
     * Get the MongoDB URI for a given gymId.
     * Uses in-memory cache first, falls back to Central DB.
     */
    async getUri(gymId) {
        if (!gymId) return null;

        // 1. Check Cache
        if (this.cache.has(gymId)) {
            return this.cache.get(gymId);
        }

        // 2. Fallback to Central DB (Global connection)
        try {
            console.log(`[GymUriCache] Cache miss for gymId: ${gymId}. Fetching from Central DB...`);
            const gym = await GymSettings.findOne({ gymId }).lean();
            
            if (gym && gym.mongoUri) {
                this.cache.set(gymId, gym.mongoUri);
                return gym.mongoUri;
            } else {
                console.warn(`[GymUriCache] No mongoUri found in Central DB for gymId: ${gymId}`);
                return null;
            }
        } catch (error) {
            console.error(`[GymUriCache] Error fetching URI for gymId: ${gymId}`, error);
            return null;
        }
    }

    /**
     * Clear the cached URI for a specific gymId.
     * Useful when a gym's URI is updated/migrated.
     */
    invalidate(gymId) {
        if (this.cache.has(gymId)) {
            this.cache.delete(gymId);
            console.log(`[GymUriCache] Invalidated cache for gymId: ${gymId}`);
        }
    }

    /**
     * Pre-load all gymId -> URI mappings on server startup.
     */
    async warmCache() {
        try {
            console.log('[GymUriCache] Warming up cache...');
            const gyms = await GymSettings.find({ mongoUri: { $exists: true, $ne: '' } }).lean();
            
            let count = 0;
            for (const gym of gyms) {
                if (gym.gymId && gym.mongoUri) {
                    this.cache.set(gym.gymId, gym.mongoUri);
                    count++;
                }
            }
            
            console.log(`[GymUriCache] Warm-up complete. Cached ${count} gym URIs.`);
        } catch (error) {
            console.error('[GymUriCache] Error warming up cache:', error);
        }
    }
}

const gymUriCache = new GymUriCache();

module.exports = gymUriCache;
