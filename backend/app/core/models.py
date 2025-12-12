import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import String, Integer, Float, Boolean, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Track(Base):
    __tablename__ = "tracks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, index=True)
    isrc: Mapped[str | None] = mapped_column(String, unique=True, index=True)
    album_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("albums.id"), nullable=True)
    
    # Metadata Relationships
    album: Mapped["Album"] = relationship("Album", back_populates="tracks")
    artist_links: Mapped[List["TrackArtist"]] = relationship("TrackArtist", back_populates="track", cascade="all, delete-orphan")
    
    # Audio Features
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    has_vocals: Mapped[bool | None] = mapped_column(Boolean, default=False, nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=True)
    swing_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    articulation: Mapped[float | None] = mapped_column(Float, nullable=True)
    bounciness: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Music Genre Classification (separate from dance style)
    # Values: 'traditional_folk', 'modern_folk', 'folk_pop', 'contemporary', 'unknown'
    music_genre: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    genre_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    # User Flagging System (for reporting non-folk tracks)
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False, server_default='false', index=True)
    flagged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    flag_reason: Mapped[str | None] = mapped_column(String, nullable=True)

    # Logic Relationships
    analysis_sources = relationship("AnalysisSource", back_populates="track")
    playback_links = relationship("PlaybackLink", back_populates="track")
    dance_styles = relationship("TrackDanceStyle", back_populates="track")
    
    # Voting & Structure
    style_votes = relationship("TrackStyleVote", back_populates="track")
    feel_votes = relationship("TrackFeelVote", back_populates="track")
    structure_versions = relationship("TrackStructureVersion", back_populates="track")
    
    # Analysis Data blobs
    bars: Mapped[list[float] | None] = mapped_column(JSONB, nullable=True)
    sections: Mapped[list[float] | None] = mapped_column(JSONB, nullable=True)
    section_labels: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    processing_status: Mapped[str] = mapped_column(String, default="PENDING", server_default="PENDING")

    @property
    def primary_artist(self) -> Optional["Artist"]:
        """Returns the first artist marked as primary."""
        for link in self.artist_links:
            if link.role == 'primary':
                return link.artist
        return self.artist_links[0].artist if self.artist_links else None

class TrackArtist(Base):
    __tablename__ = "track_artists"
    __table_args__ = (
        UniqueConstraint('track_id', 'artist_id', name='unique_track_artist'),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tracks.id"))
    artist_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("artists.id"))
    role: Mapped[str] = mapped_column(String, default="primary")
    track: Mapped["Track"] = relationship("Track", back_populates="artist_links")
    artist: Mapped["Artist"] = relationship("Artist", back_populates="track_links")

class Artist(Base):
    __tablename__ = "artists"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, index=True)
    image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    spotify_id: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    track_links: Mapped[List["TrackArtist"]] = relationship("TrackArtist", back_populates="artist")
    albums: Mapped[List["Album"]] = relationship("Album", back_populates="artist")

class Album(Base):
    __tablename__ = "albums"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, index=True)
    cover_image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    release_date: Mapped[str | None] = mapped_column(String, nullable=True)
    artist_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("artists.id"), nullable=True)
    
    artist: Mapped["Artist"] = relationship("Artist", back_populates="albums")
    tracks: Mapped[List["Track"]] = relationship("Track", back_populates="album")

class AnalysisSource(Base):
    __tablename__ = "analysis_sources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tracks.id"))
    source_type: Mapped[str] = mapped_column(String)
    raw_data: Mapped[dict] = mapped_column(JSONB)
    confidence_score: Mapped[float] = mapped_column(Float, default=1.0)
    analyzed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    track = relationship("Track", back_populates="analysis_sources")

class TrackDanceStyle(Base):
    __tablename__ = "track_dance_styles"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tracks.id"))
    
    dance_style: Mapped[str] = mapped_column(String, index=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    
    tempo_category: Mapped[str | None] = mapped_column(String, nullable=True)
    bpm_multiplier: Mapped[float] = mapped_column(Float, default=1.0)
    effective_bpm: Mapped[int] = mapped_column(Integer)   
    
    track = relationship("Track", back_populates="dance_styles")
    confirmation_count: Mapped[int] = mapped_column(Integer, default=0)
    is_user_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)

class PlaybackLink(Base):
    __tablename__ = "playback_links"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tracks.id"))
    platform: Mapped[str] = mapped_column(String)
    deep_link: Mapped[str] = mapped_column(String)
    is_working: Mapped[bool] = mapped_column(Boolean, default=True)
    
    track = relationship("Track", back_populates="playback_links")

class TrackStyleVote(Base):
    """
    Users saying 'This is a Waltz' or 'This is too fast'.
    """
    __tablename__ = "track_style_votes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tracks.id"))
    
    suggested_style: Mapped[str | None] = mapped_column(String, nullable=True) 
    tempo_correction: Mapped[str | None] = mapped_column(String, nullable=True) 
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    track = relationship("Track", back_populates="style_votes")

class TrackStructureVersion(Base):
    __tablename__ = "track_structure_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tracks.id"))
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    
    structure_data: Mapped[dict] = mapped_column(JSONB) 
    
    vote_count: Mapped[int] = mapped_column(Integer, default=1)
    report_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    author_alias: Mapped[str | None] = mapped_column(String, nullable=True)
    track = relationship("Track", back_populates="structure_versions")
    

