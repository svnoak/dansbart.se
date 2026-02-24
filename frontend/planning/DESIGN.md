## Dansbart React Frontend – UI Design

This document describes the desktop-first visual design and layout for the new React frontend, while keeping a **mobile-native feel** and ensuring a **fully working desktop experience**.

The primary pages covered here are:

- **Library & Search** – search, filters, and results.
- **Discovery / Home** – style shortcuts, trending artists, recommended albums.

The global layout and components are shared across mobile and desktop with responsive behaviour.

**Implementation status:** The sections below have been updated to match the current React implementation (header with stats and theme switch, sidebar with icons and Community block, filter bar styling, track card badges, and global player with full controls). Light/dark mode is user-controlled via a header toggle; there is no Radio Akka in the UI.

---

## 1. Global layout

- **Shell layout**
  - **Header (top bar)**:
    - Left: logo (dark “D” in rounded square) + `dansbart.se` wordmark.
    - Stats chips (from API): track count (“X låtar”), “X% kategoriserade” (green checkmark), “Tillagd: date” (clock icon).
    - Center: global search input (placeholder: “Sök låtnamn, artist…”).
    - Right: theme toggle (light/dark; user choice, not system), user avatar (initials e.g. “JD” in blue circle).
    - No Radio Akka or other on-air indicator.
  - **Sidebar (left)**:
    - Light grey background; each nav item has an icon.
    - Primary navigation:
      - `Library & Search` (search icon)
      - `Discover Artists` (Spotify-style icon)
      - `Playlist Builder` (list icon)
      - `Folk Map` (map icon)
    - **COMMUNITY** section (grey label): `My Studio`, `Rhythm Police` (with icons).
    - Selected item: full-width within the nav bar, lighter blue background, darker blue (accent) as right border; no rounded corners.
    - Bottom: “Veckans utmaning” / Weekly Challenge card with CTA (“Starta quiz”).
  - **Content area (center/right)**:
    - Page header and filters.
    - Main interactive content (lists, grids, cards).
  - **Global player (bottom bar)**:
    - Rounded bar with margin and shadow (not full-bleed).
    - Left: artwork placeholder (heart icon when no track; music note when playing), track title, artist.
    - Center: shuffle, rewind 10 s, prev, large blue play/pause, next, forward 10 s, repeat; progress bar with current time and duration.
    - Right: source icons (YouTube, Spotify when available), speaker icon, volume slider.
    - Tapping the bar (when a track is set) expands to show embed and queue.

- **Responsiveness**
  - **Desktop**:
    - Sidebar is always visible and fixed.
    - Content uses a max-width layout with comfortable whitespace.
  - **Mobile / tablet**:
    - Sidebar collapses into a drawer or bottom navigation.
    - Header search and filter bar stack vertically.
    - Global player remains sticky at the bottom; tapping opens a fullscreen player view with the same controls.

---

## 2. Library & Search page

### 2.1 Layout

- **Page header**
  - Large search input spanning most of the content width:
    - Placeholder: “Search track name, artist…”.
    - Search icon on the left; clear / submit affordances on the right.
  - Compact dropdown on the right to select **Search type** (`Tracks` / `Artists` / `Albums`).

- **Filter bar (horizontal, single row; wraps on small screens)**
  - **Source filter**: Pills `Alla`, `Spotify`, `YouTube`; active = blue.
  - **Vocal filter**: Pills `Alla`, `Sång`, `Instr`; active “Instr” = green with small note icon; “Sång”/“Alla” = default blue when active.
  - **Category filters** (tracks only): `Alla kategorier` and `Specifik dans` dropdowns.
  - **Verified style**: Checkbox “Verifierad stil” (tracks only).
  - **Tempo** (tracks only): Pill to enable; when on, min/max BPM number inputs.
  - **Clear filters**: “Rensa filter” link on the right when any filter is active.

- **Results area**
  - Header row: “Resultat (N)” in grey uppercase; “Rensa filter” in blue on the right when applicable.
  - **Track cards list**:
    - Cards: white, rounded, subtle shadow (`shadow-sm`).
    - Left: circular blue play button (play/pause state).
    - Top badges:
      - Style (e.g. `MAZURKA`) as blue pill, uppercase; click applies style filter.
      - Vocal/instrumental: “Sång” = grey pill, “Instru” = green pill.
    - Main text: track title (semibold), artist name (muted).
    - Optional: BPM and duration in small muted text.
    - Right: Spotify/YouTube icons (when available), flag (report) icon, overflow menu (queue, share, go to track, report).
  - Pagination: “Ladda fler” button at the end of the list.

### 2.2 Behaviour

- **Search input**:
  - Updates URL query parameters and triggers search.
  - Works together with the search type dropdown.
- **Filters**:
  - All filters are URL-synced for shareable state.
  - Active filters use filled/colored pills and visible handles.
  - “Clear Filters” resets filters (but may keep the search text, depending on UX decision).
