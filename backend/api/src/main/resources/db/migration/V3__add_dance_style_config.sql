-- Dance style configuration table
-- Maps dance styles to their musical properties (beats_per_bar, etc.)
-- Used by workers to correct bar positions after classification.

CREATE TABLE dance_style_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    main_style VARCHAR NOT NULL,
    sub_style VARCHAR,
    beats_per_bar INTEGER NOT NULL DEFAULT 3,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_dance_style_config_unique_style
    ON dance_style_config (main_style, COALESCE(sub_style, ''));

CREATE INDEX idx_dance_style_config_main_style ON dance_style_config(main_style);

-- Seed with known Swedish folk dance styles
INSERT INTO dance_style_config (main_style, sub_style, beats_per_bar) VALUES
    ('Polska',        NULL, 3),
    ('Hambo',         NULL, 3),
    ('Vals',          NULL, 3),
    ('Mazurka',       NULL, 3),
    ('Schottis',      NULL, 4),
    ('Polka',         NULL, 2),
    ('Engelska',      NULL, 4),
    ('Snoa',          NULL, 4),
    ('Gånglåt',       NULL, 4);
