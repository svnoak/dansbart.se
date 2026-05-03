CREATE TABLE dance_track_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dance_id UUID NOT NULL REFERENCES dances(id) ON DELETE CASCADE,
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    voter_id VARCHAR(36) NOT NULL,
    vote SMALLINT NOT NULL CHECK (vote IN (1, -1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (dance_id, track_id, voter_id)
);

CREATE INDEX ix_dance_track_votes_dance_id ON dance_track_votes(dance_id);
CREATE INDEX ix_dance_track_votes_track_id ON dance_track_votes(track_id);
