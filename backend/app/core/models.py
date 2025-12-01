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
    has_vocals: Mapped[bool | None] = mapped_column(Boolean, default=False, nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=True)
    
    # Relationships
    analysis_sources = relationship("AnalysisSource", back_populates="track")
    playback_links = relationship("PlaybackLink", back_populates="track")
    dance_styles = relationship("TrackDanceStyle", back_populates="track")
    feedback = relationship("TrackFeedback", back_populates="track", uselist=False)

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

class TrackFeedback(Base):
    """
    Stores user corrections. This is the 'Golden Dataset' for training.
    """
    __tablename__ = "track_feedback"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tracks.id"))
    
    # What the user said
    suggested_style: Mapped[str] = mapped_column(String) # e.g. "Hambo"
    tempo_correction: Mapped[str] = mapped_column(String) # "ok", "half", "double"
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    track = relationship("Track", back_populates="feedback")

class GenreProfile(Base):
    __tablename__ = "genre_profiles"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    genre_name: Mapped[str] = mapped_column(String, unique=True, index=True)
    avg_note_density: Mapped[float] = mapped_column(Float)
    common_meters: Mapped[dict] = mapped_column(JSONB)
    rhythm_patterns: Mapped[dict] = mapped_column(JSONB)
    sample_size: Mapped[int] = mapped_column(Integer)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())