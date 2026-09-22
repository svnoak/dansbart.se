-- A danslista has exactly one owner: a user or a group.
CREATE TABLE dance_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    share_token VARCHAR,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT dance_lists_owner_check CHECK ((user_id IS NULL) <> (group_id IS NULL))
);

CREATE INDEX idx_dance_lists_user_id ON dance_lists(user_id);
CREATE INDEX idx_dance_lists_group_id ON dance_lists(group_id);
CREATE UNIQUE INDEX idx_dance_lists_share_token ON dance_lists(share_token);

CREATE TABLE dance_list_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dance_list_id UUID NOT NULL REFERENCES dance_lists(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(10) NOT NULL,
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    accepted_at TIMESTAMPTZ,
    CONSTRAINT unique_dance_list_user_collaboration UNIQUE (dance_list_id, user_id)
);

CREATE INDEX idx_dance_list_collaborators_dance_list ON dance_list_collaborators(dance_list_id);
CREATE INDEX idx_dance_list_collaborators_user ON dance_list_collaborators(user_id);
CREATE INDEX idx_dance_list_collaborators_status ON dance_list_collaborators(status);

CREATE TABLE dance_list_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dance_list_id UUID NOT NULL REFERENCES dance_lists(id) ON DELETE CASCADE,
    dance_id UUID REFERENCES dances(id),
    free_text_name VARCHAR,
    suggestion_id UUID REFERENCES community_suggestions(id),
    play_mode VARCHAR(20) NOT NULL DEFAULT 'in_order' CHECK (play_mode IN ('in_order', 'random')),
    position INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT dance_list_entries_content_check CHECK (dance_id IS NOT NULL OR free_text_name IS NOT NULL)
);

CREATE UNIQUE INDEX idx_dance_list_entries_list_dance ON dance_list_entries(dance_list_id, dance_id) WHERE dance_id IS NOT NULL;
CREATE INDEX idx_dance_list_entries_dance_list_id ON dance_list_entries(dance_list_id);

CREATE TABLE dance_list_entry_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL REFERENCES dance_list_entries(id) ON DELETE CASCADE,
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    position INT NOT NULL,
    voter_id UUID NOT NULL,
    vote_cast BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (entry_id, track_id)
);

CREATE INDEX idx_dance_list_entry_tracks_entry_id ON dance_list_entry_tracks(entry_id);
