const { getRedis } = require('../config/redis');
const tenantStorage = require('../middleware/tenantContext');

const DAY = 86400; // 24 hours in seconds
const HOUR = 3600; // 1 hour in seconds

// ─── Core Helpers ─────────────────────────────────────────────────────────────

const get = async (key) => {
    const redis = getRedis();
    if (!redis || redis.status !== 'ready') return null;
    try {
        const val = await redis.get(key);
        return val ? JSON.parse(val) : null;
    } catch (e) {
        return null;
    }
};

const set = async (key, value, ttl = DAY) => {
    const redis = getRedis();
    if (!redis || redis.status !== 'ready') return;
    try {
        await redis.setex(key, ttl, JSON.stringify(value));
    } catch (e) {
        // Silently fail — cache is best-effort
    }
};

const del = async (key) => {
    const redis = getRedis();
    if (!redis || redis.status !== 'ready') return;
    try {
        await redis.del(key);
    } catch (e) { }
};

/**
 * Get from cache or fetch from DB and cache the result.
 * @param {string} key - Redis key
 * @param {Function} fetchFn - Async function to fetch from DB if cache miss
 * @param {number} ttl - TTL in seconds
 */
const getOrSet = async (key, fetchFn, ttl = DAY) => {
    const cached = await get(key);
    if (cached !== null) {
        console.log(`[Cache] ✅ HIT  → ${key}`);
        return cached;
    }
    console.log(`[Cache] ❌ MISS → ${key} (fetching from DB)`);
    const data = await fetchFn();
    await set(key, data, ttl);
    return data;
};

// ─── Cache Keys ───────────────────────────────────────────────────────────────

const getPrefix = () => {
    const gymId = tenantStorage.getStore();
    return gymId ? `cache:${gymId}` : `cache:global`;
};

const KEYS = {
    get MEMBERS_ALL() { return `${getPrefix()}:members:all`; },
    get SUBSCRIPTIONS_ALL() { return `${getPrefix()}:subscriptions:all`; },
    get STAFF_ALL() { return `${getPrefix()}:staff:all`; },
    get PLANS_ALL() { return `${getPrefix()}:plans:all`; },
    get GYM_SETTINGS() { return `${getPrefix()}:gym:settings`; },
    GYM_SETTINGS_PUBLIC: (gymId) => `cache:${gymId}:gym:settings:public`,
    get PENDING_PAYMENTS() { return `${getPrefix()}:notifications:pending_payments`; },
    get SPECIAL_CLASSES() { return `${getPrefix()}:special_classes`; },
    memberById: (id) => `${getPrefix()}:member:id:${id}`,
    memberByPhone: (phone) => `${getPrefix()}:member:phone:${phone}`,
    staffById: (id) => `${getPrefix()}:staff:id:${id}`,
    staffByPhone: (phone) => `${getPrefix()}:staff:phone:${phone}`,
    revenue: (periodType, year, month, day) => {
        let key = `${getPrefix()}:revenue:${periodType}:${year}:${month}`;
        if (day) key += `:${day}`;
        return key;
    },
};

// ─── Invalidation Helpers ─────────────────────────────────────────────────────

const invalidateMembers = async () => {
    console.log('[Cache] 🗑️  Invalidating: members');
    await del(KEYS.MEMBERS_ALL);
};

const invalidateSubscriptions = async () => {
    console.log('[Cache] 🗑️  Invalidating: subscriptions');
    await del(KEYS.SUBSCRIPTIONS_ALL);
    await del(KEYS.PENDING_PAYMENTS);
    await invalidateSpecialClasses();
};

const invalidateSpecialClasses = async () => {
    console.log('[Cache] 🗑️  Invalidating: special classes');
    await del(KEYS.SPECIAL_CLASSES);
};

const invalidateStaff = async () => {
    console.log('[Cache] 🗑️  Invalidating: staff');
    await del(KEYS.STAFF_ALL);
};

const invalidatePlans = async () => {
    console.log('[Cache] 🗑️  Invalidating: membership plans');
    await del(KEYS.PLANS_ALL);
};

const invalidateGymSettings = async () => {
    console.log('[Cache] 🗑️  Invalidating: gym settings');
    await del(KEYS.GYM_SETTINGS);
    const gymId = tenantStorage.getStore();
    if (gymId) {
        await del(KEYS.GYM_SETTINGS_PUBLIC(gymId));
    }
};

const invalidateMemberById = async (memberId, phone) => {
    if (memberId) await del(KEYS.memberById(memberId));
    if (phone) await del(KEYS.memberByPhone(phone));
};

const invalidateStaffById = async (staffId, phone) => {
    if (staffId) await del(KEYS.staffById(staffId));
    if (phone) await del(KEYS.staffByPhone(phone));
};

const invalidateRevenue = async () => {
    // Delete all revenue cache keys for the CURRENT tenant using SCAN (safe for production)
    const redis = getRedis();
    if (!redis || redis.status !== 'ready') return;
    try {
        const pattern = `${getPrefix()}:revenue:*`;
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
            await redis.del(...keys);
            console.log(`[Cache] 🗑️  Invalidating: ${keys.length} revenue cache entries for ${getPrefix()}`);
        }
    } catch (e) { }
};

module.exports = {
    get, set, del, getOrSet,
    KEYS, DAY, HOUR,
    invalidateMembers,
    invalidateSubscriptions,
    invalidateStaff,
    invalidatePlans,
    invalidateGymSettings,
    invalidateMemberById,
    invalidateStaffById,
    invalidateRevenue,
    invalidateSpecialClasses,
};
