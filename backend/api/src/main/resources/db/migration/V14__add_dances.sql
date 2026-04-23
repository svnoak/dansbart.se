CREATE TABLE dances (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                  VARCHAR NOT NULL,
    slug                  VARCHAR NOT NULL UNIQUE,
    dance_description_url VARCHAR,
    danstyp               VARCHAR,   -- dance category from ACLA (e.g. "Hambo", "Vals")
    musik                 VARCHAR,   -- tune/track name from ACLA (e.g. "Lugn hambo")
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dance_tracks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dance_id     UUID NOT NULL REFERENCES dances(id) ON DELETE CASCADE,
    track_id     UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    added_by     UUID REFERENCES users(id),
    added_at     TIMESTAMPTZ DEFAULT NOW(),
    is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    confirmed_by UUID REFERENCES users(id),
    confirmed_at TIMESTAMPTZ,
    UNIQUE (dance_id, track_id)
);

CREATE INDEX idx_dance_tracks_dance_id  ON dance_tracks (dance_id);
CREATE INDEX idx_dance_tracks_track_id  ON dance_tracks (track_id);
CREATE INDEX idx_dance_tracks_confirmed ON dance_tracks (is_confirmed);
