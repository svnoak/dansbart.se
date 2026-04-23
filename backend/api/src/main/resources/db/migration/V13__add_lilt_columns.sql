ALTER TABLE public.tracks
    ADD COLUMN lilt_score       DOUBLE PRECISION,
    ADD COLUMN lilt_consistency DOUBLE PRECISION,
    ADD COLUMN lilt_pattern     JSONB;

CREATE INDEX idx_tracks_lilt_score ON public.tracks (lilt_score);
