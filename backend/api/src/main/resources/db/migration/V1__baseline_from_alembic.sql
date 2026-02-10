-- PostgreSQL schema baseline generated from current dansbart database.
-- This file is intended to reflect the exact structure of the existing
-- database (tables, columns, types, constraints, and indexes), so that
-- Flyway-managed environments match the imported production data.

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Extensions
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;
COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';

SET default_tablespace = '';
SET default_table_access_method = heap;

--
-- Tables
--

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND c.relname = 'albums'
  ) THEN
    CREATE TABLE public.albums (
        id uuid NOT NULL,
        title character varying NOT NULL,
        cover_image_url character varying,
        release_date character varying,
        artist_id uuid,
        spotify_id character varying
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND c.relname = 'alembic_version'
  ) THEN
    CREATE TABLE public.alembic_version (
        version_num character varying(32) NOT NULL
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND c.relname = 'analysis_sources'
  ) THEN
    CREATE TABLE public.analysis_sources (
        id uuid NOT NULL,
        track_id uuid NOT NULL,
        source_type character varying NOT NULL,
        raw_data jsonb NOT NULL,
        confidence_score double precision NOT NULL,
        analyzed_at timestamp with time zone DEFAULT now() NOT NULL
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND c.relname = 'artist_crawl_logs'
  ) THEN
    CREATE TABLE public.artist_crawl_logs (
        id uuid NOT NULL,
        spotify_artist_id character varying NOT NULL,
        artist_name character varying NOT NULL,
        crawled_at timestamp with time zone DEFAULT now() NOT NULL,
        tracks_found integer NOT NULL,
        status character varying NOT NULL,
        detected_genres jsonb,
        music_genre_classification character varying,
        discovery_source character varying
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND c.relname = 'artists'
  ) THEN
    CREATE TABLE public.artists (
        id uuid NOT NULL,
        name character varying NOT NULL,
        spotify_id character varying,
        image_url character varying,
        is_verified boolean DEFAULT false NOT NULL
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND c.relname = 'dance_movement_feedback'
  ) THEN
    CREATE TABLE public.dance_movement_feedback (
        id uuid NOT NULL,
        dance_style character varying NOT NULL,
        movement_tag character varying NOT NULL,
        score double precision NOT NULL,
        occurrences integer NOT NULL
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND c.relname = 'genre_profiles'
  ) THEN
    CREATE TABLE public.genre_profiles (
        id uuid NOT NULL,
        genre_name character varying NOT NULL,
        avg_note_density double precision NOT NULL,
        common_meters jsonb NOT NULL,
        rhythm_patterns jsonb NOT NULL,
        sample_size integer NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND c.relname = 'pending_artist_approvals'
  ) THEN
    CREATE TABLE public.pending_artist_approvals (
        id uuid NOT NULL,
        spotify_id character varying NOT NULL,
        name character varying NOT NULL,
        image_url character varying,
        discovered_at timestamp with time zone DEFAULT now() NOT NULL,
        discovery_source character varying NOT NULL,
        detected_genres jsonb,
        music_genre_classification character varying,
        genre_confidence double precision,
        status character varying NOT NULL,
        reviewed_at timestamp with time zone,
        additional_data jsonb
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND c.relname = 'playback_links'
  ) THEN
    CREATE TABLE public.playback_links (
        id uuid NOT NULL,
        track_id uuid NOT NULL,
        platform character varying NOT NULL,
        deep_link character varying NOT NULL,
        is_working boolean NOT NULL
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND c.relname = 'playlist_collaborators'
  ) THEN
    CREATE TABLE public.playlist_collaborators (
        id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
        playlist_id uuid NOT NULL,
        user_id character varying(255) NOT NULL,
        permission character varying(10) NOT NULL,
        invited_by character varying(255),
        invited_at timestamp with time zone DEFAULT now() NOT NULL,
        status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
        accepted_at timestamp with time zone
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND c.relname = 'playlist_tracks'
  ) THEN
    CREATE TABLE public.playlist_tracks (
        id uuid NOT NULL,
        playlist_id uuid NOT NULL,
        track_id uuid NOT NULL,
        "position" integer NOT NULL,
        added_at timestamp without time zone DEFAULT now() NOT NULL
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND c.relname = 'playlists'
  ) THEN
    CREATE TABLE public.playlists (
        id uuid NOT NULL,
        user_id character varying(255) NOT NULL,
        name character varying NOT NULL,
        description text,
        is_public boolean DEFAULT false NOT NULL,
        share_token character varying,
        created_at timestamp without time zone DEFAULT now() NOT NULL,
        updated_at timestamp without time zone DEFAULT now() NOT NULL
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND c.relname = 'rejection_logs'
  ) THEN
    CREATE TABLE public.rejection_logs (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        entity_type character varying NOT NULL,
        spotify_id character varying NOT NULL,
        entity_name character varying NOT NULL,
        reason character varying,
        rejected_at timestamp with time zone DEFAULT now() NOT NULL,
        additional_data jsonb,
        deleted_content boolean DEFAULT true NOT NULL
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND c.relname = 'style_keywords'
  ) THEN
    CREATE TABLE public.style_keywords (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        keyword character varying NOT NULL,
        main_style character varying NOT NULL,
        sub_style character varying,
        is_active boolean DEFAULT true NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND c.relname = 'track_albums'
  ) THEN
    CREATE TABLE public.track_albums (
        id uuid NOT NULL,
        track_id uuid NOT NULL,
        album_id uuid NOT NULL
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND c.relname = 'track_artists'
  ) THEN
    CREATE TABLE public.track_artists (
        id uuid NOT NULL,
        track_id uuid NOT NULL,
        artist_id uuid NOT NULL,
        role character varying NOT NULL
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND c.relname = 'track_dance_styles'
  ) THEN
    CREATE TABLE public.track_dance_styles (
        id uuid NOT NULL,
        track_id uuid NOT NULL,
        dance_style character varying NOT NULL,
        is_primary boolean NOT NULL,
        confidence double precision NOT NULL,
        tempo_category character varying,
        bpm_multiplier double precision NOT NULL,
        effective_bpm integer NOT NULL,
        confirmation_count integer NOT NULL,
        is_user_confirmed boolean NOT NULL,
        sub_style character varying
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND c.relname = 'track_feel_votes'
  ) THEN
    CREATE TABLE public.track_feel_votes (
        id uuid NOT NULL,
        track_id uuid NOT NULL,
        feel_tag character varying NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND c.relname = 'track_playbacks'
  ) THEN
    CREATE TABLE public.track_playbacks (
        id uuid NOT NULL,
        track_id uuid NOT NULL,
        platform character varying NOT NULL,
        played_at timestamp with time zone DEFAULT now() NOT NULL,
        session_id character varying,
        duration_seconds integer,
        completed boolean DEFAULT false NOT NULL
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND c.relname = 'track_structure_versions'
  ) THEN
    CREATE TABLE public.track_structure_versions (
        id uuid NOT NULL,
        track_id uuid NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        description character varying,
        structure_data jsonb NOT NULL,
        vote_count integer NOT NULL,
        report_count integer NOT NULL,
        is_active boolean NOT NULL,
        is_hidden boolean NOT NULL,
        author_alias character varying
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND c.relname = 'track_style_votes'
  ) THEN
    CREATE TABLE public.track_style_votes (
        id uuid NOT NULL,
        track_id uuid NOT NULL,
        suggested_style character varying,
        tempo_correction character varying,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        voter_id character varying NOT NULL
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND c.relname = 'tracks'
  ) THEN
    CREATE TABLE public.tracks (
        id uuid NOT NULL,
        title character varying NOT NULL,
        isrc character varying,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        has_vocals boolean,
        duration_ms integer,
        bars jsonb,
        sections jsonb,
        section_labels jsonb,
        processing_status character varying DEFAULT 'PENDING'::character varying NOT NULL,
        swing_ratio double precision,
        articulation double precision,
        bounciness double precision,
        music_genre character varying,
        genre_confidence double precision,
        is_flagged boolean DEFAULT false NOT NULL,
        flagged_at timestamp with time zone,
        flag_reason character varying,
        embedding public.vector,
        analysis_version character varying,
        loudness double precision,
        punchiness double precision,
        voice_probability double precision,
        polska_score double precision,
        hambo_score double precision,
        bpm_stability double precision,
        uploader_id character varying(255)
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND c.relname = 'user_interactions'
  ) THEN
    CREATE TABLE public.user_interactions (
        id uuid NOT NULL,
        track_id uuid,
        event_type character varying NOT NULL,
        event_data jsonb,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        session_id character varying
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND c.relname = 'users'
  ) THEN
    CREATE TABLE public.users (
        id character varying(255) NOT NULL,
        display_name character varying,
        avatar_url character varying,
        created_at timestamp without time zone DEFAULT now() NOT NULL,
        updated_at timestamp without time zone DEFAULT now() NOT NULL,
        last_login_at timestamp with time zone,
        username character varying(50) NOT NULL
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND c.relname = 'visitor_sessions'
  ) THEN
    CREATE TABLE public.visitor_sessions (
        id uuid NOT NULL,
        session_id character varying NOT NULL,
        first_seen timestamp with time zone DEFAULT now() NOT NULL,
        last_seen timestamp with time zone DEFAULT now() NOT NULL,
        user_agent character varying,
        is_returning boolean DEFAULT false NOT NULL,
        page_views integer DEFAULT 1 NOT NULL
    );
  END IF;
