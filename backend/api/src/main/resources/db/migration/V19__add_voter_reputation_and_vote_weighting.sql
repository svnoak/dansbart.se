-- voter_reputation: per-authenticated-user multiplier applied to their vote weight.
-- Anonymous voters always use a fixed base weight (VoterReputationService.ANONYMOUS_WEIGHT)
-- and never get a row here — the FK to users(id) only ever admits real accounts.
CREATE TABLE voter_reputation (
    voter_id   UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.00,
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Migrate voter_id from VARCHAR to UUID in both vote tables. Existing values are
-- UUID-shaped strings (crypto.randomUUID() for anonymous voters, an authenticated user's
-- id otherwise) except for a small number of non-UUID placeholder ids from early manual
-- testing (e.g. voter_id = '1') — those are normalized to a fresh random UUID first so
-- the type change doesn't fail, and so each such row keeps counting as its own distinct
-- vote rather than colliding with any other row on the UNIQUE constraints below.
UPDATE track_style_votes SET voter_id = gen_random_uuid()::text
    WHERE voter_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
UPDATE dance_track_votes SET voter_id = gen_random_uuid()::text
    WHERE voter_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

-- Existing constraints/indexes on these columns (track_style_votes' UNIQUE(track_id,
-- voter_id) from V18, dance_track_votes' UNIQUE(dance_id, track_id, voter_id) from V15)
-- carry over across the type change.
ALTER TABLE track_style_votes ALTER COLUMN voter_id TYPE UUID USING voter_id::UUID;
ALTER TABLE dance_track_votes ALTER COLUMN voter_id TYPE UUID USING voter_id::UUID;

-- Weight columns: default 1.0 backfills existing rows as anonymous-equivalent weight,
-- consistent with every vote up to this migration having been anonymous-weighted.
ALTER TABLE track_style_votes ADD COLUMN weight NUMERIC(5,2) NOT NULL DEFAULT 1.0;
ALTER TABLE dance_track_votes ADD COLUMN weight NUMERIC(5,2) NOT NULL DEFAULT 1.0;

-- Indexes for the weighted-sum queries (hot paths in feedback + voting services).
CREATE INDEX ix_track_style_votes_track_style ON track_style_votes (track_id, suggested_style);
CREATE INDEX ix_dance_track_votes_dance_track  ON dance_track_votes (dance_id, track_id);
