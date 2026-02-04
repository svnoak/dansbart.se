-- =====================================================
-- BASELINE MIGRATION - Dansbart Database Schema
-- =====================================================
-- This documents the existing schema created by 32+ Alembic migrations.
-- Flyway will NOT execute this file on existing databases due to
-- baseline-on-migrate configuration - it's already applied.
--
-- Source: dansbart.se/backend/alembic/versions/
-- Created: From Python SQLAlchemy models
-- =====================================================

-- Required extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Tracks: Central entity for music tracks
CREATE TABLE IF NOT EXISTS tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR NOT NULL,
    isrc VARCHAR,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Audio features
    has_vocals BOOLEAN,
    swing_ratio FLOAT,
    articulation FLOAT,
    bounciness FLOAT,
    loudness FLOAT,
    punchiness FLOAT,
    voice_probability FLOAT,
    polska_score FLOAT,
    hambo_score FLOAT,
    bpm_stability FLOAT,

    -- Vector embedding for similarity search
    embedding vector,
    analysis_version VARCHAR,

    -- Genre classification
    music_genre VARCHAR,
    genre_confidence FLOAT,

    -- User flagging
    is_flagged BOOLEAN DEFAULT FALSE,
    flagged_at TIMESTAMP WITH TIME ZONE,
    flag_reason VARCHAR,

    -- User uploads
    uploader_id VARCHAR(255),

    -- Processing status
    processing_status VARCHAR DEFAULT 'PENDING',

    -- Structure data (JSONB)
    bars JSONB,
    sections JSONB,
    section_labels JSONB
);

CREATE INDEX IF NOT EXISTS ix_tracks_title ON tracks(title);
CREATE INDEX IF NOT EXISTS ix_tracks_isrc ON tracks(isrc);
CREATE INDEX IF NOT EXISTS ix_tracks_analysis_version ON tracks(analysis_version);
CREATE INDEX IF NOT EXISTS ix_tracks_music_genre ON tracks(music_genre);
CREATE INDEX IF NOT EXISTS ix_tracks_processing_status ON tracks(processing_status);
CREATE INDEX IF NOT EXISTS ix_tracks_is_flagged ON tracks(is_flagged);

-- Artists
CREATE TABLE IF NOT EXISTS artists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    image_url VARCHAR,
    spotify_id VARCHAR UNIQUE,
    is_verified BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS ix_artists_name ON artists(name);

-- Albums
CREATE TABLE IF NOT EXISTS albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR NOT NULL,
    cover_image_url VARCHAR,
    release_date VARCHAR,
    spotify_id VARCHAR UNIQUE,
    artist_id UUID REFERENCES artists(id)
);

CREATE INDEX IF NOT EXISTS ix_albums_title ON albums(title);
CREATE INDEX IF NOT EXISTS ix_albums_spotify_id ON albums(spotify_id);

-- Track-Artist junction (many-to-many)
CREATE TABLE IF NOT EXISTS track_artists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    role VARCHAR DEFAULT 'primary',
    CONSTRAINT unique_track_artist UNIQUE (track_id, artist_id)
);

-- Track-Album junction (many-to-many)
CREATE TABLE IF NOT EXISTS track_albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    CONSTRAINT unique_track_album UNIQUE (track_id, album_id)
);

-- =====================================================
-- DANCE STYLE TABLES
-- =====================================================

-- Track dance style classifications
CREATE TABLE IF NOT EXISTS track_dance_styles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    dance_style VARCHAR NOT NULL,
    sub_style VARCHAR,
    is_primary BOOLEAN DEFAULT FALSE,
    confidence FLOAT DEFAULT 0.0,
    tempo_category VARCHAR,
    bpm_multiplier FLOAT DEFAULT 1.0,
    effective_bpm INTEGER,
    confirmation_count INTEGER DEFAULT 0,
    is_user_confirmed BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS ix_track_dance_styles_dance_style ON track_dance_styles(dance_style);
CREATE INDEX IF NOT EXISTS ix_track_dance_styles_sub_style ON track_dance_styles(sub_style);

