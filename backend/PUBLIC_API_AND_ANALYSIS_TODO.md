# Public API and Analysis – Work to Be Done

This document lists all identified work so that **public pages** receive the attributes they use, and **music analysis** data is correctly persisted and returned.

---

## 1. Backend: Missing analysis fields in track response

**Problem:** The `/api/tracks` and `/api/tracks/search` responses return `bars: null`, `sections: null`, `sectionLabels: null`, and often `durationMs: 0` even after analysis has run.

### 1.1 Map bars, sections, sectionLabels in TrackJooqRepository

**File:** `api/src/main/java/se/dansbart/domain/track/TrackJooqRepository.java`

- **Issue:** `toTrack(Record r)` never sets `bars`, `sections`, or `sectionLabels` from the DB columns `TRACKS.BARS`, `TRACKS.SECTIONS`, `TRACKS.SECTION_LABELS` (JSONB).
- **Tasks:**
  - Inject `ObjectMapper` (same pattern as `TrackStructureVersionJooqRepository`).
  - In `toTrack()`, read each JSONB column; if non-null, parse to `List<Float>` (bars, sections) and `List<String>` (section_labels) using `TypeReference`. On parse failure, leave field null.
  - Add `.bars(...)`, `.sections(...)`, `.sectionLabels(...)` to the `Track.builder()` chain.

**Reference:** `TrackStructureVersionJooqRepository` uses `objectMapper.readValue(json.data(), Map.class)` for JSONB; for arrays use `TypeReference<List<Double>>` then convert to Float, or `TypeReference<List<String>>` for labels.

### 1.2 Duration always 0 (audio worker)

**File:** `audio-worker/app/services/analysis.py`

- **Issue:** The variable `result` is first the fetcher’s return (which includes `actual_duration_ms`), then overwritten by `result = analyzer.analyze_file(...)`. The analyzer does not return `actual_duration_ms`, so `result.get('actual_duration_ms', 0)` is always 0 and `track.duration_ms` is never set from the downloaded file.
- **Tasks:**
  - Immediately after the successful fetcher call, capture `actual_duration_ms = result.get('actual_duration_ms') or 0`.
  - Use a separate variable for the analyzer result, e.g. `analysis_result = analyzer.analyze_file(...)`.
  - When updating the track, set `track.duration_ms = actual_duration_ms` (and use `analysis_result["features"]` / `analysis_result["raw_artifacts"]` for the rest).
  - Optional: if `actual_duration_ms` is 0, fallback to `raw_artifacts.get("audio_stats", {}).get("duration_seconds")` and convert to ms.

---

## 2. Backend: Dance style and sub-style missing in public track payloads

**Problem:** The public search page and other public pages use `track.danceStyle` and `track.subStyle` (and style confidence), but the public track endpoints return the domain `Track` entity. On `Track`, the relationship `danceStyles` is `@JsonIgnore`, so these fields are never in the JSON. The admin library works because it uses `AdminTrackDto`, which explicitly includes `mainStyle`/`subStyle`.

### 2.1 Return DTOs from public track list and search

**Files:**

- `api/src/main/java/se/dansbart/domain/track/TrackController.java`
- `api/src/main/java/se/dansbart/domain/track/TrackService.java` (if needed for mapping)

**Current behaviour:**

- `GET /api/tracks` and `GET /api/tracks/search` return `PageResponse<Track>`.
- Frontend expects each item to have `danceStyle`, `subStyle`, and a confidence (e.g. `style_confidence` or `confidence`).

**Tasks:**

- Change the controller to return `PageResponse<TrackListDto>` (or `TrackDto` if full detail is desired for list views).
- After loading `List<Track>` from `TrackJooqRepository`, map with `TrackMapper.toListDtoList(tracks)`.
- Ensure `TrackListDto` is the type returned in the response body so the JSON includes `danceStyle`, `subStyle`, `effectiveBpm`, `confidence`, `artistName`, `playbackPlatform`, `playbackLink`, etc.

**Existing assets:** `TrackListDto`, `TrackMapper.toListDto(Track)` and `toListDtoList`, and `@Named("primaryDanceStyle")` / `primarySubStyle` / `primaryEffectiveBpm` / `primaryConfidence` already exist.

### 2.2 Return DTOs from discovery endpoints

**Files:**

- `api/src/main/java/se/dansbart/domain/discovery/DiscoveryController.java`
- `api/src/main/java/se/dansbart/domain/discovery/DiscoveryService.java`

**Endpoints:** `GET /api/discovery/popular`, `GET /api/discovery/recent`, `GET /api/discovery/curated` currently return `List<Track>`.

**Tasks:**

- In `DiscoveryService`, after obtaining `List<Track>` for popular/recent/curated, map with `TrackMapper.toListDtoList(tracks)` (or `toDtoList` if full `TrackDto` is preferred).
- Change controller return types to `List<TrackListDto>` (or `List<TrackDto>`) so responses include `danceStyle`, `subStyle`, and other fields used by `CompactTrackCard` and discovery UI.

### 2.3 Album detail and album tracks

**Files:**

