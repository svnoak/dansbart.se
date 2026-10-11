-- Tracks that people add through the "Lägg till musik" page from a Spotify or
-- YouTube link. One row per track; the rows from one link share a batch_id so the
-- page and the admin review can show them together.
--
-- Anonymous-first, like community_suggestions: voter_id is the X-Voter-ID identity
-- (or the user id when signed in) and user_id is set only for signed-in people.
--
-- status values:
--   'pending'  waiting for an admin, because the submitter is not yet trusted
--   'approved' the track was created (track_id) and sent for analysis
--   'rejected' an admin turned it down
--   'exists'   the catalog already had the track (track_id points at it)
CREATE TABLE track_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL,
    voter_id UUID,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    provider VARCHAR(16) NOT NULL CHECK (provider IN ('spotify', 'youtube')),
    source_kind VARCHAR(16) NOT NULL CHECK (source_kind IN ('track', 'album', 'artist', 'playlist', 'channel')),
    source_url TEXT NOT NULL,
    source_name TEXT,
    external_id VARCHAR(255) NOT NULL,
    title TEXT NOT NULL,
    artist_name TEXT,
    artist_external_id VARCHAR(255),
    album_name TEXT,
    album_external_id VARCHAR(255),
    cover_image_url TEXT,
    duration_ms INTEGER,
    isrc VARCHAR(32),
    suggested_main_style VARCHAR(100),
    suggested_sub_style VARCHAR(100),
    status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'exists')),
    track_id UUID REFERENCES tracks(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_track_submissions_status_created ON track_submissions (status, created_at DESC);
CREATE INDEX ix_track_submissions_batch ON track_submissions (batch_id);
CREATE INDEX ix_track_submissions_voter ON track_submissions (voter_id);
-- One open review per external track: a second link to a track that is already
-- waiting reuses the pending row instead of queueing it twice.
CREATE UNIQUE INDEX ux_track_submissions_pending_external
    ON track_submissions (provider, external_id) WHERE status = 'pending';
