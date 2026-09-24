-- A playlist collaborator is exactly one of a user or a group.
ALTER TABLE playlist_collaborators ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE playlist_collaborators ADD COLUMN group_id UUID REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE playlist_collaborators ADD CONSTRAINT playlist_collaborators_collaborator_check CHECK ((user_id IS NULL) <> (group_id IS NULL));
ALTER TABLE playlist_collaborators ADD CONSTRAINT unique_playlist_group_collaboration UNIQUE (playlist_id, group_id);
CREATE INDEX idx_playlist_collaborators_group ON playlist_collaborators(group_id);

CREATE UNIQUE INDEX idx_groups_name_lower ON groups(lower(name));
