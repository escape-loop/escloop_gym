/**
 * tenantContext.js
 * 
 * Uses Node.js AsyncLocalStorage to store the current request's gymId.
 * This creates a per-request "context" that any code downstream in the
 * request lifecycle — including Mongoose model hooks — can read from
 * without needing to explicitly pass gymId through every function call.
 * 
 * This is the backbone of the MongoDB Row-Level Security (RLS) system.
 */
const { AsyncLocalStorage } = require('async_hooks');

// A single global instance shared across the entire server process.
// Each HTTP request will have its own isolated store within this instance.
const tenantStorage = new AsyncLocalStorage();

module.exports = tenantStorage;
