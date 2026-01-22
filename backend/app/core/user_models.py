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
    Full user data (email, password, OAuth connections, etc.) lives in Authentik.
    We intentionally do NOT store email here to minimize PII and GDPR exposure.
    """
    __tablename__ = "users"

    # Primary key matches Authentik's user ID (hex string from 'sub' claim)
    id: Mapped[str] = mapped_column(String(255), primary_key=True)

    display_name: Mapped[str | None] = mapped_column(String, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)

    # Username for user identification (case-insensitive unique)
    username: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    # Account metadata
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    playlists: Mapped[List["Playlist"]] = relationship(
        "Playlist",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    # Playlist collaborations
    collaborations: Mapped[List["PlaylistCollaborator"]] = relationship(
        "PlaylistCollaborator",
        foreign_keys="PlaylistCollaborator.user_id",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    # Invitations sent by this user
    sent_invitations: Mapped[List["PlaylistCollaborator"]] = relationship(
        "PlaylistCollaborator",
        foreign_keys="PlaylistCollaborator.invited_by",
        back_populates="inviter"
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
    user_id: Mapped[str] = mapped_column(String(255), ForeignKey("users.id"), nullable=False, index=True)

    # Metadata
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)

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
    collaborators: Mapped[List["PlaylistCollaborator"]] = relationship(
        "PlaylistCollaborator",
        back_populates="playlist",
        cascade="all, delete-orphan"
    )

    @property
    def owner(self):
        """Alias for user relationship (for API schema compatibility)."""
        return self.user

    @property
    def tracks(self):
        """Alias for track_links (for API schema compatibility)."""
        return self.track_links


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
    track: Mapped["Track"] = relationship("app.core.models.Track")


class PlaylistCollaborator(Base):
    """
    User collaboration on playlists with permissions.

    Allows playlist owners to invite other users by username with specific permissions.
    """
    __tablename__ = "playlist_collaborators"
    __table_args__ = (
        UniqueConstraint('playlist_id', 'user_id', name='unique_playlist_user_collaboration'),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    playlist_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(255), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Permission level: 'view' (read-only) or 'edit' (can add/remove/reorder tracks)
    permission: Mapped[str] = mapped_column(String(10), nullable=False)

    # Invitation metadata
    invited_by: Mapped[str | None] = mapped_column(String(255), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    invited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Status: 'pending', 'accepted', 'rejected'
    status: Mapped[str] = mapped_column(String(20), server_default='pending', nullable=False, index=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    playlist: Mapped["Playlist"] = relationship("Playlist", back_populates="collaborators")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], back_populates="collaborations")
    inviter: Mapped["User | None"] = relationship("User", foreign_keys=[invited_by], back_populates="sent_invitations")