END
$$;

--
-- Constraints
--

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = '_dance_move_uc'
  ) THEN
    ALTER TABLE ONLY public.dance_movement_feedback
        ADD CONSTRAINT _dance_move_uc UNIQUE (dance_style, movement_tag);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'albums_pkey'
  ) THEN
    ALTER TABLE ONLY public.albums
        ADD CONSTRAINT albums_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'alembic_version_pkc'
  ) THEN
    ALTER TABLE ONLY public.alembic_version
        ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'analysis_sources_pkey'
  ) THEN
    ALTER TABLE ONLY public.analysis_sources
        ADD CONSTRAINT analysis_sources_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'artist_crawl_logs_pkey'
  ) THEN
    ALTER TABLE ONLY public.artist_crawl_logs
        ADD CONSTRAINT artist_crawl_logs_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'artists_pkey'
  ) THEN
    ALTER TABLE ONLY public.artists
        ADD CONSTRAINT artists_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'artists_spotify_id_key'
  ) THEN
    ALTER TABLE ONLY public.artists
        ADD CONSTRAINT artists_spotify_id_key UNIQUE (spotify_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'dance_movement_feedback_pkey'
  ) THEN
    ALTER TABLE ONLY public.dance_movement_feedback
        ADD CONSTRAINT dance_movement_feedback_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'genre_profiles_pkey'
  ) THEN
    ALTER TABLE ONLY public.genre_profiles
        ADD CONSTRAINT genre_profiles_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'pending_artist_approvals_pkey'
  ) THEN
    ALTER TABLE ONLY public.pending_artist_approvals
        ADD CONSTRAINT pending_artist_approvals_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'playback_links_pkey'
  ) THEN
    ALTER TABLE ONLY public.playback_links
        ADD CONSTRAINT playback_links_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'playlist_collaborators_pkey'
  ) THEN
    ALTER TABLE ONLY public.playlist_collaborators
        ADD CONSTRAINT playlist_collaborators_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'playlist_tracks_pkey'
  ) THEN
    ALTER TABLE ONLY public.playlist_tracks
        ADD CONSTRAINT playlist_tracks_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'playlists_pkey'
  ) THEN
    ALTER TABLE ONLY public.playlists
        ADD CONSTRAINT playlists_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'rejection_logs_pkey'
  ) THEN
    ALTER TABLE ONLY public.rejection_logs
        ADD CONSTRAINT rejection_logs_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'style_keywords_pkey'
  ) THEN
    ALTER TABLE ONLY public.style_keywords
        ADD CONSTRAINT style_keywords_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'track_albums_pkey'
  ) THEN
    ALTER TABLE ONLY public.track_albums
        ADD CONSTRAINT track_albums_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'track_artists_pkey'
  ) THEN
    ALTER TABLE ONLY public.track_artists
        ADD CONSTRAINT track_artists_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'track_dance_styles_pkey'
  ) THEN
    ALTER TABLE ONLY public.track_dance_styles
        ADD CONSTRAINT track_dance_styles_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'track_feel_votes_pkey'
  ) THEN
    ALTER TABLE ONLY public.track_feel_votes
        ADD CONSTRAINT track_feel_votes_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'track_playbacks_pkey'
  ) THEN
    ALTER TABLE ONLY public.track_playbacks
        ADD CONSTRAINT track_playbacks_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'track_structure_versions_pkey'
  ) THEN
    ALTER TABLE ONLY public.track_structure_versions
        ADD CONSTRAINT track_structure_versions_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'track_style_votes_pkey'
  ) THEN
    ALTER TABLE ONLY public.track_style_votes
        ADD CONSTRAINT track_style_votes_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'tracks_pkey'
  ) THEN
    ALTER TABLE ONLY public.tracks
        ADD CONSTRAINT tracks_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'unique_keyword'
  ) THEN
    ALTER TABLE ONLY public.style_keywords
        ADD CONSTRAINT unique_keyword UNIQUE (keyword);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'unique_pending_artist'
  ) THEN
    ALTER TABLE ONLY public.pending_artist_approvals
        ADD CONSTRAINT unique_pending_artist UNIQUE (spotify_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'unique_playlist_user_collaboration'
  ) THEN
    ALTER TABLE ONLY public.playlist_collaborators
        ADD CONSTRAINT unique_playlist_user_collaboration UNIQUE (playlist_id, user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'unique_rejection'
  ) THEN
    ALTER TABLE ONLY public.rejection_logs
        ADD CONSTRAINT unique_rejection UNIQUE (spotify_id, entity_type);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'unique_spotify_artist_crawl'
  ) THEN
    ALTER TABLE ONLY public.artist_crawl_logs
        ADD CONSTRAINT unique_spotify_artist_crawl UNIQUE (spotify_artist_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'unique_track_album'
  ) THEN
    ALTER TABLE ONLY public.track_albums
        ADD CONSTRAINT unique_track_album UNIQUE (track_id, album_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'unique_track_artist'
  ) THEN
    ALTER TABLE ONLY public.track_artists
        ADD CONSTRAINT unique_track_artist UNIQUE (track_id, artist_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'uq_playlist_track'
  ) THEN
    ALTER TABLE ONLY public.playlist_tracks
        ADD CONSTRAINT uq_playlist_track UNIQUE (playlist_id, track_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'user_interactions_pkey'
  ) THEN
    ALTER TABLE ONLY public.user_interactions
        ADD CONSTRAINT user_interactions_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'users_pkey'
  ) THEN
    ALTER TABLE ONLY public.users
        ADD CONSTRAINT users_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'visitor_sessions_pkey'
  ) THEN
    ALTER TABLE ONLY public.visitor_sessions
        ADD CONSTRAINT visitor_sessions_pkey PRIMARY KEY (id);
  END IF;
