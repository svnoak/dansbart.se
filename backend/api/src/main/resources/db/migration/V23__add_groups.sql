-- Groups: a collection of users that can jointly own playlists (e.g. a dance troupe or
-- a circle of friends). Modeled after playlist collaboration (playlist_collaborators):
-- one membership row per user with fine-grained permission flags, plus an is_admin flag
-- for full control. An admin can always do everything, including removing another admin;
-- a non-admin member's actual powers are exactly its permission flags below.
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    about_us TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- status mirrors playlist_collaborators: 'pending' until the invitee accepts, then
-- 'accepted'. A pending row grants no permissions and is not a visible member yet.
CREATE TABLE group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    can_edit_info BOOLEAN NOT NULL DEFAULT FALSE,
    can_manage_playlists BOOLEAN NOT NULL DEFAULT FALSE,
    can_invite_members BOOLEAN NOT NULL DEFAULT FALSE,
    can_remove_members BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    CONSTRAINT unique_group_user_membership UNIQUE (group_id, user_id)
);

CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);

-- A playlist is owned by exactly one user OR one group, never both and never neither.
-- Group ownership lets anyone with can_manage_playlists (or any admin) on that group
-- administer the playlist, the same way an 'edit' playlist_collaborator does today.
ALTER TABLE public.playlists ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.playlists ADD COLUMN group_id UUID REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE public.playlists ADD CONSTRAINT playlists_owner_xor_check
    CHECK ((user_id IS NOT NULL) <> (group_id IS NOT NULL));

CREATE INDEX idx_playlists_group_id ON public.playlists(group_id);
