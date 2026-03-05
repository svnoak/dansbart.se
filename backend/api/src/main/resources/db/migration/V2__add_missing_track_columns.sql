DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tracks' AND column_name = 'tempo_bpm'
    ) THEN
        ALTER TABLE public.tracks ADD COLUMN tempo_bpm double precision;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tracks' AND column_name = 'is_instrumental'
    ) THEN
        ALTER TABLE public.tracks ADD COLUMN is_instrumental boolean;
    END IF;
END
$$;
