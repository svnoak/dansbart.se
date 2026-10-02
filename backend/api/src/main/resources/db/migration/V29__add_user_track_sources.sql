CREATE TABLE user_track_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    provider VARCHAR(16) NOT NULL CHECK (provider IN ('LOCAL', 'GDRIVE', 'HIDRIVE')),
    provider_file_id TEXT,
    connection_id UUID,
    title TEXT NOT NULL,
    artist TEXT,
    album TEXT,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE NULLS NOT DISTINCT (user_id, track_id, provider, provider_file_id)
);
CREATE INDEX ix_user_track_sources_track_user ON user_track_sources (track_id, user_id);
