# Music Analysis Pipeline

This document describes how a track moves from **ingestion** (via admin endpoints) through **workers** and **status changes** until it is **analysed** and **stored** back in the database.

---

## Overview

```
Admin API (Java)  →  Redis (Celery queues)  →  Light Worker (Python)  →  DB: tracks created (PENDING)
                                                                     →  Redis (audio queue)
                                                                  →  Audio Worker (Python)  →  DB: analysis + DONE/FAILED
```

- **Ingestion**: Admin calls trigger **Spotify ingest** tasks. The **light worker** talks to Spotify, writes track/artist/album/link rows, and queues **audio analysis** for each new track.
- **Analysis**: The **audio worker** consumes the **audio** queue: fetches audio (YouTube), runs **neckenml** ML analysis, writes results and **classification** (dance styles) to the DB, and sets status to **DONE** or **FAILED**.

---

## 1. Admin endpoints (ingestion)

All of these are **async**: they enqueue a task and return immediately with a “queued” response.

| Endpoint | Purpose |
|----------|--------|
| `POST /api/admin/ingest` | Ingest a **playlist**, **album**, or **artist** by Spotify ID. Body: `{ "resourceId": "<id>", "resourceType": "playlist" \| "album" \| "artist" }`. |
| `POST /api/admin/spotify/ingest/album` | Ingest a single **album**. Body: `{ "spotify_album_id": "<id>" }`. |
| `POST /api/admin/spotify/ingest/track` | Ingest a single **track**. Body: `{ "spotify_track_id": "<id>" }`. |

Implementation:

- **MaintenanceController** (`POST /api/admin/ingest`) → **MaintenanceService.ingestResource()** → **TaskDispatcher.dispatchSpotifyIngest(resourceType, resourceId)**.
- **AdminSpotifyController** (`ingest/album`, `ingest/track`) → **AdminSpotifyService** → same **TaskDispatcher.dispatchSpotifyIngest(...)**.

So ingestion is “triggered” in the API and actually performed in the **light worker**.

**Implementation note:** The Java backend uses **jOOQ-only** for all database access (reads and writes). There is no JPA/Hibernate layer; domain classes under `se.dansbart.domain.*` are plain POJOs mapped from jOOQ records, and all queries go through `*JooqRepository` classes (e.g. `TrackJooqRepository`, `ArtistJooqRepository`, `AlbumJooqRepository`, analytics and feedback jOOQ repositories).

---

## 2. Task dispatcher (Java → Redis)

**Class**: `se.dansbart.worker.TaskDispatcher`

The API does **not** run Celery; it only **publishes** Celery-compatible JSON messages to **Redis lists** that Celery workers consume.

- **Queues** (Redis list names): `audio`, `feature`, `light`.
- **Spotify ingest**: `dispatchSpotifyIngest(resourceType, spotifyId)` builds a Celery message for task `app.workers.tasks_light.spotify_ingest_task` with args `[resourceType, spotifyId]` and **left-pushes** it onto the **`light`** queue.
- **Audio analysis**: `dispatchAudioAnalysis(trackId)` builds a message for `app.workers.tasks_audio.analyze_track_task` with args `[trackId.toString()]` and pushes to the **`audio`** queue.

Message format matches Celery’s Redis transport (base64-encoded body with args/kwargs, headers, properties, etc.) so that Python workers can consume the same Redis lists.

---

## 3. Light worker (ingestion and queueing)

**Queue**: `light`  
**Entry task**: `app.workers.tasks_light.spotify_ingest_task(resource_type, spotify_id)`

- **resource_type** `playlist` → `_ingest_playlist(spotify_id)`
- **resource_type** `album` → `_ingest_album(spotify_id)`
- **resource_type** `artist` → `_backfill_artist(spotify_id)` (artist discography)
- **resource_type** `track` → `_ingest_track(spotify_id)` (single track by Spotify track ID)
- Any other → returns an error.

Each path uses **SpotifyIngestor** (in `app.workers.ingestion.spotify`) to:

1. Call Spotify API (playlist tracks, album tracks, artist albums, or a single track via `sp.track(spotify_id)` for `track`).
2. For each track (or batch): **SpotifyIngestor._process_single_track()**:
   - Resolve or generate ISRC (fallback if missing).
   - **TrackRepository.get_by_isrc()**; if missing, **create_track()** (artist, album, track, links). New tracks get **processing_status** from DB default: **`PENDING`**.
   - Add Spotify playback link.
3. Collect list of track IDs that are **PENDING** (only those are queued for analysis).
4. Call **\_dispatch_audio_analysis(track_ids)**.

**\_dispatch_audio_analysis** (in `tasks_light.py`): for each track ID, sends a Celery task to the **`audio`** queue:

