-- A playlist has exactly one owner: a user or a group.
ALTER TABLE playlists ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE playlists ADD COLUMN group_id UUID REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE playlists ADD CONSTRAINT playlists_owner_check CHECK ((user_id IS NULL) <> (group_id IS NULL));
CREATE INDEX idx_playlists_group_id ON playlists(group_id);
