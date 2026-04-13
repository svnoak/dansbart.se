ALTER TABLE tracks ADD COLUMN is_danceable boolean DEFAULT true NOT NULL;

CREATE INDEX ix_tracks_is_danceable ON public.tracks USING btree (is_danceable);
