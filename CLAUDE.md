# dansbart.se

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
2. CI publishes a `:beta` image for each commit that lands on `main`.
3. Tag a commit that is already on `main` to cut production. The release workflow rejects a tag that points anywhere else.

## Migrations are append-only

Flyway stores a checksum for each migration that it applies. If you edit a migration that already ran on beta or on production, the application fails to start. CI rejects a pull request that changes, deletes, or renames an existing migration. Add a new migration instead.

Run `make migrations` to apply the migrations to the dev database and regenerate the jOOQ classes. Generate the jOOQ classes only from a database that holds the migrations of your branch. A database that holds a migration from another branch writes a field for a column that `main` does not have.

## Track lifecycle

`PENDING` -> `PROCESSING` -> `DONE` or `FAILED`. Workers set `processingStatus` and `errorMessage`.

If a worker crashes, its tracks stay in `PROCESSING`. To reset them, call `POST /api/admin/maintenance/cleanup-orphaned`.

## Authentication

- `SPRING_PROFILES_ACTIVE=local` turns off all authentication. Use it only for local development.
- Other profiles use DiscourseConnect SSO through `/sso/initiate` and `/sso/callback`.
- Classification does not require login. Anonymous voters send `X-Voter-ID`.

## Dance style configuration

The `dance_style_config` table stores the musical properties of each dance style, for example `beats_per_bar`. After classification, workers use it to re-derive bar positions from stored beat timestamps. A sub-style config has priority over its main style config.

- API: `/api/admin/style-config` in `domain/admin/style/`.
- Workers: `style_config_cache.py` (5-minute cache) and `bar_correction.py`.
- Frontend: `/admin/style-config` in `AdminStyleConfigPage.tsx`.

## Known issues

- `TrackController.getSimilarTracks` returns `Track` entities. `Track` hides `danceStyles` with `@JsonIgnore`, so that response has no dance styles.
