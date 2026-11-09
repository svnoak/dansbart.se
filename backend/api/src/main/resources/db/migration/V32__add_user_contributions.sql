-- Logged-in users can add tracks and dance styles to the public library.
-- Admins review the additions afterwards and can ban a user who misuses it.

-- A banned user keeps listening and voting, but only with anonymous weight, and
-- cannot add tracks or dance styles.
ALTER TABLE users ADD COLUMN banned_at TIMESTAMPTZ;

-- One row per "add track" request. A YouTube link creates the track right away.
-- A Spotify link goes through the worker's normal ingest, so track_id stays NULL
-- until the worker has created the track (status QUEUED -> LINKED).
-- After analysis the submitter's dance style is put back as the primary style
-- (status LINKED -> DONE). A Spotify ingest that never produces a track ends FAILED.
CREATE TABLE track_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source VARCHAR(16) NOT NULL CHECK (source IN ('YOUTUBE', 'SPOTIFY')),
    external_id VARCHAR(64) NOT NULL,
    title VARCHAR,
    artist_name VARCHAR,
    dance_style VARCHAR NOT NULL,
    sub_style VARCHAR,
    tempo_category VARCHAR,
    track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
    created_track BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(16) NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'LINKED', 'DONE', 'FAILED')),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_track_submissions_status ON track_submissions (status) WHERE status IN ('QUEUED', 'LINKED');
CREATE INDEX ix_track_submissions_unreviewed ON track_submissions (created_at) WHERE reviewed_at IS NULL;
CREATE INDEX ix_track_submissions_user_created ON track_submissions (user_id, created_at);

-- Dance styles that users add. created_by is NULL for styles an admin added.
ALTER TABLE style_keywords
    ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN reviewed_at TIMESTAMPTZ;

CREATE INDEX ix_style_keywords_unreviewed ON style_keywords (created_at)
    WHERE created_by IS NOT NULL AND reviewed_at IS NULL;
