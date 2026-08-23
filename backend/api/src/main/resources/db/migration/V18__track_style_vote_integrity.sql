-- track_style_votes had no uniqueness guarantee on (track_id, voter_id), even though
-- application code always treated a voter's vote on a track as singular (upsert).
-- Defensively collapse any duplicate rows before enforcing that invariant in the schema,
-- keeping the most recently written row per pair.
DELETE FROM track_style_votes a
USING track_style_votes b
WHERE a.track_id = b.track_id
  AND a.voter_id = b.voter_id
  AND (a.created_at, a.id) < (b.created_at, b.id);

ALTER TABLE track_style_votes
    ADD CONSTRAINT uq_track_style_votes_track_voter UNIQUE (track_id, voter_id);

-- Secondary-style confirmations previously had no per-voter dedup at all, so a single
-- voter (or repeat anonymous calls) could inflate track_dance_styles.confirmation_count
-- indefinitely. This table lets confirmSecondaryStyle enforce "one confirmation per
-- voter per style" the same way track_style_votes now enforces one vote per track.
CREATE TABLE track_secondary_style_confirmations (
    track_id UUID NOT NULL,
    dance_style_id UUID NOT NULL,
    voter_id VARCHAR NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (track_id, dance_style_id, voter_id),
    CONSTRAINT fk_tssc_track FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    CONSTRAINT fk_tssc_dance_style FOREIGN KEY (dance_style_id) REFERENCES track_dance_styles(id) ON DELETE CASCADE
);
CREATE INDEX idx_tssc_dance_style ON track_secondary_style_confirmations(dance_style_id);
