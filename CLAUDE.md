# dansbart.se

@AGENTS.md

Swedish folk music site. People find music to dance to and classify tracks by dance style and tempo.

- Contributor workflow and test commands: `CONTRIBUTING.md`.
- Every PR must link an issue (`Closes #123`). CI checks this.
- Path-scoped rules for each service are in `.claude/rules/`.

## Services

- `backend/api/`: Java 21, Spring Boot 3.2, jOOQ, Flyway, PostgreSQL with pgvector. Package `se.dansbart`. Port 8000.
- `frontend/`: React 19, strict TypeScript, Tailwind CSS v4, Vitest. Port 5173.
- `backend/workers/feature/`: Python Celery worker. Queues `feature` and `light`. Uses `neckenml-core`.
- `backend/workers/audio/`: an unsynced copy of the audio worker. The canonical code is in `svnoak/dansbart.se-audio-worker`. CI builds the production audio image from this copy.

The frontend calls the Java API over REST. The API reads and writes PostgreSQL. The API sends long tasks to the Python workers through Redis and Celery. The workers write results directly to PostgreSQL.

## Checks

Run `make check` before you push. It runs the same commands that CI runs. `make fix` applies the formatting. `make help` lists every target.

Branch protection on `main` requires the `CI Gate` status check.

## How code reaches users

Development is trunk-based. There is no long-lived `develop` branch.

1. Open a pull request from a branch to `main`.
2. The release workflow builds an image for each commit that lands on `main` and passes CI, tagged with the commit SHA and `latest`.
3. The same workflow asks the private deployment repository to open or update a release pull request that pins that SHA. Merging that pull request deploys to production. There is no beta environment.

## Migrations are append-only

Flyway stores a checksum for each migration that it applies. If you edit a migration that already ran on production, the application fails to start. CI rejects a pull request that changes, deletes, or renames an existing migration. Add a new migration instead.

Run `make migrations` to apply the migrations to the dev database and regenerate the jOOQ classes. Generate the jOOQ classes only from a database that holds the migrations of your branch. A database that holds a migration from another branch writes a field for a column that `main` does not have.

## Track lifecycle

`PENDING` -> `PROCESSING` -> `DONE` or `FAILED`. Workers set `processingStatus` and `errorMessage`.

If a worker crashes, its tracks stay in `PROCESSING`. To reset them, call `POST /api/admin/maintenance/cleanup-orphaned`.

## Authentication

- `SPRING_PROFILES_ACTIVE=local` turns off all authentication. Use it only for local development.
- Other profiles use DiscourseConnect SSO through `/sso/initiate` and `/sso/callback`.
- Classification does not require login. Anonymous voters send `X-Voter-ID`.

## Cloud storage connectors

`domain/providerconnection/` holds one `*Connector` per provider (`GDRIVE`, `HIDRIVE`) and stores encrypted refresh tokens in `provider_connections`. `OAuthConnectionService` runs the connect flow for every `OAuthConnector`, under `/api/connections/{slug}/start` and `/callback`. A new provider adds a connector, a migration for the `provider` check constraints, and the labels in the frontend. The `local` profile points the HiDrive connector at a stub served under `/stub/hidrive`, so the connect flow works without a HiDrive account. `CONTRIBUTING.md` describes the stub and what is still unverified against the real HiDrive.

## User contributions

Signed-in users add tracks and dance styles to the public library under `/api/contributions` (`domain/contribution/`, frontend `/lagg-till`). Additions are public at once; admins review them afterwards at `/admin/contributions`.

- A YouTube or Spotify link creates the track in the API (`LinkedTrackCreator`) and dispatches `analyze_track_task`. For YouTube the analysis downloads that exact video; for Spotify it searches YouTube by artist and title. Adding never waits for the feature worker or for Spotify: when the Spotify lookup fails, the typed title is enough. `TrackSubmissionResolverJob` puts the submitter's style back as primary after analysis.
- The admin import of a single Spotify track (`POST /api/spotify/ingest/track`, admins only) creates the track the same way. Albums, artists and playlists still go through the feature worker, which finds a track the API created by its Spotify link or ISRC.
- The submitter's style is stored with `is_user_confirmed`, so the classifier keeps it.
- A track a person added (`tracks.uploader_id` set) is listed in `GET /api/tracks` at once, before its analysis. Other tracks wait for `DONE`, because the spider ingests tracks of artists an admin has not approved.
- A new dance style is a `style_keywords` row with `created_by` set.
- `users.banned_at` blocks adding. A banned user still votes, with anonymous weight (`VoterReputationService`).

## Guest codes

A guest code lets anyone add to one playlist or one dance list without an account, for a dance evening or a course (`domain/guestcode/`, table `list_guest_codes`, frontend `/kod` and `GuestCodePanel`). The QR code of a list is the address `/kod/{code}`.

- The people with full control of a list create, replace and remove its code: `POST` and `DELETE /api/playlists/{id}/guest-code` and `/api/dance-lists/{id}/guest-code`. A list has at most one code. `guestCode` in the list's DTO is sent only to them.
- A guest reads the list and adds to it under `/api/public/guest-codes/{code}`. A playlist code adds tracks; a dance list code adds dances, from the site or by name, each with one track if the guest picks one. The code gives no other right: a guest cannot remove, reorder or rename.
- A track a guest picks for a dance from the site is a vote that the track fits the dance, as it is when a person who edits the list links one. The vote is cast for the guest's `X-Voter-ID`, with anonymous weight, or for their account if they are signed in. Removing the track or the dance from the list withdraws it.
- A guest cannot add a private track. What a guest added has `added_by_guest` set and shows as "Tillagd med kod" to the people who edit the list.
- `GuestCodeRateLimiter` caps the public endpoints per address. It counts in memory, per API instance.

## Dance style configuration

The `dance_style_config` table stores the musical properties of each dance style, for example `beats_per_bar`. After classification, workers use it to re-derive bar positions from stored beat timestamps. A sub-style config has priority over its main style config.

- API: `/api/admin/style-config` in `domain/admin/style/`.
- Workers: `style_config_cache.py` (5-minute cache) and `bar_correction.py`.
- Frontend: `/admin/style-config` in `AdminStyleConfigPage.tsx`.

## Known issues

- `TrackController.getSimilarTracks` returns `Track` entities. `Track` hides `danceStyles` with `@JsonIgnore`, so that response has no dance styles.
