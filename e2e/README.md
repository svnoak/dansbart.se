# Dansbart E2E Tests

Real end-to-end tests against the full stack: **database**, **API**, **frontend**, **worker-feature** (Spotify ingestion), and **worker-audio** (track analysis).

## Why tracks can stay PENDING (ingestion vs analysis)

Ingestion and analysis are two steps:

1. **Ingestion** (worker-feature / light queue): Admin ingest → API dispatches `spotify_ingest_task` → light worker fetches playlist from Spotify, creates tracks in DB with status **PENDING**, and enqueues **audio** tasks for each track.
2. **Analysis** (worker-audio / audio queue): **worker-audio** must be running to consume the **audio** queue. It runs `analyze_track_task`, sets status to **PROCESSING**, then **DONE** or **FAILED**.

If **worker-audio** is not running (or exits on startup), tasks sit in the Redis `audio` queue and tracks never leave PENDING. **run-e2e.sh** now builds worker-audio from **dansbart.se/audio-worker** (so one clone is enough), waits for it to be ready, and fails early if the container is not up.

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for Playwright)
- Root `.env` with `ADMIN_PASSWORD=123` and optional `SPOTIPY_CLIENT_ID` / `SPOTIPY_CLIENT_SECRET` for ingestion

## Quick start

From the **repository root** (where `docker-compose.yml` lives):

```bash
# Option A: One command (starts stack, waits for health, runs tests)
./dansbart.se/e2e/run-e2e.sh
```

```bash
# Option B: Manual (from repo root; worker-audio required for track analysis)
docker compose up -d db redis api frontend worker-feature worker-audio
# Wait ~30–60s for API health (worker-audio may take longer to build/start)
cd dansbart.se/e2e && npm install && npx playwright install --with-deps && npm run e2e
```

**Note:** If you run from `dansbart.se/` using `dansbart.se/docker-compose.yml`, use **worker-feature** and **worker-audio** (both are defined there).

## What is tested

### API (public)

- **Health:** `GET /actuator/health`
- **Config:** `GET /api/config/auth`
- **Tracks:** `GET /api/tracks`, `GET /api/tracks/search`
- **Artists:** `GET /api/artists`, `GET /api/artists/search`
- **Albums:** `GET /api/albums`, `GET /api/albums/search`
- **Styles:** `GET /api/styles/tree`, `GET /api/styles/keywords`
- **Stats:** `GET /api/stats`
- **Discovery:** `GET /api/discovery/popular`, `/recent`, `/curated`, `/by-style`, `/playlists`

### API (admin, with token)

- **Auth:** `POST /api/admin/auth/login`, `GET /api/admin/auth/verify`
- **Admin:** `GET /api/admin/tracks`, `/api/admin/artists`, `/api/admin/maintenance/isrc-stats`, `/api/admin/spider/stats`, `/api/admin/spider/history`, `/api/admin/rejections`, `/api/admin/pending-artists`, `/api/admin/style-keywords`, `/api/admin/analytics/dashboard`
- **Ingest:** `POST /api/admin/ingest` (playlist ID `1LY6TJlCf4IFIXNoiayw4t`), then poll `GET /api/tracks` until tracks appear (up to 90s)

### Frontend

- **Main app (/):** Loads without console errors, `#app` visible, no critical API failures, nav/main content visible
- **Admin (/admin/):** Loads without errors, shows login form when unauthenticated, password login shows panel, ingest section visible after login

## Environment

| Variable           | Default                    | Description                          |
|-------------------|----------------------------|--------------------------------------|
| `API_URL`         | `http://localhost:8000`    | Backend API base URL                  |
| `FRONTEND_URL`    | `http://localhost:8080`   | Frontend base URL (Playwright)       |
| `ADMIN_PASSWORD`  | `123`                      | Admin password (must match root `.env`) |
| `E2E_PLAYLIST_ID` | `1LY6TJlCf4IFIXNoiayw4t`   | Spotify playlist ID for ingest test  |
| `E2E_SKIP_AUDIO_PIPELINE` | `0` | Set to `1` or `true` to skip the test that requires worker-audio to process at least one track. By default the test runs; `run-e2e.sh` starts worker-audio from `dansbart.se/audio-worker` and waits for it. |

`run-e2e.sh` loads the root `.env` before running tests so `ADMIN_PASSWORD` and other vars are set.

## First-time setup

Install Playwright browsers once:

```bash
cd dansbart.se/e2e && npx playwright install --with-deps
```

## Commands

```bash
npm run e2e          # Run all E2E tests (headless)
npm run e2e:headed   # Run with browser visible
npm run e2e:ui       # Open Playwright UI
```

## Stopping the stack

From repo root:

```bash
docker compose down
```
