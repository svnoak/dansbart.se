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
    style_votes = relationship("TrackStyleVote", back_populates="track")
    structure_versions = relationship("TrackStructureVersion", back_populates="track")
    bars: Mapped[list[float] | None] = mapped_column(JSONB, nullable=True)
    sections: Mapped[list[float] | None] = mapped_column(JSONB, nullable=True)
    section_labels: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    processing_status: Mapped[str] = mapped_column(String, default="PENDING", server_default="PENDING")

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