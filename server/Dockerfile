# ========================================
# Server Dockerfile - Node.js Express API
# ========================================
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Create necessary directories for file persistence
# Note: These will be overridden by volume mounts, but we create them for structure
RUN mkdir -p /app/uploads /app/public/invoices

# Create entrypoint script to fix permissions at runtime
RUN echo '#!/bin/sh' > /entrypoint.sh && \
    echo 'echo "Fixing permissions for uploads and public directories..."' >> /entrypoint.sh && \
    echo 'mkdir -p /app/uploads/members /app/uploads/staff /app/uploads/plans /app/uploads/gym /app/uploads/members/medicalReports' >> /entrypoint.sh && \
    echo 'mkdir -p /app/public/invoices' >> /entrypoint.sh && \
    echo 'chown -R node:node /app/uploads /app/public' >> /entrypoint.sh && \
    echo 'echo "Permissions fixed. Starting server..."' >> /entrypoint.sh && \
    echo 'exec node server.js' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

# Expose the server port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/gym/plans', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))" || exit 1

# Use entrypoint script to fix permissions then start server
ENTRYPOINT ["/entrypoint.sh"]
