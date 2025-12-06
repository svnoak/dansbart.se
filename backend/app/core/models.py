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
    album: Mapped["Album"] = relationship("Album", back_populates="tracks")
    artist_links: Mapped[List["TrackArtist"]] = relationship("TrackArtist", back_populates="track", cascade="all, delete-orphan")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    has_vocals: Mapped[bool | None] = mapped_column(Boolean, default=False, nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=True)
    
    # Relationships
    analysis_sources = relationship("AnalysisSource", back_populates="track")
    playback_links = relationship("PlaybackLink", back_populates="track")
    dance_styles = relationship("TrackDanceStyle", back_populates="track")
    style_votes = relationship("TrackStyleVote", back_populates="track")
    structure_versions = relationship("TrackStructureVersion", back_populates="track")
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
    role: Mapped[str] = mapped_column(String, default="primary") # 'primary', 'featured', 'remixer'
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

    # Link to the main "Album Artist" (e.g., Jay-Z album, even if Linkin Park is on a track)
    artist_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("artists.id"), nullable=True)
    
    # Relationships
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
    
    # Rhythmic Data
    tempo_category: Mapped[str | None] = mapped_column(String, nullable=True) # Slow, Medium, Fast
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
    Now strictly for users saying "This is a Waltz" or "This is too fast".
    Structure data has been moved out.
    """
    __tablename__ = "track_style_votes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tracks.id"))
    
    suggested_style: Mapped[str | None] = mapped_column(String, nullable=True) 
    tempo_correction: Mapped[str | None] = mapped_column(String, nullable=True) 
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    track = relationship("Track", back_populates="style_votes")

class TrackStructureVersion(Base):
    """
    Stores versions of the Grid/Sections.
    This allows us to have 'AI Version', 'User A Version', 'User B Version'.
    """
    __tablename__ = "track_structure_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tracks.id"))
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    description: Mapped[str | None] = mapped_column(String, nullable=True) # e.g. "Fixed the bridge"
    
    # The Full Data Snapshot
    structure_data: Mapped[dict] = mapped_column(JSONB) 
    # Expected format: { "bars": [], "sections": [], "section_labels": [] }

    # Voting & State
    vote_count: Mapped[int] = mapped_column(Integer, default=1)
    report_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False) # Is this the one currently applied to the Track?
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