- Task: `app.workers.tasks_audio.analyze_track_task`
- Args: `[track_id]`
- Queue: `audio`

So: **ingestion creates/updates tracks in the DB (new ones PENDING) and immediately enqueues each PENDING track for analysis on the audio queue.**

---

## 4. Track status values

| Status      | Meaning |
|------------|--------|
| **PENDING**   | Created by ingestion (or reset); not yet picked up for analysis, or reset after a retry. |
| **PROCESSING**| Audio worker has started analysis for this track. |
| **DONE**      | Analysis and classification finished successfully. |
| **FAILED**    | Analysis failed after all retries (or unrecoverable error). |

- Default for new tracks (DB and model): **PENDING**.
- Only **PENDING** tracks are dispatched to the audio queue (by the light worker after ingest, or by the maintenance “queue pending” endpoint).

---

## 5. Maintenance: (re-)queue PENDING tracks

If tracks stay in **PENDING** (e.g. ingest ran but something consumed the queue before workers were ready, or you added tracks manually):

- **`POST /api/admin/maintenance/queue-pending-tracks?limit=500`**  
  **MaintenanceService.queuePendingTracksForAnalysis(limit)**:
  - Finds tracks with **processing_status = PENDING**, ordered by created_at, up to `limit`.
  - For each, calls **TaskDispatcher.dispatchAudioAnalysis(track.getId())** (same as the light worker’s `_dispatch_audio_analysis`).
  - Returns counts (e.g. how many queued, total pending).

Stuck **PROCESSING** tracks (e.g. worker died):

- **`POST /api/admin/maintenance/cleanup-orphaned?stuckThresholdMinutes=30`**  
  Finds tracks in **PROCESSING** older than the threshold, sets them back to **PENDING**, and **dispatches** each to the audio queue again.

---

## 6. Audio worker (analysis and DB write-back)

**Queue**: `audio`  
**Entry task**: `app.workers.tasks_audio.analyze_track_task(track_id)`  
**Code**: `dansbart.se/audio-worker/` (separate service; uses same DB and Redis.)

1. **Task (tasks_audio.py)**  
   - Gets or creates a long-lived **AnalysisService** (loads neckenml models once per process).
   - Opens a DB session and calls **AnalysisService.analyze_track_by_id(track_id)**.
   - On uncaught exception: retries with backoff (Celery `autoretry_for`, `retry_backoff=60`, `max_retries=3`). On final failure (or **MaxRetriesExceededError**): sets track **processing_status** to **FAILED** and commits. On retry: if status is **PROCESSING**, resets to **PENDING** so a later attempt can pick it up.
   - In `finally`: cleanup analyzer memory, GC, close DB session.

2. **AnalysisService.analyze_track_by_id(track_id)** (analysis service)  
   - Loads **Track** (with playback_links, album, artists).
   - Sets **processing_status = PROCESSING** and commits.
   - **\_process_single_track(track)**:
     - **Audio fetch**: Prefer existing working YouTube link; else search YouTube by artist + title. **AudioFetcher.fetch_track_audio()** downloads to a temp file (yt-dlp). If no audio found, can fall back to **\_classify_from_title()** (title-based style only) and still succeed.
     - **YouTube link**: If a new video was used, **\_ensure_youtube_link()** adds/keeps a **PlaybackLink** (platform=youtube, deep_link=video_id).
     - **ML analysis**: **AudioAnalyzer** (neckenml) **analyze_file(file_path, context)** → returns features and raw artifacts.
     - **DB write-back**:
       - **AnalysisRepository.add_analysis()**: insert **AnalysisSource** (track_id, source_type=`neckenml_analyzer`, raw_data=artifacts).
       - Update **Track** with: tempo_bpm, duration_ms, loudness, is_instrumental; swing_ratio, articulation, bounciness, punchiness; polska_score, hambo_score, voice_probability; bars, sections, section_labels; embedding.
       - Create **TrackStructureVersion** (bars/sections/labels, “Original AI Analysis”).
       - **ClassificationService.classify_track_immediately(track, analysis_data)** → uses neckenml **StyleClassifier** (and tempo categorization, keywords); writes **TrackDanceStyle** rows (dance style, confidence, tempo category, etc.). Skips if track has user-confirmed styles.
   - On success: **processing_status = DONE**; on failure (or no audio and no title fallback): **processing_status = FAILED**. Commit.
   - Cleanup: temp files, analyzer close, expire_all(), GC.

So the **audio worker** is where status moves **PENDING → PROCESSING → DONE or FAILED** and where analysis + classification are written back to the database.

---

## 7. Database tables touched