- `api/src/main/java/se/dansbart/domain/album/AlbumController.java`
- `api/src/main/java/se/dansbart/domain/album/AlbumService.java` and/or repository/mapper usage

**Current behaviour:**

- `GET /api/albums/{id}` returns domain `Album`.
- `GET /api/albums/{id}/tracks` returns `List<Track>`.
- `AlbumPage` uses `TrackCard` for each track, which expects `danceStyle`, `subStyle`, artists, playback links, etc.

**Tasks:**

- Either:
  - Add or change an album-detail endpoint to return `AlbumDto` (with `List<TrackListDto> tracks` populated via `TrackMapper.toListDtoList`), and have the frontend use that for the album page; or
  - Change `GET /api/albums/{id}/tracks` to return `List<TrackListDto>` instead of `List<Track>`.
- Ensure `AlbumMapper` (or equivalent) builds album tracks with full `TrackListDto` (including dance style fields), not only id/title/duration/hasVocals. `AlbumMapper.toTrackListFromAlbumLinks` currently only sets a subset of fields; it should use `TrackMapper.toListDto` for each track or an equivalent that fills `danceStyle`, `subStyle`, playback, and artist.

### 2.4 Playlist endpoints (detail and shared)

**Files:**

- `api/src/main/java/se/dansbart/domain/playlist/PlaylistController.java`
- `api/src/main/java/se/dansbart/domain/playlist/PlaylistService.java` and playlist repository

**Current behaviour:**

- `GET /api/playlists/{id}` and `GET /api/playlists/share/{shareToken}` return domain `Playlist` (with nested `PlaylistTrack` and `Track`). Domain `Track` does not expose `danceStyle`/`subStyle` in JSON.

**Tasks:**

- For endpoints used by `PlaylistDetailPage` and shared playlist view, return a playlist DTO that embeds tracks as `PlaylistTrackDto` with `TrackListDto track` (i.e. each track has `danceStyle`, `subStyle`, `effectiveBpm`, `confidence`, `artistName`, `playbackPlatform`, `playbackLink`).
- Implement or reuse mapping from `Playlist` + `PlaylistTrack` + `Track` to `PlaylistDto` with `List<PlaylistTrackDto>` where each item’s `track` is built via `TrackMapper.toListDto(track)`.

---

## 3. Frontend: Align with backend DTOs

**After** the backend returns `TrackListDto`/`TrackDto` for the above endpoints:

- **OpenAPI/Orval:** Regenerate client from the updated API spec so that list/search, discovery, album, and playlist responses are typed with the DTOs (including `danceStyle`, `subStyle`, `confidence`, etc.).
- **Types:** Ensure `TrackDisplay` (or the generated type used in `TrackCard`, `CompactTrackCard`, etc.) matches the DTO: e.g. `danceStyle`, `subStyle`, `confidence` (or `styleConfidence` if that’s the DTO field name). Use camelCase consistently if the API returns camelCase.
- **Templates:** Confirm that `TrackCard` and related components use the same property names as the API (e.g. `track.danceStyle`, `track.subStyle`, `track.confidence` or `track.styleConfidence`). Fix any remaining `track.style_confidence` or snake_case references to match the DTO.

---

## 4. Summary table

| Area | Task | Owner (codebase) |
|------|------|------------------|
| Backend – analysis in response | Map `bars`, `sections`, `sectionLabels` in `TrackJooqRepository.toTrack()` from JSONB | `api/.../TrackJooqRepository.java` |
| Audio worker – duration | Preserve fetcher `actual_duration_ms`; use separate variable for analyzer result; set `track.duration_ms` from fetcher (or artifact fallback) | `audio-worker/.../analysis.py` |
| Backend – track list/search | Return `PageResponse<TrackListDto>` from `GET /api/tracks` and `GET /api/tracks/search` via `TrackMapper.toListDtoList` | `api/.../TrackController.java`, `TrackService` |
| Backend – discovery | Return `List<TrackListDto>` from discovery endpoints (popular, recent, curated) | `api/.../DiscoveryController.java`, `DiscoveryService.java` |
| Backend – album | Return album with tracks as `TrackListDto` (full style/playback/artist) for album detail or `GET /api/albums/{id}/tracks` | `api/.../AlbumController.java`, mappers |
| Backend – playlist | Return playlist DTO with embedded `TrackListDto` for each track for detail and share endpoints | `api/.../PlaylistController.java`, service/repository |
| Frontend | Regenerate API client; align types and template props with DTO (`danceStyle`, `subStyle`, `confidence`) | OpenAPI/Orval, `TrackCard`/`CompactTrackCard`/types |

---

## 5. Verification

- **Analysis fields:** After 1.1 and 1.2, run analysis (or re-analysis) for a track, then call `GET /api/tracks/search?q=...` or `GET /api/tracks` and confirm `bars`, `sections`, `sectionLabels` are non-null when present in DB and `durationMs` is set from the downloaded file.
- **Dance style:** For any public page that shows track cards (search, discovery, album, playlist), call the corresponding API and confirm each track object in the response has `danceStyle`, `subStyle`, and confidence (or equivalent) when the track has dance-style data in the database.
