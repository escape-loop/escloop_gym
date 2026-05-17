const mongoose = require('mongoose');
const GymSettings = require('../models/GymSettings');

class ConnectionManager {
    constructor() {
        this.connections = new Map();
    }

    /**
     * Get an existing connection for a URI, or create a new one.
     */
    getConnection(uri) {
        if (!uri) {
            throw new Error('MongoDB URI is required to get a connection');
        }

        if (this.connections.has(uri)) {
            return this.connections.get(uri);
        }

        // Removed log to prevent URI leak
        const conn = mongoose.createConnection(uri);

        conn.on('connected', () => {
            // Silently connected
        });

        conn.on('error', (err) => {
            console.error(`[ConnectionManager] Connection error for ${uri.split('@').pop()}:`, err);
        });

        conn.on('disconnected', () => {
            // Silently disconnected
        });

        this.connections.set(uri, conn);
        return conn;
    }

    /**
     * Pre-warm connections by finding all unique URIs in the Central DB.
     * Call this after the Central DB connection is established.
     */
    async warmConnections() {
        try {
            const gyms = await GymSettings.find({ mongoUri: { $exists: true, $ne: '' } }).lean();
            
            const uniqueUris = new Set();
            gyms.forEach(gym => uniqueUris.add(gym.mongoUri));

            uniqueUris.forEach(uri => {
                this.getConnection(uri);
            });
        } catch (error) {
            console.error('[ConnectionManager] Error warming up connections:', error);
        }
    }
}

const connectionManager = new ConnectionManager();

module.exports = connectionManager;
