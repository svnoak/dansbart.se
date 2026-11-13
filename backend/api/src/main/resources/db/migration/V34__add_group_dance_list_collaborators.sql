-- A dance list collaborator is exactly one of a user or a group, as for playlists.
ALTER TABLE dance_list_collaborators ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE dance_list_collaborators ADD COLUMN group_id UUID REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE dance_list_collaborators ADD CONSTRAINT dance_list_collaborators_collaborator_check CHECK ((user_id IS NULL) <> (group_id IS NULL));
ALTER TABLE dance_list_collaborators ADD CONSTRAINT unique_dance_list_group_collaboration UNIQUE (dance_list_id, group_id);
CREATE INDEX idx_dance_list_collaborators_group ON dance_list_collaborators(group_id);
