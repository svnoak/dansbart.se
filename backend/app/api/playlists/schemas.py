"""
Pydantic schemas for playlist API.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Literal
from enum import Enum


class PlaylistCreate(BaseModel):
    """Schema for creating a new playlist."""
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    is_public: bool = False


class PlaylistUpdate(BaseModel):
    """Schema for updating a playlist."""
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    is_public: bool | None = None


class PlaylistTrackAdd(BaseModel):
    """Schema for adding a track to a playlist."""
    track_id: str  # UUID string
    position: int | None = None  # If None, append to end


class PlaylistTrackReorder(BaseModel):
    """Schema for reordering a track in a playlist."""
    track_id: str
    new_position: int


class PlaylistOwnerOut(BaseModel):
    """Playlist owner info."""
    id: str
    display_name: str | None
    avatar_url: str | None

    class Config:
        from_attributes = True


class PlaylistOut(BaseModel):
    """Playlist response without tracks."""
    id: str
    name: str
    description: str | None
    is_public: bool
    share_token: str | None
    track_count: int
    total_duration_ms: int
    created_at: datetime
    updated_at: datetime
    owner: PlaylistOwnerOut

    class Config:
        from_attributes = True


class PlaylistTrackOut(BaseModel):
    """Track in a playlist with position info."""
    id: str  # PlaylistTrack.id
    track: dict  # TrackOut from public schemas
    position: int
    added_at: datetime

    class Config:
        from_attributes = True


class PlaylistDetailOut(PlaylistOut):
    """Playlist response with full track list."""
    tracks: List[PlaylistTrackOut]


# Collaboration Schemas

class PermissionLevel(str, Enum):
    """Permission levels for playlist collaboration."""
    VIEW = 'view'
    EDIT = 'edit'


class InvitationStatus(str, Enum):
    """Status of a collaboration invitation."""
    PENDING = 'pending'
    ACCEPTED = 'accepted'
    REJECTED = 'rejected'


class PlaylistInviteCreate(BaseModel):
    """Schema for inviting a user to collaborate on a playlist."""
    username: str = Field(..., min_length=3, max_length=50)
    permission: PermissionLevel


class PlaylistInviteUpdate(BaseModel):
    """Schema for accepting/rejecting an invitation."""
    status: Literal['accepted', 'rejected']


class CollaboratorUserOut(BaseModel):
    """User info for collaborator display."""
    id: str
    username: str
    display_name: str | None
    avatar_url: str | None

    class Config:
        from_attributes = True


class PlaylistCollaboratorOut(BaseModel):
    """Full collaborator information."""
    id: str
    user: CollaboratorUserOut
    permission: str
    status: str
    invited_at: datetime
    accepted_at: datetime | None
    invited_by_username: str | None

    class Config:
        from_attributes = True


class PlaylistWithPermissionsOut(PlaylistOut):
    """Playlist response with user's permission level."""
    user_permission: str | None  # 'owner', 'edit', 'view', or None


class PlaylistDetailWithPermissionsOut(PlaylistDetailOut):
    """Playlist detail response with user's permission level."""
    user_permission: str | None  # 'owner', 'edit', 'view', or None
