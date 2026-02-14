## React Library & Search Frontend – Implementation Plan

This document summarizes the **implementation plan** for the React frontend, mirroring the detailed Cursor plan (`react_library_search_frontend_23012f8e.plan.md`) but colocated with the codebase.

The high-level goal is to build a **React + TypeScript** frontend that:

- Focuses first on **Library & Search** with URL-driven filters.
- Provides a **mobile-native feel** while being **fully functional and well-structured on desktop**.
- Uses **embedded playback only** (YouTube/Spotify iframes), with no third-party cover art.
- Preserves the existing **voting/feedback** mechanisms.

---

## 1. Current state (summary)

- Legacy frontend is a Vue app:
  - Routes like `/`, `/search`, `/artist/:id`, `/album/:id`, `/track/:id`, `/classify`, plus auth/playlist.
  - Search filters mirrored in query params and restored on load.
  - Orval-generated API client from `../api-spec/openapi.yaml`.
  - Voting via `X-Voter-ID` header stored in localStorage.
- API:
  - `GET /api/tracks` with `GetTracksParams` (style, subStyle, source, vocals, BPM/duration ranges, ML attributes, pagination).
  - Additional endpoints for styles, stats, artists, albums, discovery.
- Constraints:
  - **No third-party cover art** in the new app.
  - **Embedded playback only**; do not open external apps/tabs as primary action.
  - **All visible UI copy must be in Swedish** (button labels, headings, helper text, error messages, etc.).
  - Prefer backend-owned identifiers/URLs instead of raw Spotify/YouTube IDs.

---

## 2. Architecture & routing

- New app lives in `frontend-react/`, independent of the legacy Vue app.
- Stack:
  - Vite + React + TypeScript (strict).
  - **Strict typing**: no `any`; avoid `unknown` — use concrete types everywhere. Use `unknown` only when necessary (e.g. external input) and narrow before use.
  - **Tailwind CSS** for styling (utility-first; shared primitives and responsive layouts use Tailwind classes).
  - React Router 6.
  - Orval client generated from `../api-spec/openapi.yaml`.
- Core routes:
  - `/` – Discovery / home.
  - `/search` (or `/library`) – Library & Search.
  - `/artist/:id`, `/album/:id`, `/track/:id` – detail views.
  - `/classify` – quiz / classify flow (later).
- URL query params mirror existing Vue app naming:
  - `q`, `style`, `subStyle`, `searchType`, `source`, `vocals`, `confirmed`, `traditional`,
    `tempo`, `minDur`, `maxDur`, `minBounce`, `maxBounce`, `minArt`, `maxArt`.
- URL is treated as **source of truth**:
  - On load: parse params → filter state → API calls.
  - On state change: update URL (with `setSearchParams` / `navigate`) without full reload.
- **Colors & theming**
  - Use **global color configuration** (e.g. CSS custom properties or Tailwind theme) so colors are defined in one place and easy to customize later.
  - **Light/dark mode**: Implemented as a **user-controlled** header toggle (not system `prefers-color-scheme`). Preference stored in `localStorage`; semantic tokens and `.dark` on the root drive the theme. See `DESIGN.md` §4.

---

## 3. Page structure & shared components

- **Reusable modules & components**
  - Prefer **shared, reusable components and modules** over one-off or page-local implementations.
  - Colocate reusable UI in a clear structure (e.g. `components/` or `ui/`) and reuse across pages (Library, Discovery, detail pages, player).
  - When adding behaviour or UI, first check for an existing primitive (Button, Card, Pill, etc.); extend or compose it rather than creating a new ad-hoc component.
- **Layout** (as implemented; see `DESIGN.md` for full spec)
  - **Header**: Logo (D + wordmark), stats chips from `GET /api/stats` (track count, % categorized, last added), global search, theme toggle, user avatar (initials). No Radio Akka.
  - **Left sidebar**: Icons on all items; Library & Search, Discover Artists, Playlist Builder, Folk Map; COMMUNITY (My Studio, Rhythm Police); Weekly Challenge card. Light grey background; active state = blue rounded rectangle.
  - Main content area for page-specific UI.
  - **Global player**: Rounded bar with heart/music placeholder, full controls (shuffle, ±10 s, prev/play/next, repeat), progress + duration, volume slider; expandable for embed + queue.
