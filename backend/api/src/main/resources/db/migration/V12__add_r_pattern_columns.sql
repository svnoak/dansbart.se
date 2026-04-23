ALTER TABLE public.tracks
    ADD COLUMN r1_mean               DOUBLE PRECISION,
    ADD COLUMN r2_mean               DOUBLE PRECISION,
    ADD COLUMN r3_mean               DOUBLE PRECISION,
    ADD COLUMN asymmetry_score       DOUBLE PRECISION,
    ADD COLUMN asymmetry_consistency DOUBLE PRECISION,
    ADD COLUMN pattern_type          VARCHAR(32),
    ADD COLUMN ternary_confidence    DOUBLE PRECISION,
    ADD COLUMN meter_ambiguous       BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_tracks_asymmetry_score ON public.tracks (asymmetry_score);
CREATE INDEX idx_tracks_pattern_type    ON public.tracks (pattern_type);
