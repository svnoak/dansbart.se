"""
User authentication and playlist models.

These models are separate from the main track models to keep the codebase organized.
"""
import uuid
from datetime import datetime
from typing import List, TYPE_CHECKING
from sqlalchemy import String, Integer, Boolean, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.core.database import Base

if TYPE_CHECKING:
    from app.core.models import Track


class User(Base):
    """
    User account linked to Authentik.

    This table stores minimal user info for foreign key relationships.
    Full user data (password, OAuth connections, etc.) lives in Authentik.
    """
    __tablename__ = "users"

    # Primary key matches Authentik's user ID (UUID from 'sub' claim)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)

    # Cached user info from Authentik OIDC claims (synced on login)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)

    # Account metadata
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    playlists: Mapped[List["Playlist"]] = relationship(
        "Playlist",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    # Phase 2: User uploads
    # uploaded_tracks: Mapped[List["Track"]] = relationship(
    #     "Track",
    #     back_populates="uploader",
    #     foreign_keys="Track.uploader_id"
    # )


class Playlist(Base):
    """User-created playlist of tracks"""
    __tablename__ = "playlists"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    # Metadata
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    cover_image_url: Mapped[str | None] = mapped_column(String, nullable=True)

    # Privacy & Sharing
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, server_default='false')
    share_token: Mapped[str | None] = mapped_column(String, unique=True, nullable=True, index=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="playlists")
    track_links: Mapped[List["PlaylistTrack"]] = relationship(
        "PlaylistTrack",
        back_populates="playlist",
        cascade="all, delete-orphan",
        order_by="PlaylistTrack.position"
    )


class PlaylistTrack(Base):
    """Junction table for playlists and tracks with ordering"""
    __tablename__ = "playlist_tracks"
    __table_args__ = (
        UniqueConstraint('playlist_id', 'track_id', name='unique_playlist_track'),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    playlist_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("playlists.id"), nullable=False, index=True)
    track_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tracks.id"), nullable=False, index=True)

    # Ordering
    position: Mapped[int] = mapped_column(Integer, nullable=False)

    # Metadata
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    playlist: Mapped["Playlist"] = relationship("Playlist", back_populates="track_links")
    track: Mapped["Track"] = relationship("Track")