| Stage | Tables |
|-------|--------|
| **Ingestion (light worker)** | `tracks` (insert/update, default **PENDING**), `artists`, `albums`, `track_artists`, `track_albums`, `playback_links` (Spotify). |
| **Analysis (audio worker)** | `tracks` (status → PROCESSING then DONE/FAILED; analysis fields), `playback_links` (YouTube if new), `analysis_sources` (raw ML artifacts), `track_structure_versions`, `track_dance_styles` (classification). |

---

## 8. End-to-end flow (album ingest)

1. Admin calls **POST /api/admin/spotify/ingest/album** with `spotify_album_id`.
2. **TaskDispatcher** pushes **spotify_ingest_task("album", id)** to Redis **light** queue.
3. **Light worker** runs **spotify_ingest_task** → **\_ingest_album** → **SpotifyIngestor.ingest_album()** → for each track, **\_process_single_track** (create/update track, **PENDING**), then **\_dispatch_audio_analysis(pending_track_ids)**.
4. For each PENDING track ID, a message **analyze_track_task(track_id)** is pushed to Redis **audio** queue.
5. **Audio worker** runs **analyze_track_task** → **AnalysisService.analyze_track_by_id** → status **PROCESSING** → fetch audio (YouTube) → neckenml **analyze_file** → write **analysis_sources**, update **tracks**, **track_structure_versions**, **classify_track_immediately** → **track_dance_styles** → status **DONE** (or **FAILED** on error/retries).

### End-to-end flow (single-track ingest)

1. Admin calls **POST /api/admin/spotify/ingest/track** with body `{ "spotify_track_id": "<id>" }`.
2. **TaskDispatcher** pushes **spotify_ingest_task("track", spotify_track_id)** to Redis **light** queue.
3. **Light worker** runs **spotify_ingest_task** → **\_ingest_track(spotify_id)** → **SpotifyIngestor**: fetches **sp.track(spotify_id)**, then **ingest_tracks_from_list([track_data])** (one track). New track is created with **PENDING**; **\_dispatch_audio_analysis([track_id])** queues it to the **audio** queue.
4. **Audio worker** runs **analyze_track_task(track_id)** → same as above (PROCESSING → analysis → DONE/FAILED).

---

## 9. Summary

- **Ingestion** is triggered by admin endpoints; the **Java API** only enqueues to Redis (**TaskDispatcher**). The **light worker** performs Spotify ingest, creates/updates tracks (**PENDING**), and enqueues each PENDING track to the **audio** queue.
- **Analysis** is done in the **audio worker**: **PENDING → PROCESSING → DONE/FAILED**, YouTube fetch, neckenml analysis, and classification, with all results written back to the database.
- **Maintenance**: **queue-pending-tracks** (re-)sends PENDING tracks to the audio queue; **cleanup-orphaned** resets stuck PROCESSING tracks to PENDING and re-queues them.

---

## 10. Legacy Python backend (python_legacy) vs new backend

The **new backend** (dansbart.se/backend) provides the **same ingestion and analysis pipeline** as the legacy Python API (python_legacy), with one intentional change.

| Aspect | Legacy (python_legacy) | New backend |
|--------|------------------------|-------------|
| **Ingest endpoint** | `POST /ingest` body: `resource_id`, `resource_type` (playlist \| album \| artist) | `POST /api/admin/ingest` body: `resourceId`, `resourceType` (playlist \| album \| artist) |
| **Where ingestion runs** | **Synchronous** in the API process (PipelineService.ingest_and_process → SpotifyIngestor in-process) | **Asynchronous**: API only enqueues; **light worker** runs SpotifyIngestor and writes to DB |
| **Analysis queueing** | After ingest, API calls `analyze_track_task(tid)` for each PENDING track → **audio** queue | Light worker calls **\_dispatch_audio_analysis(track_ids)** after ingest → same **audio** queue, same task `app.workers.tasks_audio.analyze_track_task` |
| **Resource types** | playlist, album, artist | playlist, album, artist, plus **track** (single track via `POST /api/admin/spotify/ingest/track`) |
| **SpotifyIngestor** | Returns only **PENDING** track IDs (skips already DONE/PROCESSING) | Same: **PENDING** only (backend workers/feature SpotifyIngestor) |
| **Audio worker** | External Celery worker on **audio** queue | Same: **dansbart.se/audio-worker** consumes **audio** queue |

**Equivalence:** For a given Spotify playlist/album/artist ID, the same tracks are created/updated, the same PENDING tracks are queued for analysis, and the same audio worker task runs. The new backend is **correct** and improves responsiveness by making the ingest endpoint return immediately with `"status": "queued"` instead of blocking until all Spotify and DB work is done.
