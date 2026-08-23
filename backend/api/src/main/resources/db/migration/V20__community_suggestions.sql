-- Unified suggestion queue for user-submitted content (missing tracks/albums) and dance
-- style proposals. One table with a `kind` discriminator rather than two near-identical
-- tables, since both share the same submit -> review -> accept/reject lifecycle and only
-- differ in payload shape (mirrors the existing JSONB-payload pattern already used by
-- track_structure_versions.structure_data).
--
-- Anonymous-first: voter_id is a plain UUID (the same anonymous voter identity used
-- elsewhere, via X-Voter-ID / VoterContext), not a mandatory FK to users(id) — suggesting
-- content or a style doesn't require an account.
--
-- status values: 'pending' (awaiting review) -> 'accepted' | 'rejected'. For kind =
-- 'dance_style' specifically, 'accepted' is a distinct, reversible step from actually
-- writing into dance_style_config (which feeds the audio worker's bar-correction DSP
-- pipeline) — that happens only via a separate 'activated' transition with its own
-- timestamp, so an admin can accept a proposal's name/existence without yet committing a
-- production config change.
CREATE TABLE community_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind VARCHAR NOT NULL CHECK (kind IN ('content', 'dance_style')),
    payload JSONB NOT NULL,
    note VARCHAR,
    voter_id UUID NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'activated', 'rejected')),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    review_note VARCHAR,
    resolved_ref_id UUID,
    activated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_community_suggestions_kind_status ON community_suggestions(kind, status);
CREATE INDEX idx_community_suggestions_voter ON community_suggestions(voter_id);