END
$$;

--
-- Indexes
--

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_playlist_collaborators_playlist'
  ) THEN
    CREATE INDEX idx_playlist_collaborators_playlist ON public.playlist_collaborators USING btree (playlist_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_playlist_collaborators_status'
  ) THEN
    CREATE INDEX idx_playlist_collaborators_status ON public.playlist_collaborators USING btree (status);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_playlist_collaborators_user'
  ) THEN
    CREATE INDEX idx_playlist_collaborators_user ON public.playlist_collaborators USING btree (user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_tracks_isrc_non_unique'
  ) THEN
    CREATE INDEX idx_tracks_isrc_non_unique ON public.tracks USING btree (isrc);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_tracks_processing_status'
  ) THEN
    CREATE INDEX idx_tracks_processing_status ON public.tracks USING btree (processing_status);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_users_username_lower'
  ) THEN
    CREATE UNIQUE INDEX idx_users_username_lower ON public.users USING btree (lower((username)::text));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_albums_spotify_id'
  ) THEN
    CREATE UNIQUE INDEX ix_albums_spotify_id ON public.albums USING btree (spotify_id) WHERE (spotify_id IS NOT NULL);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_albums_title'
  ) THEN
    CREATE INDEX ix_albums_title ON public.albums USING btree (title);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_albums_title_trgm'
  ) THEN
    CREATE INDEX ix_albums_title_trgm ON public.albums USING gin (title public.gin_trgm_ops);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_artist_crawl_logs_spotify_artist_id'
  ) THEN
    CREATE INDEX ix_artist_crawl_logs_spotify_artist_id ON public.artist_crawl_logs USING btree (spotify_artist_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_artists_name'
  ) THEN
    CREATE INDEX ix_artists_name ON public.artists USING btree (name);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_artists_name_trgm'
  ) THEN
    CREATE INDEX ix_artists_name_trgm ON public.artists USING gin (name public.gin_trgm_ops);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_dance_movement_feedback_dance_style'
  ) THEN
    CREATE INDEX ix_dance_movement_feedback_dance_style ON public.dance_movement_feedback USING btree (dance_style);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_dance_movement_feedback_movement_tag'
  ) THEN
    CREATE INDEX ix_dance_movement_feedback_movement_tag ON public.dance_movement_feedback USING btree (movement_tag);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_genre_profiles_genre_name'
  ) THEN
    CREATE UNIQUE INDEX ix_genre_profiles_genre_name ON public.genre_profiles USING btree (genre_name);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_pending_artist_approvals_spotify_id'
  ) THEN
    CREATE INDEX ix_pending_artist_approvals_spotify_id ON public.pending_artist_approvals USING btree (spotify_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_pending_artist_approvals_status'
  ) THEN
    CREATE INDEX ix_pending_artist_approvals_status ON public.pending_artist_approvals USING btree (status);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_playback_links_track_platform_working'
  ) THEN
    CREATE INDEX ix_playback_links_track_platform_working ON public.playback_links USING btree (track_id, platform, is_working) WHERE (((platform)::text = 'youtube'::text) AND (is_working = true));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_playlist_tracks_playlist_id'
  ) THEN
    CREATE INDEX ix_playlist_tracks_playlist_id ON public.playlist_tracks USING btree (playlist_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_playlist_tracks_track_id'
  ) THEN
    CREATE INDEX ix_playlist_tracks_track_id ON public.playlist_tracks USING btree (track_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_playlists_share_token'
  ) THEN
    CREATE UNIQUE INDEX ix_playlists_share_token ON public.playlists USING btree (share_token);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_playlists_user_id'
  ) THEN
    CREATE INDEX ix_playlists_user_id ON public.playlists USING btree (user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_rejection_logs_entity_type'
  ) THEN
    CREATE INDEX ix_rejection_logs_entity_type ON public.rejection_logs USING btree (entity_type);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_rejection_logs_spotify_id'
  ) THEN
    CREATE INDEX ix_rejection_logs_spotify_id ON public.rejection_logs USING btree (spotify_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_style_keywords_keyword'
  ) THEN
    CREATE INDEX ix_style_keywords_keyword ON public.style_keywords USING btree (keyword);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_style_keywords_main_style'
  ) THEN
    CREATE INDEX ix_style_keywords_main_style ON public.style_keywords USING btree (main_style);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_track_dance_styles_confidence'
  ) THEN
    CREATE INDEX ix_track_dance_styles_confidence ON public.track_dance_styles USING btree (track_id, confidence) WHERE (confidence >= (0.98)::double precision);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_track_dance_styles_dance_style'
  ) THEN
    CREATE INDEX ix_track_dance_styles_dance_style ON public.track_dance_styles USING btree (dance_style);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_track_dance_styles_sub_style'
  ) THEN
    CREATE INDEX ix_track_dance_styles_sub_style ON public.track_dance_styles USING btree (sub_style);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_track_feel_votes_feel_tag'
  ) THEN
    CREATE INDEX ix_track_feel_votes_feel_tag ON public.track_feel_votes USING btree (feel_tag);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_track_playbacks_played_at'
  ) THEN
    CREATE INDEX ix_track_playbacks_played_at ON public.track_playbacks USING btree (played_at);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_track_playbacks_session_id'
  ) THEN
    CREATE INDEX ix_track_playbacks_session_id ON public.track_playbacks USING btree (session_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_track_playbacks_track_id'
  ) THEN
    CREATE INDEX ix_track_playbacks_track_id ON public.track_playbacks USING btree (track_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_track_style_votes_voter_id'
  ) THEN
    CREATE INDEX ix_track_style_votes_voter_id ON public.track_style_votes USING btree (voter_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_tracks_analysis_version'
  ) THEN
    CREATE INDEX ix_tracks_analysis_version ON public.tracks USING btree (analysis_version);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_tracks_is_flagged'
  ) THEN
    CREATE INDEX ix_tracks_is_flagged ON public.tracks USING btree (is_flagged);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_tracks_music_genre'
  ) THEN
    CREATE INDEX ix_tracks_music_genre ON public.tracks USING btree (music_genre);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_tracks_title'
  ) THEN
    CREATE INDEX ix_tracks_title ON public.tracks USING btree (title);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_tracks_title_trgm'
  ) THEN
    CREATE INDEX ix_tracks_title_trgm ON public.tracks USING gin (title public.gin_trgm_ops);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_tracks_uploader_id'
  ) THEN
    CREATE INDEX ix_tracks_uploader_id ON public.tracks USING btree (uploader_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_user_interactions_created_at'
  ) THEN
    CREATE INDEX ix_user_interactions_created_at ON public.user_interactions USING btree (created_at);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_user_interactions_event_type'
  ) THEN
    CREATE INDEX ix_user_interactions_event_type ON public.user_interactions USING btree (event_type);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_user_interactions_session_id'
  ) THEN
    CREATE INDEX ix_user_interactions_session_id ON public.user_interactions USING btree (session_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_user_interactions_track_id'
  ) THEN
    CREATE INDEX ix_user_interactions_track_id ON public.user_interactions USING btree (track_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_visitor_sessions_first_seen'
  ) THEN
    CREATE INDEX ix_visitor_sessions_first_seen ON public.visitor_sessions USING btree (first_seen);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_visitor_sessions_last_seen'
  ) THEN
    CREATE INDEX ix_visitor_sessions_last_seen ON public.visitor_sessions USING btree (last_seen);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ix_visitor_sessions_session_id'
  ) THEN
    CREATE UNIQUE INDEX ix_visitor_sessions_session_id ON public.visitor_sessions USING btree (session_id);
  END IF;
