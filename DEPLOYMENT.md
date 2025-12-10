# Deployment Guide

## Overview

This project uses GitHub Actions to automatically build and push Docker images to GitHub Container Registry (GHCR).

- **Production**: Triggered on push to `main` branch → `production` and `latest` tags
- **Beta**: Triggered on push to `develop` branch → `beta` tag

## Setup Instructions

### 1. Enable GitHub Container Registry

The workflows use `GITHUB_TOKEN` which is automatically provided by GitHub Actions. No additional secrets needed for building and pushing images!

### 2. Make Container Registry Public (Optional)

By default, GHCR packages are private. To make them public:

1. Go to your GitHub profile → Packages
2. Find `dansbart-frontend`, `dansbart-backend`, `dansbart-worker`
3. Click each package → Package settings → Change visibility → Public

### 3. Update Docker Compose Files

Replace `YOUR_GITHUB_USERNAME` in:
- [docker-compose.prod.yml](docker-compose.prod.yml)
- [docker-compose.beta.yml](docker-compose.beta.yml)

With your actual GitHub username (lowercase).

### 4. Set Up Environment Files on Servers

On your production server:
```bash
# Copy and configure production environment
cp .env.production.example .env.production
nano .env.production  # Edit with your production values
```

On your beta server:
```bash
# Copy and configure beta environment
cp .env.beta.example .env.beta
nano .env.beta  # Edit with your beta values
```

### 5. Deploy to Servers

#### Production Server

```bash
# Login to GHCR (one-time setup)
echo $GITHUB_PAT | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Pull and run
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

#### Beta Server

```bash
# Login to GHCR (one-time setup)
echo $GITHUB_PAT | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Pull and run
docker compose -f docker-compose.beta.yml pull
docker compose -f docker-compose.beta.yml up -d
```

**Note**: For the `docker login`, create a Personal Access Token (PAT) with `read:packages` scope:
- GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
- Generate new token with `read:packages` scope

## Workflow Details

### Production Workflow ([.github/workflows/deploy-production.yml](.github/workflows/deploy-production.yml))

**Triggers**:
- Push to `main` branch
- Manual dispatch

**Images Built**:
- `ghcr.io/YOUR_USERNAME/dansbart-frontend:production`
- `ghcr.io/YOUR_USERNAME/dansbart-frontend:latest`
- `ghcr.io/YOUR_USERNAME/dansbart-backend:production`
- `ghcr.io/YOUR_USERNAME/dansbart-backend:latest`
- `ghcr.io/YOUR_USERNAME/dansbart-worker:production`
- `ghcr.io/YOUR_USERNAME/dansbart-worker:latest`

### Beta Workflow ([.github/workflows/deploy-beta.yml](.github/workflows/deploy-beta.yml))

**Triggers**:
- Push to `develop` branch
- Manual dispatch

**Images Built**:
- `ghcr.io/YOUR_USERNAME/dansbart-frontend:beta`
- `ghcr.io/YOUR_USERNAME/dansbart-backend:beta`
- `ghcr.io/YOUR_USERNAME/dansbart-worker:beta`

## Automated Server Deployment (Optional)

To automatically deploy after building images, uncomment the SSH deployment steps in the workflow files and add these secrets to your GitHub repository:

**Production Secrets**:
- `PROD_HOST` - Production server IP/hostname
- `PROD_USER` - SSH username
- `PROD_SSH_KEY` - SSH private key

**Beta Secrets**:
- `BETA_HOST` - Beta server IP/hostname
- `BETA_USER` - SSH username
- `BETA_SSH_KEY` - SSH private key

Add secrets at: Repository → Settings → Secrets and variables → Actions → New repository secret

## Manual Deployment

You can manually trigger deployments from GitHub:
1. Go to Actions tab
2. Select "Deploy to Production" or "Deploy to Beta"
3. Click "Run workflow"
4. Select branch and run

## Checking Deployment Status

View workflow runs:
- GitHub repository → Actions tab
- See build logs, timings, and any errors

View published images:
- Your GitHub profile → Packages
- See all versions and tags

## Development Workflow

```bash
# Work on feature
git checkout -b feature/my-feature

# Commit and push
git commit -am "Add feature"
git push origin feature/my-feature

# Merge to develop → triggers beta deployment
git checkout develop
git merge feature/my-feature
git push origin develop
# ✅ Beta images automatically built and available

# When ready for production
git checkout main
git merge develop
git push origin main
# ✅ Production images automatically built and available
```

## Troubleshooting

### Images not building
- Check Actions tab for error logs
- Ensure Dockerfiles are valid
- Check that `package.json` exists in frontend/

### Can't pull images on server
- Verify you're logged in: `docker login ghcr.io`
- Check image names match exactly (case-sensitive)
- Ensure packages are public or you have read access

### Services not starting
- Check logs: `docker compose logs`
- Verify environment files exist and have correct values
- Ensure ports aren't already in use