- **Track cards**:
  - Play button starts embedded playback in the global player; no external apps or tabs.
  - Style badge click applies that style as a filter.
  - Overflow menu exposes extra actions (queue, share, go to artist/album, report).

### 2.3 Desktop vs mobile

- **Desktop**:
  - Filter bar laid out in a single row where possible.
  - Results use wider cards with comfortable horizontal padding to show more information.
- **Mobile**:
  - Filters may wrap into multiple rows or become a horizontally scrollable filter strip.
  - Track cards maintain large tap targets and reduce side padding to fit narrow screens.

---

## 3. Discovery / Home page

### 3.1 Layout

- **Top row: style shortcuts**
  - Row of prominent style cards:
    - Style name (e.g. `Polska`, `Schottis`, `Vals`, `Brudmarsch`).
    - Track count as subtitle.
    - Distinct background color and iconography per style.
    - Click navigates to Library with the style filter applied.

- **Main sections**
  - **Trending Artists** (left column on desktop):
    - Section header with icon and title.
    - Vertical list of artists:
      - Avatar/placeholder on the left.
      - Artist name and metadata (region, album count) on the right.
  - **Recommended Albums** (right column on desktop):
    - Section header with title.
    - Horizontal grid or carousel of album cards:
      - Square artwork placeholder (no third-party cover art).
      - Album title and artist underneath.
      - Optional overlay icon for quick actions (e.g. play).

- **Sidebar contextual block**
  - “Weekly Challenge” card:
    - Title, short description, and primary button (“Start Quiz”).
    - Uses stronger background color and rounded corners.

### 3.2 Behaviour

- Style cards:
  - Route to Library & Search with pre-filled filters.
- Trending artists / recommended albums:
  - Click opens artist/album detail pages.
- Weekly challenge:
  - Click starts the quiz / classify flow.

### 3.3 Desktop vs mobile

- **Desktop**:
  - Style cards appear in one row with equal widths.
  - Trending artists and recommended albums appear side by side.
- **Mobile**:
  - Style cards become horizontally scrollable chips.
  - Trending artists and recommended albums stack vertically; album cards may become a horizontal slider.
  - Weekly challenge card is surfaced higher in the scroll for visibility.

---

## 4. Visual style

- **Theme**
  - **Light/dark mode**: User-controlled via a toggle in the header (sun/moon). Preference stored in `localStorage`; not tied to system `prefers-color-scheme`. CSS variables and a `.dark` class on the root drive theme.
- **Color**
  - Light background overall (dark in dark mode via semantic tokens).
  - Deep blue as the primary accent for active nav, primary buttons, selected source pill, style badges on track cards.
  - **Green** for “Instr” (instrumental) when selected in filters and on track cards.
  - Soft pastel backgrounds for style shortcut cards (Discovery).
  - Neutral greys for borders, dividers, and inactive states.
- **Typography**
  - Clean sans-serif family.
  - Clear hierarchy: headers and section titles larger/medium or bold; track titles semibold; metadata and captions smaller, muted.
- **Surfaces**
  - Rounded corners and subtle shadows for cards and elevated elements.
  - Selected navigation items: full-width, lighter blue background, accent blue as right border. Active filter pills: blue (or green for Instr).

---

## 5. Component mapping

- **Layout**
  - `Layout` – wraps header, sidebar, content, and global player; mobile sidebar as overlay/drawer.
  - `Header` – D logo + wordmark, stats chips (from `/api/stats`), global search, theme toggle, user avatar (initials).
  - `Sidebar` – nav items with icons (Library & Search, Discover Artists, Playlist Builder, Folk Map), COMMUNITY block (My Studio, Rhythm Police), Weekly Challenge card.
  - `GlobalPlayerShell` – rounded bar; placeholder (heart/music icon), track info; shuffle, rewind 10s, prev, play, next, fwd 10s, repeat; progress + duration; source icons, volume slider; expandable embed + queue.

- **Library & Search**
  - `LibrarySearchPage`
  - `SearchBar` and `SearchTypeSelect`
  - `FilterBar` (source, vocals, verified, categories, substyle, tempo, clear)
  - `ResultsHeader`
  - `TrackCard`, `ArtistCard`, `AlbumCard`

- **Discovery**
  - `DiscoveryPage`
  - `StyleShortcutCard`
  - `ArtistList` / `ArtistListItem`
  - `AlbumGrid` / `AlbumCard`
  - `WeeklyChallengeCard`

- **Shared primitives**
  - `Button`, `IconButton`, `Pill` (with optional `variant="green"` for Instr), `Badge`
  - `Card`, `SectionTitle`
  - `AvatarPlaceholder`, `ArtworkPlaceholder`
  - `ThemeProvider` / `useTheme` for light/dark (user toggle).

These components are built as **shared, responsive primitives** reused across mobile and desktop. Playlist Builder, Folk Map, My Studio, and Rhythm Police currently route to existing pages (e.g. `/search`) until dedicated routes exist.

