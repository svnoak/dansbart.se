-- Enable UUID extension for robust IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. THE CANONICAL ENTITY
-- This is the "Golden Record". We try to avoid duplicates here.
-- 'isrc' is the critical link between Spotify, Apple, and YouTube.
CREATE TABLE tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    artist_name TEXT NOT NULL, -- Keep simple strings for now (No Artist Table yet)
    album_name TEXT,
    isrc TEXT,                 -- International Standard Recording Code
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups during ingestion
CREATE INDEX idx_tracks_isrc ON tracks(isrc);


-- 2. THE RAW ANALYSIS LAYER (The "Inputs")
-- Stores the opinion of every script/API. 
-- We never delete this; we use it to recalculate if logic changes.
CREATE TABLE analysis_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
    
    -- Source Types: 'spotify_api', 'librosa_audio', 'playlist_miner', 'folkwiki_scrape'
    source_type TEXT NOT NULL, 
    
    -- The raw messy data. 
    -- Ex: { "bpm": 124, "key": 5, "time_signature": 3, "asymmetry": 0.12 }
    raw_data JSONB NOT NULL,
    
    confidence_score FLOAT DEFAULT 1.0, -- 0.0 to 1.0
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 3. THE PLAYBACK LAYER (The "Outputs")
-- Where do we send the user when they click "Play"?
CREATE TABLE playback_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
    
    -- Platform: 'spotify', 'youtube_music', 'apple_music'
    platform TEXT NOT NULL, 
    external_id TEXT NOT NULL, -- The platform's specific ID (e.g. Spotify URI)
    deep_link TEXT NOT NULL,   -- The click-through URL
    
    is_preferred BOOLEAN DEFAULT FALSE -- Useful if we have multiple links
);


-- 4. THE DANCE CLASSIFICATION (The "Filter" Layer)
-- This is the table your Frontend queries.
-- It resolves the "Fast Polka = Slow Snoa" problem.
CREATE TABLE track_dance_styles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
    
    -- The "Parent" Category (Polska, Vals, Schottis, Snoa/Polka, Hambo)
    dance_style TEXT NOT NULL, 
    
    -- Multiplier for the "Feel".
    -- 1.0 = Use detected BPM. 
    -- 0.5 = Half-time feel (e.g. Snoa).
    -- 2.0 = Double-time feel.
    bpm_multiplier FLOAT DEFAULT 1.0,
    
    -- Determine if this is the "Main" style or a "Secondary" interpretation
    is_primary BOOLEAN DEFAULT TRUE,
    
    -- Computed from: (Raw BPM from analysis) * (bpm_multiplier)
    -- We store this so we can index it for fast "Range Queries"
    effective_bpm INTEGER NOT NULL, 
    
    UNIQUE(track_id, dance_style) -- Prevent duplicate tags for same track
);

-- CRITICAL INDEX: This makes your "Schottis + Fast" filter instant.
CREATE INDEX idx_style_bpm ON track_dance_styles(dance_style, effective_bpm);