class GenreProfile(Base):
    __tablename__ = "genre_profiles"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    genre_name: Mapped[str] = mapped_column(String, unique=True, index=True)
    avg_note_density: Mapped[float] = mapped_column(Float)
    common_meters: Mapped[dict] = mapped_column(JSONB)
    rhythm_patterns: Mapped[dict] = mapped_column(JSONB)
    sample_size: Mapped[int] = mapped_column(Integer)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class DanceMovementFeedback(Base):
    """
    Stores the GLOBAL consensus on how a specific Dance Style feels.
    Self-adjusts based on TrackFeelVotes.
    """
    __tablename__ = "dance_movement_feedback"
    __table_args__ = (
        UniqueConstraint('dance_style', 'movement_tag', name='_dance_move_uc'),
    )

    # Use UUID to match the rest of your system, or Integer if you prefer small lookups.
    # Using UUID for consistency with your Base.
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # The Key: Which dance are we talking about?
    dance_style: Mapped[str] = mapped_column(String, index=True, nullable=False)  # e.g., "Hambo"
    
    # The Value: What is the vibe/movement?
    movement_tag: Mapped[str] = mapped_column(String, index=True, nullable=False) # e.g., "Sviktande"
    
    # The Weights (The "Brain")
    score: Mapped[float] = mapped_column(Float, default=0.0)      # Cumulative points
    occurrences: Mapped[int] = mapped_column(Integer, default=0)  # Total votes count

class TrackFeelVote(Base):
    """
    Users tagging a specific track with a movement feel.
    Example: Track A (Hambo) -> "Sviktande".
    """
    __tablename__ = "track_feel_votes"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tracks.id"))
    feel_tag: Mapped[str] = mapped_column(String, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    track = relationship("Track", back_populates="feel_votes")

class ArtistCrawlLog(Base):
    """
    Tracks which artists have been crawled by the discovery spider to avoid duplicates.
    """
    __tablename__ = "artist_crawl_logs"
    __table_args__ = (
        UniqueConstraint('spotify_artist_id', name='unique_spotify_artist_crawl'),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    spotify_artist_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    artist_name: Mapped[str] = mapped_column(String, nullable=False)

    # Crawl metadata
    crawled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    tracks_found: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String, default="success")  # success, failed, skipped

    # Genre classification info
    detected_genres: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    music_genre_classification: Mapped[str | None] = mapped_column(String, nullable=True)  # traditional_folk, modern_folk, etc.

    # Why was this artist crawled?
    discovery_source: Mapped[str | None] = mapped_column(String, nullable=True)  # 'spider', 'manual', 'seed'

class RejectionLog(Base):
    """
    Tracks rejected artists, albums, and tracks to prevent re-ingestion.
    Acts as a blocklist for the spider and manual ingestion.
    """
    __tablename__ = "rejection_logs"
    __table_args__ = (
        UniqueConstraint('spotify_id', 'entity_type', name='unique_rejection'),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # What was rejected?
    entity_type: Mapped[str] = mapped_column(String, nullable=False, index=True)  # 'artist', 'album', 'track'
    spotify_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    entity_name: Mapped[str] = mapped_column(String, nullable=False)

    # Why was it rejected?
    reason: Mapped[str | None] = mapped_column(String, nullable=True)
    rejected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Additional context
    additional_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # Store genre, artist info, etc.

class PendingArtistApproval(Base):
    """
    Queue for artists discovered by the spider that need manual approval before ingestion.
    Used when the spider finds artists that aren't clearly folk music.
    """
    __tablename__ = "pending_artist_approvals"
    __table_args__ = (
        UniqueConstraint('spotify_id', name='unique_pending_artist'),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Artist info from Spotify
    spotify_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    image_url: Mapped[str | None] = mapped_column(String, nullable=True)

    # Discovery metadata
    discovered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    discovery_source: Mapped[str] = mapped_column(String, nullable=False)  # 'spider_search', 'spider_backfill', etc.

    # Genre classification (why it needs approval)
    detected_genres: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    music_genre_classification: Mapped[str | None] = mapped_column(String, nullable=True)
    genre_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Status
    status: Mapped[str] = mapped_column(String, default="pending", index=True)  # pending, approved, rejected
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Additional context
    additional_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

class TrackPlayback(Base):
    """
    Records every time a track is played.
    Used for analytics: popular tracks, platform preferences, usage patterns.
    """
    __tablename__ = "track_playbacks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tracks.id"), index=True, nullable=False)

    # Playback details
    platform: Mapped[str] = mapped_column(String, nullable=False)  # 'youtube', 'spotify'
    played_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Session tracking (optional, for grouping user behavior)
    session_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)

    track = relationship("Track")

class UserInteraction(Base):
    """
    Tracks user interactions with the UI for analytics and funnel analysis.
    Examples: nudge shown, modal opened, button clicked, etc.
    """
    __tablename__ = "user_interactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tracks.id"), nullable=True, index=True)

    # Event classification
    event_type: Mapped[str] = mapped_column(String, index=True, nullable=False)  # 'nudge_shown', 'modal_opened', etc.
    event_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # Flexible JSON for additional context

    # Timing
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Session tracking
    session_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)

    track = relationship("Track")