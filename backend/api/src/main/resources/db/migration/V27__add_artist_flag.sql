ALTER TABLE public.artists
    ADD COLUMN is_flagged boolean DEFAULT false NOT NULL,
    ADD COLUMN flagged_at timestamp with time zone,
    ADD COLUMN flag_reason character varying;
