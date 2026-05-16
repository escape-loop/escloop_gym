# ========================================
# Client Dockerfile - React (Vite) with Nginx
# Multi-stage build for minimal production image
# ========================================

# ----------------
# Stage 1: Build
# ----------------
FROM node:20-alpine AS build

WORKDIR /app

# Accept build arguments for Vite environment variables
# These are baked into the static build at compile time
ARG VITE_BACKEND_URL=/gym
ARG VITE_EVOLUTION_API_URL=/evolution-api
ARG VITE_EVOLUTION_API_KEY=mySecretGlobalApiKey123

# Set environment variables for Vite build
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_EVOLUTION_API_URL=$VITE_EVOLUTION_API_URL
ENV VITE_EVOLUTION_API_KEY=$VITE_EVOLUTION_API_KEY

# Copy package files for dependency installation
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy application source
COPY . .

# Build the production bundle
RUN npm run build

# ----------------
# Stage 2: Production
# ----------------
FROM nginx:alpine AS production

# Remove default nginx static content
RUN rm -rf /usr/share/nginx/html/*

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built static files from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
