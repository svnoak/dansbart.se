import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Track(Base):
    __tablename__ = "tracks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, index=True)
    artist_name: Mapped[str] = mapped_column(String)
    album_name: Mapped[str | None] = mapped_column(String, nullable=True)
    isrc: Mapped[str | None] = mapped_column(String, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    analysis_sources = relationship("AnalysisSource", back_populates="track")
    playback_links = relationship("PlaybackLink", back_populates="track")
    dance_styles = relationship("TrackDanceStyle", back_populates="track")

class AnalysisSource(Base):
    __tablename__ = "analysis_sources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tracks.id"))
    source_type: Mapped[str] = mapped_column(String)
    raw_data: Mapped[dict] = mapped_column(JSONB)
    
    # --- NEW COLUMNS ADDED HERE ---
    confidence_score: Mapped[float] = mapped_column(Float, default=1.0)
    analyzed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # ------------------------------

    track = relationship("Track", back_populates="analysis_sources")

class TrackDanceStyle(Base):
    __tablename__ = "track_dance_styles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tracks.id"))
    dance_style: Mapped[str] = mapped_column(String)
    bpm_multiplier: Mapped[float] = mapped_column(Float, default=1.0)
    effective_bpm: Mapped[int] = mapped_column(Integer)
    
    track = relationship("Track", back_populates="dance_styles")

class PlaybackLink(Base):
    __tablename__ = "playback_links"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tracks.id"))
    platform: Mapped[str] = mapped_column(String)
    deep_link: Mapped[str] = mapped_column(String)
    
    track = relationship("Track", back_populates="playback_links")

class GenreProfile(Base):
    """
    The 'Platinum Standard' definition of a genre based on Folkwiki analysis.
    Used to validate audio guesses.
    """
    __tablename__ = "genre_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    genre_name: Mapped[str] = mapped_column(String, unique=True, index=True) # e.g. 'Hambo'
    
    # Statistical Averages
    avg_note_density: Mapped[float] = mapped_column(Float) # Notes per bar
    common_meters: Mapped[dict] = mapped_column(JSONB)     # e.g. {"3/4": 85, "3/8": 10}
    rhythm_patterns: Mapped[dict] = mapped_column(JSONB)   # Top 10 bar patterns
    
    sample_size: Mapped[int] = mapped_column(Integer)      # How many tracks we analyzed
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())