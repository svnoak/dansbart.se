CREATE TABLE provider_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(16) NOT NULL CHECK (provider IN ('GDRIVE', 'HIDRIVE')),
    status VARCHAR(16) NOT NULL CHECK (status IN ('ACTIVE', 'NEEDS_RECONNECT')),
    encrypted_refresh_token BYTEA NOT NULL,
    refresh_token_expires_at TIMESTAMPTZ,
    last_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, provider)
);
ALTER TABLE user_track_sources
    ADD CONSTRAINT fk_user_track_sources_connection
    FOREIGN KEY (connection_id) REFERENCES provider_connections(id) ON DELETE SET NULL;