END
$$;

--
-- Foreign keys
--

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'albums_artist_id_fkey'
  ) THEN
    ALTER TABLE ONLY public.albums
        ADD CONSTRAINT albums_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES public.artists(id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'analysis_sources_track_id_fkey'
  ) THEN
    ALTER TABLE ONLY public.analysis_sources
        ADD CONSTRAINT analysis_sources_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'playback_links_track_id_fkey'
  ) THEN
    ALTER TABLE ONLY public.playback_links
        ADD CONSTRAINT playback_links_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'playlist_collaborators_invited_by_fkey'
  ) THEN
    ALTER TABLE ONLY public.playlist_collaborators
        ADD CONSTRAINT playlist_collaborators_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'playlist_collaborators_playlist_id_fkey'
  ) THEN
    ALTER TABLE ONLY public.playlist_collaborators
        ADD CONSTRAINT playlist_collaborators_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.playlists(id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'playlist_collaborators_user_id_fkey'
  ) THEN
    ALTER TABLE ONLY public.playlist_collaborators
        ADD CONSTRAINT playlist_collaborators_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'playlist_tracks_playlist_id_fkey'
  ) THEN
    ALTER TABLE ONLY public.playlist_tracks
        ADD CONSTRAINT playlist_tracks_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.playlists(id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'playlist_tracks_track_id_fkey'
  ) THEN
    ALTER TABLE ONLY public.playlist_tracks
        ADD CONSTRAINT playlist_tracks_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'playlists_user_id_fkey'
  ) THEN
    ALTER TABLE ONLY public.playlists
        ADD CONSTRAINT playlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'track_albums_album_id_fkey'
  ) THEN
    ALTER TABLE ONLY public.track_albums
        ADD CONSTRAINT track_albums_album_id_fkey FOREIGN KEY (album_id) REFERENCES public.albums(id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'track_albums_track_id_fkey'
  ) THEN
    ALTER TABLE ONLY public.track_albums
        ADD CONSTRAINT track_albums_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'track_artists_artist_id_fkey'
  ) THEN
    ALTER TABLE ONLY public.track_artists
        ADD CONSTRAINT track_artists_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES public.artists(id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'track_artists_track_id_fkey'
  ) THEN
    ALTER TABLE ONLY public.track_artists
        ADD CONSTRAINT track_artists_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'track_dance_styles_track_id_fkey'
  ) THEN
    ALTER TABLE ONLY public.track_dance_styles
        ADD CONSTRAINT track_dance_styles_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'track_feel_votes_track_id_fkey'
  ) THEN
    ALTER TABLE ONLY public.track_feel_votes
        ADD CONSTRAINT track_feel_votes_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'track_playbacks_track_id_fkey'
  ) THEN
    ALTER TABLE ONLY public.track_playbacks
        ADD CONSTRAINT track_playbacks_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'track_structure_versions_track_id_fkey'
  ) THEN
    ALTER TABLE ONLY public.track_structure_versions
        ADD CONSTRAINT track_structure_versions_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'track_style_votes_track_id_fkey'
  ) THEN
    ALTER TABLE ONLY public.track_style_votes
        ADD CONSTRAINT track_style_votes_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'tracks_uploader_id_fkey'
  ) THEN
    ALTER TABLE ONLY public.tracks
        ADD CONSTRAINT tracks_uploader_id_fkey FOREIGN KEY (uploader_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'user_interactions_track_id_fkey'
  ) THEN
    ALTER TABLE ONLY public.user_interactions
        ADD CONSTRAINT user_interactions_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id);
  END IF;
END
$$;