-- Style keywords for classification
CREATE TABLE IF NOT EXISTS style_keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword VARCHAR NOT NULL UNIQUE,
    main_style VARCHAR NOT NULL,
    sub_style VARCHAR,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_style_keywords_keyword ON style_keywords(keyword);
CREATE INDEX IF NOT EXISTS ix_style_keywords_main_style ON style_keywords(main_style);

-- Dance movement feedback (global consensus)
CREATE TABLE IF NOT EXISTS dance_movement_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dance_style VARCHAR NOT NULL,
    movement_tag VARCHAR NOT NULL,
    score FLOAT DEFAULT 0.0,
    occurrences INTEGER DEFAULT 0,
    CONSTRAINT _dance_move_uc UNIQUE (dance_style, movement_tag)
);

-- Genre profiles for classification
CREATE TABLE IF NOT EXISTS genre_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    genre_name VARCHAR NOT NULL UNIQUE,
    avg_note_density FLOAT,
    common_meters JSONB,
    rhythm_patterns JSONB,
    sample_size INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ANALYSIS & PLAYBACK TABLES
-- =====================================================

-- Analysis sources
CREATE TABLE IF NOT EXISTS analysis_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    source_type VARCHAR NOT NULL,
    raw_data JSONB,
    confidence_score FLOAT DEFAULT 1.0,
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Playback links (Spotify, YouTube, etc.)
CREATE TABLE IF NOT EXISTS playback_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    platform VARCHAR NOT NULL,
    deep_link VARCHAR NOT NULL,
    is_working BOOLEAN DEFAULT TRUE
);

-- Track structure versions (crowdsourced)
CREATE TABLE IF NOT EXISTS track_structure_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    description VARCHAR,
    structure_data JSONB,
    vote_count INTEGER DEFAULT 1,
    report_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT FALSE,
    is_hidden BOOLEAN DEFAULT FALSE,
    author_alias VARCHAR
);

-- =====================================================
-- VOTING & FEEDBACK TABLES
-- =====================================================

-- Track style votes
CREATE TABLE IF NOT EXISTS track_style_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    voter_id VARCHAR,
    suggested_style VARCHAR,
    tempo_correction VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_track_style_votes_voter_id ON track_style_votes(voter_id);

-- Track feel votes
CREATE TABLE IF NOT EXISTS track_feel_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    feel_tag VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_track_feel_votes_feel_tag ON track_feel_votes(feel_tag);

-- =====================================================
-- USER & PLAYLIST TABLES
-- =====================================================

-- Users (linked to Authentik OIDC)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,  -- Authentik 'sub' claim (hex string)
    username VARCHAR(50),
    display_name VARCHAR,
    avatar_url VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS ix_users_username ON users(username);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));

-- Playlists
CREATE TABLE IF NOT EXISTS playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    name VARCHAR NOT NULL,
    description VARCHAR,
    is_public BOOLEAN DEFAULT FALSE,
    share_token VARCHAR UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_playlists_user_id ON playlists(user_id);
CREATE INDEX IF NOT EXISTS ix_playlists_share_token ON playlists(share_token);

-- Playlist tracks (junction)
CREATE TABLE IF NOT EXISTS playlist_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_playlist_track UNIQUE (playlist_id, track_id)
);

CREATE INDEX IF NOT EXISTS ix_playlist_tracks_playlist_id ON playlist_tracks(playlist_id);
CREATE INDEX IF NOT EXISTS ix_playlist_tracks_track_id ON playlist_tracks(track_id);

-- Playlist collaborators
CREATE TABLE IF NOT EXISTS playlist_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR DEFAULT 'view',
    status VARCHAR DEFAULT 'pending',
    invited_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT unique_playlist_user_collaboration UNIQUE (playlist_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_playlist_collaborators_playlist_id ON playlist_collaborators(playlist_id);
CREATE INDEX IF NOT EXISTS ix_playlist_collaborators_user_id ON playlist_collaborators(user_id);
CREATE INDEX IF NOT EXISTS ix_playlist_collaborators_status ON playlist_collaborators(status);

-- =====================================================
-- ADMIN & CURATION TABLES
-- =====================================================

-- Artist crawl logs
CREATE TABLE IF NOT EXISTS artist_crawl_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spotify_artist_id VARCHAR NOT NULL UNIQUE,
    artist_name VARCHAR NOT NULL,
    crawled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tracks_found INTEGER DEFAULT 0,
    status VARCHAR DEFAULT 'success',
    detected_genres JSONB,
    music_genre_classification VARCHAR,
    discovery_source VARCHAR
);

