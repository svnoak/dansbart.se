"""
Minimal SQLAlchemy models for the feature worker.

Only includes models needed for classification and spider/ingestion tasks.
The Java API owns the full schema - this worker only reads/writes specific tables.
"""
import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import String, Integer, Float, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.core.database import Base
from pgvector.sqlalchemy import Vector


class Track(Base):
    """Track entity - fields needed for classification and ingestion."""
    __tablename__ = "tracks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, index=True)
    isrc: Mapped[str | None] = mapped_column(String, unique=True, nullable=True, index=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    has_vocals: Mapped[bool | None] = mapped_column(Boolean, default=False, nullable=True)
    processing_status: Mapped[str] = mapped_column(String, default="PENDING", server_default="PENDING")
    music_genre: Mapped[str | None] = mapped_column(String, nullable=True)
    genre_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False, server_default='false')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    bars: Mapped[list[float] | None] = mapped_column(JSONB, nullable=True)

    # Lilt (per-beat rhythmic lift)
    lilt_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    lilt_consistency: Mapped[float | None] = mapped_column(Float, nullable=True)
    lilt_pattern: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    # R-Pattern Classification
    r1_mean: Mapped[float | None] = mapped_column(Float, nullable=True)
    r2_mean: Mapped[float | None] = mapped_column(Float, nullable=True)
    r3_mean: Mapped[float | None] = mapped_column(Float, nullable=True)
    asymmetry_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    asymmetry_consistency: Mapped[float | None] = mapped_column(Float, nullable=True)
    pattern_type: Mapped[str | None] = mapped_column(String, nullable=True)
    ternary_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    meter_ambiguous: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    # Relationships needed for classification and ingestion
    analysis_sources = relationship("AnalysisSource", back_populates="track", cascade="all, delete-orphan")
    dance_styles = relationship("TrackDanceStyle", back_populates="track", cascade="all, delete-orphan")
    structure_versions = relationship("TrackStructureVersion", back_populates="track", cascade="all, delete-orphan")
    artist_links = relationship("TrackArtist", back_populates="track", cascade="all, delete-orphan")
    album_links = relationship("TrackAlbum", back_populates="track", cascade="all, delete-orphan")
    playback_links = relationship("PlaybackLink", back_populates="track", cascade="all, delete-orphan")

    @property
    def primary_artist(self) -> Optional["Artist"]:
        """Get the primary artist for this track."""
        for link in self.artist_links:
            if link.role == "primary":
                return link.artist
        return self.artist_links[0].artist if self.artist_links else None

    @property
    def album(self) -> Optional["Album"]:
        """Get the first album for this track."""
        return self.album_links[0].album if self.album_links else None


class AnalysisSource(Base):
    """Stores raw ML analysis artifacts from audio-worker."""
    __tablename__ = "analysis_sources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tracks.id", ondelete="CASCADE"))
    source_type: Mapped[str] = mapped_column(String)
    raw_data: Mapped[dict] = mapped_column(JSONB)
    confidence_score: Mapped[float] = mapped_column(Float, default=1.0)
    analyzed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    track = relationship("Track", back_populates="analysis_sources")


class TrackDanceStyle(Base):
    """Classification results for a track."""
    __tablename__ = "track_dance_styles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tracks.id", ondelete="CASCADE"))

    dance_style: Mapped[str] = mapped_column(String, index=True)
    sub_style: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)

    tempo_category: Mapped[str | None] = mapped_column(String, nullable=True)
    bpm_multiplier: Mapped[float] = mapped_column(Float, default=1.0)
    effective_bpm: Mapped[int] = mapped_column(Integer)

    track = relationship("Track", back_populates="dance_styles")
    confirmation_count: Mapped[int] = mapped_column(Integer, default=0)
    is_user_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)


class StyleKeyword(Base):
    """Keyword to dance style mappings for metadata-based classification."""
    __tablename__ = "style_keywords"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    keyword: Mapped[str] = mapped_column(String, nullable=False, index=True)
    main_style: Mapped[str] = mapped_column(String, nullable=False, index=True)
    sub_style: Mapped[str | None] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default='true')


