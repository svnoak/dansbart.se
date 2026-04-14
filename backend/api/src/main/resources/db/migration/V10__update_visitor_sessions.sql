-- Replace user identity link with a privacy-safe authenticated flag.
-- Add device type and behavioral area flags for cohort analysis.
ALTER TABLE visitor_sessions
    ADD COLUMN is_authenticated BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN device_type      VARCHAR(20),
    ADD COLUMN used_search      BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN used_playlists   BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN used_library     BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN used_discovery   BOOLEAN NOT NULL DEFAULT FALSE;
