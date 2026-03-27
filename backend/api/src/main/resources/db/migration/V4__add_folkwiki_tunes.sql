-- Folkwiki tune reference data and track-to-folkwiki matching.
--
-- folkwiki_tunes: stores tune metadata scraped from folkwiki.se
-- track_folkwiki_matches: links dansbart tracks to folkwiki tunes,
--   with match_type (how the match was found) and match_status
--   (whether an admin has confirmed or rejected the match).

CREATE TABLE folkwiki_tunes (
    id            SERIAL PRIMARY KEY,
    folkwiki_id   TEXT NOT NULL UNIQUE,
    title         TEXT NOT NULL,
    normalized_title TEXT NOT NULL,
    style         TEXT,
    meter         TEXT,
    beats_per_bar INTEGER,
    folkwiki_url  TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_folkwiki_tunes_normalized_title ON folkwiki_tunes(normalized_title);
CREATE INDEX idx_folkwiki_tunes_style ON folkwiki_tunes(style);

CREATE TABLE track_folkwiki_matches (
    track_id         UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    folkwiki_tune_id INTEGER NOT NULL REFERENCES folkwiki_tunes(id) ON DELETE CASCADE,
    match_type       TEXT NOT NULL CHECK (match_type IN ('exact', 'contains')),
    match_status     TEXT NOT NULL DEFAULT 'pending' CHECK (match_status IN ('pending', 'confirmed', 'rejected')),
    confirmed_by     TEXT,
    confirmed_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (track_id, folkwiki_tune_id)
);

CREATE INDEX idx_track_folkwiki_matches_status ON track_folkwiki_matches(match_status);
CREATE INDEX idx_track_folkwiki_matches_folkwiki_tune_id ON track_folkwiki_matches(folkwiki_tune_id);

-- Track where a classification came from: 'ml' (default, from the classifier),
-- 'folkwiki' (confirmed via folkwiki match), or 'manual' (admin override).
ALTER TABLE track_dance_styles
    ADD COLUMN classification_source TEXT NOT NULL DEFAULT 'ml'
    CHECK (classification_source IN ('ml', 'folkwiki', 'manual'));