- **Desktop vs mobile**
  - **Desktop layout (not stretched mobile)**:
    - Sidebar permanently visible; content uses a denser, information-rich layout.
  - **Mobile (“mobile native” feel)**:
    - Header and search adapt to smaller screens.
    - Navigation collapses (e.g. drawer or bottom nav).
    - Fullscreen player when tapping the player bar.
  - **Shared primitives, responsive layouts**:
    - Buttons, inputs, cards, headers, track/artist/album cards, and player controls are shared across breakpoints.
    - Layout-level components (`PageLayout`, `SidebarLayout`, `MobileNav`, `DesktopSidebar`) branch per breakpoint without duplicating business logic.

---

## 4. Library & Search (Phase 1 focus)

- Layout (see `DESIGN.md` for visual spec):
  - Top: site header (logo, stats chips, user placeholder).
  - Main: search input → filter bar → results list.
  - Filter bar:
    - Source (All, Spotify, YouTube).
    - Vocals (Vocal, Instr).
    - Category (main style), Specific dance (sub-style).
    - Verified style toggle.
    - Tempo control (slider or range, optional).
    - Search type (Tracks, Artists, Albums).
    - “Clear filters” action.
- Results:
  - `RESULTS (N)` label and list of cards (tracks/artists/albums).
  - Infinite scroll or “Load more” using `limit` / `offset`.
- Track card:
  - Embedded-only play button that controls the **global player**.
  - Style badges, tempo label, duration, vocal/instrument tag.
  - Title, artist links to detail pages.
  - Actions: flag/report, similar tracks, add to queue, share, go to artist/album.
  - **No cover art** beyond placeholders.

---

## 5. Voting & feedback

- Re-implement the `voter` util:
  - Generate and store `voterId` in localStorage.
  - Attach `X-Voter-ID` to relevant requests.
- Expose in UI via:
  - “Flag / Report problem” actions on track cards.
  - Modal for style/tempo corrections and “not folk” flags.

---

## 6. Global player & queue

- Embedded playback only:
  - YouTube and Spotify iframes (or backend-provided embed URLs).
- Behaviour:
  - Support switching between sources for the current track.
  - Default source preference: YouTube when multiple sources exist.
  - Draggable progress bar (works best with YouTube; keep UI consistent for Spotify).
- Queue:
  - Queue list visible/manipulable from player:
    - Jump to item, remove, reorder (drag), clear.
  - Queue persists (e.g. localStorage) so playback can continue between sessions.
- Mobile:
  - Tapping the player bar opens a fullscreen player with the same controls and queue access.

---

## 7. Copyright & API usage

- Do not render third-party cover images.
- For playback, prefer backend-owned embed URLs or IDs:
  - Public endpoints should avoid exposing raw Spotify/YouTube IDs.
  - Frontend uses `embedUrl` or similar to construct iframe `src`.

---

## 8. Suggested implementation order

1. **Backend (optional in phase 1)**: Introduce public DTOs omitting third-party metadata; provide embed URLs or IDs suitable for iframes.
2. **Scaffold React app** (done):
   - `frontend-react/`, Vite + React + TS, React Router, Orval (fetch client, body-only responses), Docker config.
   - Add and configure **Tailwind CSS** (if not already present) so all new UI uses Tailwind utility classes.
3. **Route table & URL ↔ filter state**:
   - Implement Library page shell that reads URL and renders header + filter bar + empty results area using responsive shared primitives from a reusable component set (no page-only one-offs).
4. **Filter bar**:
   - Implement all controls with URL sync and API mappings; ensure touch-friendly on mobile and dense layout on desktop.
5. **Results lists & cards**:
   - Track/artist/album cards (no cover art) with responsive spacing and typography.
   - Wire to `getTracks`, `searchArtists`, `getAlbums` based on `searchType` and `q`.
6. **Global player & queue**:
   - Embedded player, progress, prev/next, shuffle/repeat, queue with persistence.
   - Fullscreen mobile player view when tapping the bar.
7. **Artist & album pages**:
   - Detail views with track lists reusing the same card components.
8. **Flag/Report & voter util**:
   - Implement modal and API integration for feedback and flags.
9. **Discovery page**:
   - Style shortcuts, trending artists, recommended albums, CTAs; responsive layout per `DESIGN.md`.
10. **Polish & QA**:
    - Verify mobile-native feel and complete desktop experience across all pages.
    - Accessibility, keyboard navigation, and deep link handling (`/track/:id`, shared URLs).

For full detail, see the Cursor plan `react_library_search_frontend_23012f8e.plan.md` and the design reference in `DESIGN.md`.

