from pydantic import BaseModel
from uuid import UUID
from typing import List, Optional, Any
from datetime import datetime
from app.api.public.schemas import AlbumOut

class AlbumOutAdmin(AlbumOut):
    cover_image_url: Optional[str] = None

class AdminArtistListItem(BaseModel):
    id: UUID
    name: str
    spotify_id: Optional[str] = None
    image_url: Optional[str] = None
    
    # Stats fields returned by your service
    total_tracks: int = 0
    done_tracks: int = 0
    pending_tracks: int = 0
    
    # Isolation/Network fields
    is_isolated: bool = False
    is_verified: bool = False
    shared_with_artists: List[str] = []
    shared_tracks: int = 0
    shared_albums: int = 0

    class Config:
        from_attributes = True

class PlaybackLinkOut(BaseModel):
    platform: str
    deep_link: str
    is_working: bool

    class Config:
        from_attributes = True

class AdminTrackListItem(BaseModel):
    id: UUID
    title: str
    artists: List[str]
    album_title: Optional[str] = None
    album_id: Optional[UUID] = None

    status: str
    dance_style: Optional[str] = None
    confidence: Optional[float] = None

    created_at: Optional[datetime] = None
    is_flagged: bool = False
    flagged_at: Optional[datetime] = None
    flag_reason: Optional[str] = None

    playback_links: List[PlaybackLinkOut] = []

    class Config:
        from_attributes = True