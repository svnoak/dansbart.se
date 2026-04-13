-- Separate Discourse external_id from internal primary key for users.
-- The current users.id stores the Discourse external_id (a varchar).
-- This migration:
--   1. Generates a stable UUID as the new internal PK for each user
--   2. Moves the Discourse external_id to a dedicated discourse_id column
--   3. Updates all FK columns in playlists, playlist_collaborators, and tracks

-- Step 1: Add new UUID PK column and discourse_id column to users
ALTER TABLE public.users ADD COLUMN new_id UUID DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.users ADD COLUMN discourse_id VARCHAR(255);
UPDATE public.users SET discourse_id = id;
ALTER TABLE public.users ALTER COLUMN discourse_id SET NOT NULL;

-- Step 2: Add new UUID FK columns to referencing tables
ALTER TABLE public.playlists ADD COLUMN new_user_id UUID;
ALTER TABLE public.playlist_collaborators ADD COLUMN new_user_id UUID;
ALTER TABLE public.playlist_collaborators ADD COLUMN new_invited_by UUID;
ALTER TABLE public.tracks ADD COLUMN new_uploader_id UUID;

-- Step 3: Populate new UUID FK values from the users mapping
UPDATE public.playlists p
    SET new_user_id = u.new_id
    FROM public.users u
    WHERE p.user_id = u.id;

UPDATE public.playlist_collaborators pc
    SET new_user_id = u.new_id
    FROM public.users u
    WHERE pc.user_id = u.id;

UPDATE public.playlist_collaborators pc
    SET new_invited_by = u.new_id
    FROM public.users u
    WHERE pc.invited_by = u.id;

UPDATE public.tracks t
    SET new_uploader_id = u.new_id
    FROM public.users u
    WHERE t.uploader_id = u.id;

-- Step 4: Drop old FK constraints and indexes that reference old varchar columns
ALTER TABLE public.playlists DROP CONSTRAINT IF EXISTS playlists_user_id_fkey;
ALTER TABLE public.playlist_collaborators DROP CONSTRAINT IF EXISTS playlist_collaborators_user_id_fkey;
ALTER TABLE public.playlist_collaborators DROP CONSTRAINT IF EXISTS playlist_collaborators_invited_by_fkey;
ALTER TABLE public.tracks DROP CONSTRAINT IF EXISTS tracks_uploader_id_fkey;
ALTER TABLE public.playlist_collaborators DROP CONSTRAINT IF EXISTS unique_playlist_user_collaboration;

-- Step 5: Drop old PK on users
ALTER TABLE public.users DROP CONSTRAINT users_pkey;

-- Step 6: Swap columns in users (drop varchar id, rename new_id -> id)
ALTER TABLE public.users DROP COLUMN id;
ALTER TABLE public.users RENAME COLUMN new_id TO id;

-- Step 7: Swap FK columns in playlists
ALTER TABLE public.playlists DROP COLUMN user_id;
ALTER TABLE public.playlists RENAME COLUMN new_user_id TO user_id;
ALTER TABLE public.playlists ALTER COLUMN user_id SET NOT NULL;

-- Step 8: Swap FK columns in playlist_collaborators
ALTER TABLE public.playlist_collaborators DROP COLUMN user_id;
ALTER TABLE public.playlist_collaborators RENAME COLUMN new_user_id TO user_id;
ALTER TABLE public.playlist_collaborators ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.playlist_collaborators DROP COLUMN invited_by;
ALTER TABLE public.playlist_collaborators RENAME COLUMN new_invited_by TO invited_by;

-- Step 9: Swap uploader_id in tracks
ALTER TABLE public.tracks DROP COLUMN uploader_id;
ALTER TABLE public.tracks RENAME COLUMN new_uploader_id TO uploader_id;

-- Step 10: Add PK and unique constraints
ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE public.users ADD CONSTRAINT users_discourse_id_key UNIQUE (discourse_id);

ALTER TABLE public.playlist_collaborators
    ADD CONSTRAINT unique_playlist_user_collaboration UNIQUE (playlist_id, user_id);

-- Step 11: Recreate FK constraints
ALTER TABLE public.playlists
    ADD CONSTRAINT playlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE public.playlist_collaborators
    ADD CONSTRAINT playlist_collaborators_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.playlist_collaborators
    ADD CONSTRAINT playlist_collaborators_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.tracks
    ADD CONSTRAINT tracks_uploader_id_fkey
    FOREIGN KEY (uploader_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Step 12: Recreate indexes
CREATE INDEX ix_playlists_user_id ON public.playlists USING btree (user_id);
CREATE INDEX idx_playlist_collaborators_user ON public.playlist_collaborators USING btree (user_id);
CREATE INDEX ix_tracks_uploader_id ON public.tracks USING btree (uploader_id);
CREATE INDEX idx_users_discourse_id ON public.users USING btree (discourse_id);
