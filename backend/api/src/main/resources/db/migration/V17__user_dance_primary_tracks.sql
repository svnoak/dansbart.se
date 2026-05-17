CREATE TABLE user_dance_primary_tracks (
    user_id  UUID NOT NULL,
    dance_id UUID NOT NULL,
    track_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, dance_id),
    CONSTRAINT fk_udpt_user  FOREIGN KEY (user_id)  REFERENCES users(id)   ON DELETE CASCADE,
    CONSTRAINT fk_udpt_dance FOREIGN KEY (dance_id) REFERENCES dances(id)  ON DELETE CASCADE,
    CONSTRAINT fk_udpt_track FOREIGN KEY (track_id) REFERENCES tracks(id)  ON DELETE CASCADE
);
CREATE INDEX idx_udpt_user ON user_dance_primary_tracks(user_id);
