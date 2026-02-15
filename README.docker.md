# Docker Deployment Guide

The **frontend** service is the **React (Vite)** app in `frontend-react/`. The legacy Vue app is in `frontend/` and is not used by this compose file. If you see the Vue app after `docker compose up --build frontend`, run `docker compose build --no-cache frontend` then `docker compose up frontend`. Do not use `docker-compose.prod.yml` for local frontend (it uses a pre-built image that may be Vue).

## Development Mode

Run with hot-reload and live editing:

```bash
# Start all services in dev mode
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Or just rebuild frontend
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build frontend
```

## Production Mode

### Local Production Build

```bash
# Build production images
docker-compose build

# Run production stack
docker-compose up
```

## Docker Hub Deployment (Free Tier Strategy)

**Free tier limitation**: 1 private repository

### Option 1: Use Public Repositories (Recommended)
```bash
# Tag images
docker tag dansbart-frontend:latest yourusername/dansbart-frontend:latest
docker tag dansbart-backend:latest yourusername/dansbart-backend:latest

# Push to Docker Hub (public repos are free)
docker push yourusername/dansbart-frontend:latest
docker push yourusername/dansbart-backend:latest
```

### Option 2: Single Private Repo (Multi-arch)
Combine both services with tags:

```bash
# Tag with different names under one repo
docker tag dansbart-frontend:latest yourusername/dansbart:frontend
docker tag dansbart-backend:latest yourusername/dansbart:backend

# Push both under same repo
docker push yourusername/dansbart:frontend
docker push yourusername/dansbart:backend
```

### Option 3: Use GitHub Container Registry (Free Private)
Unlimited private repos:

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Tag images
docker tag dansbart-frontend:latest ghcr.io/yourusername/dansbart-frontend:latest
docker tag dansbart-backend:latest ghcr.io/yourusername/dansbart-backend:latest

# Push
docker push ghcr.io/yourusername/dansbart-frontend:latest
docker push ghcr.io/yourusername/dansbart-backend:latest
```

## Image Sizes (Estimated)

- **Frontend**: ~50MB (nginx:alpine + built assets)
- **Backend**: ~1.5GB (Python + ML dependencies)
- **Worker**: Same as backend (~1.5GB)

## Production Optimizations

The production frontend Dockerfile:
- ✅ Multi-stage build (discards node_modules)
- ✅ Minified JavaScript bundles
- ✅ Tree-shaken Tailwind CSS (only used classes)
- ✅ Optimized nginx:alpine base (~40MB)
- ✅ Production React (Vite) build (smaller, faster)

## Quick Commands

```bash
# Build only frontend for production
docker-compose build frontend

# Test production build locally
docker-compose up frontend

# View image sizes
docker images | grep dansbart
```
