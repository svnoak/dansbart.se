# Dansbart React Frontend

React + TypeScript frontend for [dansbart.se](https://dansbart.se): music discovery for Swedish folk dance. Replaces the legacy Vue public app over time; built mobile-first, with URL-driven search/filters and embedded playback.

## Tech stack

- **Vite** + **React 19** + **TypeScript** (strict)
- **React Router 6** for routes and URL state
- **Orval** – typed API client generated from `../api-spec/openapi.yaml`
- No emojis in code or UI

## Development

```bash
npm install
npm run dev
```

- App: **http://localhost:5173**
- `/api` is proxied to `http://localhost:8000` (start the backend separately or via Docker).

### Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run build` | Type-check and production build → `dist/` |
| `npm run preview` | Serve `dist/` locally |
| `npm run api:generate` | Regenerate API client from OpenAPI spec |
| `npm run lint` | Run ESLint |

## Docker

From the **repository root** (where `docker-compose.yml` lives):

```bash
docker compose build frontend
docker compose up
```

- React app in Docker: **http://localhost:8080**
- Nginx serves static files and proxies `/api/` to the `api` service.

The image uses a multi-stage build (Node build, then nginx serve) and `npm ci` for reproducible builds. See `Dockerfile` and `nginx.conf`.

## What’s implemented so far

### 1. Project and tooling

- New app in `frontend-react/` (legacy Vue app remains in `frontend/`).
- Vite config: `@` path alias to `src/`, proxy for `/api` in dev.
- TypeScript strict; path alias in `tsconfig.app.json`.
- Orval config targeting the same OpenAPI spec as the Vue app (Discovery, Tracks, Artists, Albums, Styles, Stats, Analytics, etc.); generated client under `src/api/generated` and models under `src/api/models`.
- Orval generates a fetch-based client; responses are the response body (no wrapper).
- React Router and `react-router-dom` installed.

### 2. Page structure (desktop)

- **Layout** (`src/layout/Layout.tsx`): header, main content, right sidebar, bottom player shell.
- **Header** (`src/layout/Header.tsx`):
  - “Dansbart” wordmark.
  - **Global search bar**: single field for tracks, artists, albums; on submit navigates to `/search` with `q` and default `searchType=tracks`.
- **Right sidebar** (`src/layout/Sidebar.tsx`):
  - **Search** – link to Search page (keeps current query when applicable).
  - **Discovery** – link to home.
  - Bottom CTA: **“Take a quiz to make the site better”** → `/classify`.
- **Global player shell** (`src/player/GlobalPlayerShell.tsx`): fixed bottom bar with placeholder “Select a track to start listening” (embedded player and queue to be added).
- **Layout CSS** (`src/layout/Layout.css`): sticky header, main + 260px sidebar on desktop, sidebar hidden on small screens, basic styles for search, nav, CTA, and player bar.

### 3. Search page (skeleton)

- **Route:** `/` and `/search` both render `SearchPage`.
- **URL state:** `useSearchParams`; ensures `searchType` is set (default `tracks`), reflected in the URL.
- Placeholder content: “Library & Search” heading and a short line showing current `q` and `searchType` (confirms URL sync with header search).

### 4. Docker and deploy

- Root `docker-compose.yml` already points the `frontend` service at `./dansbart.se/frontend-react` and its `Dockerfile`.
- `frontend-react/Dockerfile`: multi-stage (Node build, nginx serve); uses `npm ci`; copies `dist/` into nginx docroot.
- `frontend-react/nginx.conf`: SPA `try_files` and proxy of `/api/` to `http://api:8000`.
- `.dockerignore` added to keep build context small (e.g. `node_modules`, `dist`, `.git`).

## Not yet implemented

- Filter bar and full URL sync for all search params (style, subStyle, source, vocals, tempo, duration, bounciness, articulation, verified, traditional).
- Data fetching: `getTracks`, `searchArtists`, `getAlbums` wired to Search page with filters.
- Track / artist / album result cards and lists (with play, style badges, links; no third-party cover art).
- Embedded global player (YouTube/Spotify iframes, source switch, prefer YouTube, draggable progress bar).
- Queue (continue playing, list, jump/remove/reorder/clear) and persistence (e.g. localStorage).
- Mobile: fullscreen player when tapping the player bar.
- Discovery page (e.g. style overview, popular/recent, CTAs).
- Artist and album detail pages.
- Flag/Report modal (feedback + flag) and voter util.
- Similar tracks modal, Add YouTube link modal, Cookie consent, Share track.
- Auth (Authentik) and playlists (later phase).

## Plan reference

Implementation follows the **React Library and Search Frontend** plan: general page structure and Search page first, then player/queue, discovery, and remaining checklist items. See the plan document for full scope and URL/playback/copyright constraints.
