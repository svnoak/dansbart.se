-- A guest code lets anyone who has it add to one playlist or one dance list,
-- without an account and without any other right to change the list.
-- The code is short enough to type from a screen at a dance evening, and it is
-- what the QR code of the list points to. One table holds the codes of both
-- kinds of list, so a code is unique across them.
CREATE TABLE list_guest_codes (
    code VARCHAR(12) PRIMARY KEY,
    playlist_id UUID UNIQUE REFERENCES playlists(id) ON DELETE CASCADE,
    dance_list_id UUID UNIQUE REFERENCES dance_lists(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT list_guest_codes_target_check CHECK ((playlist_id IS NULL) <> (dance_list_id IS NULL))
);

-- What a guest added, so the people who manage the list can tell it apart.
ALTER TABLE playlist_tracks ADD COLUMN added_by_guest BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE dance_list_entries ADD COLUMN added_by_guest BOOLEAN NOT NULL DEFAULT FALSE;