class DanceStyleConfig(Base):
    """Configuration for dance styles, including beats_per_bar for bar correction."""
    __tablename__ = "dance_style_config"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    main_style: Mapped[str] = mapped_column(String, nullable=False, index=True)
    sub_style: Mapped[str | None] = mapped_column(String, nullable=True)
    beats_per_bar: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default='true')


class TrackStructureVersion(Base):
    """Audio structure annotations (bars, sections) - subset of fields needed for bar updates."""
    __tablename__ = "track_structure_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tracks.id", ondelete="CASCADE"))
    structure_data: Mapped[dict] = mapped_column(JSONB)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)

    track = relationship("Track", back_populates="structure_versions")


# =============================================================================
# Artist & Album Models (for spider/ingestion)
# =============================================================================

class Artist(Base):
    """Artist entity."""
    __tablename__ = "artists"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    spotify_id: Mapped[str | None] = mapped_column(String, unique=True, nullable=True, index=True)
    image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default='false')

    track_links = relationship("TrackArtist", back_populates="artist")
    albums = relationship("Album", back_populates="artist")


class Album(Base):
    """Album entity."""
    __tablename__ = "albums"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, nullable=False, index=True)
    artist_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("artists.id"), nullable=True)
    spotify_id: Mapped[str | None] = mapped_column(String, unique=True, nullable=True, index=True)
    cover_image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    release_date: Mapped[str | None] = mapped_column(String, nullable=True)

    artist = relationship("Artist", back_populates="albums")
    track_links = relationship("TrackAlbum", back_populates="album")


class TrackArtist(Base):
    """Many-to-many relationship between tracks and artists."""
    __tablename__ = "track_artists"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tracks.id", ondelete="CASCADE"))
    artist_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("artists.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String, default="primary")

    track = relationship("Track", back_populates="artist_links")
    artist = relationship("Artist", back_populates="track_links")


class TrackAlbum(Base):
    """Many-to-many relationship between tracks and albums."""
    __tablename__ = "track_albums"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tracks.id", ondelete="CASCADE"))
    album_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("albums.id", ondelete="CASCADE"))

    track = relationship("Track", back_populates="album_links")
    album = relationship("Album", back_populates="track_links")


class PlaybackLink(Base):
    """Playback links for tracks (Spotify, YouTube, etc.)."""
    __tablename__ = "playback_links"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tracks.id", ondelete="CASCADE"))
    platform: Mapped[str] = mapped_column(String, nullable=False)
    deep_link: Mapped[str] = mapped_column(String, nullable=False)
    is_working: Mapped[bool] = mapped_column(Boolean, default=True, server_default='true')

    track = relationship("Track", back_populates="playback_links")


# =============================================================================
# Spider/Discovery Models
# =============================================================================

class ArtistCrawlLog(Base):
    """Log of artist crawl operations for deduplication."""
    __tablename__ = "artist_crawl_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    spotify_artist_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    artist_name: Mapped[str] = mapped_column(String, nullable=False)
    tracks_found: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String, default="success")
    detected_genres: Mapped[list] = mapped_column(ARRAY(String), default=list)
    music_genre_classification: Mapped[str | None] = mapped_column(String, nullable=True)
    discovery_source: Mapped[str | None] = mapped_column(String, nullable=True)
    crawled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RejectionLog(Base):
    """Log of rejected entities (artists, tracks) to prevent re-crawling."""
    __tablename__ = "rejection_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    spotify_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String, nullable=False)  # 'artist' or 'track'
    reason: Mapped[str | None] = mapped_column(String, nullable=True)
    rejected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PendingArtistApproval(Base):
    """Queue of artists pending manual approval."""
    __tablename__ = "pending_artist_approvals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    spotify_id: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    discovery_source: Mapped[str | None] = mapped_column(String, nullable=True)
    detected_genres: Mapped[list] = mapped_column(ARRAY(String), default=list)
    music_genre_classification: Mapped[str | None] = mapped_column(String, nullable=True)
    genre_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
