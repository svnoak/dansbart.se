ALTER TABLE tracks
    ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN content_hash VARCHAR(64);
CREATE UNIQUE INDEX ux_tracks_content_hash ON tracks (content_hash) WHERE content_hash IS NOT NULL;
