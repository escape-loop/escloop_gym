# Docker Hub Deployment Guide

## Published Images

Your application images are now available on Docker Hub:

- **Server**: `dev2917/escloop-gym-1-server:latest`
- **Client**: `dev2917/escloop-gym-1-client:latest`

## Quick Deployment

### Option 1: Use Pre-built Images (Recommended for Production)

Update your `docker-compose.yml` to use the published images instead of building locally:

```yaml
services:
  server:
    image: dev2917/escloop-gym-1-server:latest
    # Remove the 'build' section
    container_name: escloop-server
    # ... rest of configuration

  client:
    image: dev2917/escloop-gym-1-client:latest
    # Remove the 'build' section
    container_name: escloop-client
    # ... rest of configuration
```

Then deploy with:

```bash
docker-compose pull
docker-compose up -d
```

### Option 2: Continue Building Locally (Development)

Keep your current `docker-compose.yml` with the `build` sections for local development.

## Updating Images

When you make changes and want to update the Docker Hub images:

### 1. Build New Images

```bash
# Build server
docker build -t dev2917/escloop-gym-1-server:latest -f server/Dockerfile ./server

# Build client
docker build -t dev2917/escloop-gym-1-client:latest \
  --build-arg VITE_BACKEND_URL=/gym \
  --build-arg VITE_EVOLUTION_API_URL=/evolution-api \
  -f client/Dockerfile ./client
```

### 2. Push to Docker Hub

```bash
# Login (if not already logged in)
docker login

# Push images
docker push dev2917/escloop-gym-1-server:latest
docker push dev2917/escloop-gym-1-client:latest
```

### 3. Update Deployment

On your production server:

```bash
docker-compose pull
docker-compose up -d
```

## Version Tags (Optional)

For better version control, you can also tag with version numbers:

```bash
# Tag with version
docker tag dev2917/escloop-gym-1-server:latest dev2917/escloop-gym-1-server:v1.0.0
docker tag dev2917/escloop-gym-1-client:latest dev2917/escloop-gym-1-client:v1.0.0

# Push version tags
docker push dev2917/escloop-gym-1-server:v1.0.0
docker push dev2917/escloop-gym-1-client:v1.0.0
```

## Current Image Digests

- **Server**: `sha256:aa9220bdf1501cbc634f708e50ded5a6a18f7403f08488cfc398784ff02c7276`
- **Client**: `sha256:a946995e5b0f8b12240cd4b47bd03d3b63e54d76450d3216adcca0c3e0e11195`

## Troubleshooting

### Pull Latest Changes

If your client reports errors, they can pull the latest images:

```bash
docker-compose down
docker-compose pull
docker-compose up -d
```

### Force Rebuild

If you need to force a complete rebuild:

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Check Image Info

```bash
# View local images
docker images | grep escloop

# Inspect image
docker inspect dev2917/escloop-gym-1-server:latest
docker inspect dev2917/escloop-gym-1-client:latest
```