CREATE INDEX IF NOT EXISTS ix_artist_crawl_logs_spotify_artist_id ON artist_crawl_logs(spotify_artist_id);

-- Rejection logs (blocklist)
CREATE TABLE IF NOT EXISTS rejection_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR NOT NULL,
    spotify_id VARCHAR NOT NULL,
    entity_name VARCHAR NOT NULL,
    reason VARCHAR,
    rejected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_content BOOLEAN DEFAULT TRUE,
    additional_data JSONB,
    CONSTRAINT unique_rejection UNIQUE (spotify_id, entity_type)
);

CREATE INDEX IF NOT EXISTS ix_rejection_logs_entity_type ON rejection_logs(entity_type);
CREATE INDEX IF NOT EXISTS ix_rejection_logs_spotify_id ON rejection_logs(spotify_id);

-- Pending artist approvals
CREATE TABLE IF NOT EXISTS pending_artist_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spotify_id VARCHAR NOT NULL UNIQUE,
    name VARCHAR NOT NULL,
    image_url VARCHAR,
    discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    discovery_source VARCHAR NOT NULL,
    detected_genres JSONB,
    music_genre_classification VARCHAR,
    genre_confidence FLOAT,
    status VARCHAR DEFAULT 'pending',
    reviewed_at TIMESTAMP WITH TIME ZONE,
    additional_data JSONB
);

CREATE INDEX IF NOT EXISTS ix_pending_artist_approvals_spotify_id ON pending_artist_approvals(spotify_id);
CREATE INDEX IF NOT EXISTS ix_pending_artist_approvals_status ON pending_artist_approvals(status);

-- =====================================================
-- ANALYTICS TABLES
-- =====================================================

-- Track playbacks
CREATE TABLE IF NOT EXISTS track_playbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID REFERENCES tracks(id),
    platform VARCHAR,
    played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    duration_seconds INTEGER,
    completed BOOLEAN DEFAULT FALSE,
    session_id VARCHAR
);

CREATE INDEX IF NOT EXISTS ix_track_playbacks_track_id ON track_playbacks(track_id);
CREATE INDEX IF NOT EXISTS ix_track_playbacks_played_at ON track_playbacks(played_at);
CREATE INDEX IF NOT EXISTS ix_track_playbacks_session_id ON track_playbacks(session_id);

-- User interactions
CREATE TABLE IF NOT EXISTS user_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID REFERENCES tracks(id),
    event_type VARCHAR NOT NULL,
    event_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_id VARCHAR
);

CREATE INDEX IF NOT EXISTS ix_user_interactions_track_id ON user_interactions(track_id);
CREATE INDEX IF NOT EXISTS ix_user_interactions_event_type ON user_interactions(event_type);
CREATE INDEX IF NOT EXISTS ix_user_interactions_created_at ON user_interactions(created_at);
CREATE INDEX IF NOT EXISTS ix_user_interactions_session_id ON user_interactions(session_id);

-- Visitor sessions
CREATE TABLE IF NOT EXISTS visitor_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR NOT NULL UNIQUE,
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_agent VARCHAR,
    is_returning BOOLEAN DEFAULT FALSE,
    page_views INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS ix_visitor_sessions_session_id ON visitor_sessions(session_id);
CREATE INDEX IF NOT EXISTS ix_visitor_sessions_first_seen ON visitor_sessions(first_seen);
CREATE INDEX IF NOT EXISTS ix_visitor_sessions_last_seen ON visitor_sessions(last_seen);

-- =====================================================
-- FOREIGN KEY for track uploader
-- =====================================================
ALTER TABLE tracks
    ADD CONSTRAINT fk_tracks_uploader
    FOREIGN KEY (uploader_id)
    REFERENCES users(id)
    ON DELETE SET NULL;
