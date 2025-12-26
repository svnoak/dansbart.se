from pydantic import BaseModel
from uuid import UUID
from typing import List, Optional, Any
from datetime import datetime

class PlaybackLinkOut(BaseModel):
    id: str
    platform: str
    deep_link: str

class TempoOut(BaseModel):
    level: int      # 1-5 (for filtering/sorting)
    label: str      # "Långsamt", "Lugnt", "Lagom", "Snabbt", "Väldigt snabbt"
    relative: str   # "slower", "typical", "faster" (vs typical for this dance)

class SecondaryStyleOut(BaseModel):
    style: str
    effective_bpm: int
    tempo_category: Optional[str] = None
    tempo: Optional[TempoOut] = None
    confirmations: int = 0

class AlbumOut(BaseModel):
    id: UUID
    title: str
    release_date: Optional[str] = None

    class Config:
        from_attributes = True

class ArtistOut(BaseModel):
    id: UUID
    name: str
    role: str    
    class Config:
        from_attributes = True

class TrackOut(BaseModel):
    id: UUID
    title: str
    artists: List[ArtistOut]
    album: Optional[AlbumOut] = None  # Backward compatibility - first album
    albums: List[AlbumOut] = []  # All albums this track appears in
    dance_style: str
    sub_style: str | None = None
    has_vocals: bool | None = False
    swing_ratio: float | None = None
    articulation: float | None = None
    bounciness: float | None = None
    feel_tags: List[str] = []
    style_confidence: float = 0.0
    style_confirmations: int = 0
    secondary_styles: List[SecondaryStyleOut] = []
    effective_bpm: int
    tempo_category: str | None  # Legacy - keep for backwards compatibility
    tempo: Optional[TempoOut] = None  # New: structured tempo data
    duration: int | None = None
    bars: List[float] | None = None
    sections: List[float] | None = None
    section_labels: List[str] | None = None
    playback_links: List[PlaybackLinkOut]
    version_count: int = 0

    class Config:
        from_attributes = True

class LinkSubmission(BaseModel):
    url: str

class FeedbackIn(BaseModel):
    style: str  # e.g., "Polska"
    main_style: str | None = None # e.g. Boda
    tempo_correction: str # "ok", "half", "double"
    tempo_category: str | None = None  # Direct category: "Slow", "Medium", "Fast", "Turbo"
    manual_bpm: float | None = None

class StructureIn(BaseModel):
    bars: Optional[List[float]] = None
    sections: Optional[List[float]] = None
    section_labels: Optional[List[str]] = None
    author_alias: str | None = None

class VoteIn(BaseModel):
    vote_type: str  # "up" or "down"

class StructureVersionOut(BaseModel):
    id: UUID
    created_at: datetime
    description: Optional[str]
    vote_count: int
    is_active: bool
    structure_data: Any
    author_alias: Optional[str] = None

    class Config:
        from_attributes = True

class MovementVoteIn(BaseModel):
    dance_style: str  # The context (e.g., "Polska")
    tags: list[str]   # The tags selected (e.g., ["Sviktande", "Tungt"])

class PlaybackTrackingIn(BaseModel):
    platform: str  # 'youtube' or 'spotify'
    session_id: Optional[str] = None
    duration_seconds: Optional[int] = None  # How many seconds were actually listened
    completed: bool = False  # Whether the track was played past the threshold

class InteractionTrackingIn(BaseModel):
    event_type: str  # 'nudge_shown', 'modal_opened', etc.
    track_id: Optional[str] = None
    event_data: Optional[dict] = None
    session_id: Optional[str] = None

class VisitorSessionIn(BaseModel):
    session_id: str
    user_agent: Optional[str] = None
    is_returning: bool = False

# ========== ARTIST & ALBUM DETAIL SCHEMAS ==========

class ArtistAlbumOut(BaseModel):
    """Album info for artist detail view"""
    id: UUID
    title: str
    release_date: Optional[str] = None

    class Config:
        from_attributes = True

class ArtistDetailOut(BaseModel):
    """Artist detail response with albums"""
    id: UUID
    name: str
    is_verified: bool = False
    total_tracks: int
    albums: List[ArtistAlbumOut]

    class Config:
        from_attributes = True

class AlbumArtistOut(BaseModel):
    """Artist info for album detail view"""
    id: UUID
    name: str

    class Config:
        from_attributes = True

class AlbumDetailOut(BaseModel):
    """Album detail response with all contributing artists"""
    id: UUID
    title: str
    artist_id: Optional[UUID] = None
    artist_name: Optional[str] = None
    all_artists: List[AlbumArtistOut]
    release_date: Optional[str] = None
    total_tracks: int

    class Config:
        from_attributes = True

class ArtistListItemOut(BaseModel):
    """Artist list item with stats"""
    id: UUID
    name: str
    is_verified: bool = False
    total_tracks: int
    done_tracks: int
    pending_tracks: int
    failed_tracks: int

    class Config:
        from_attributes = True

class AlbumListItemOut(BaseModel):
    """Album list item with stats"""
    id: UUID
    title: str
    artist_name: Optional[str] = None
    artist_id: Optional[UUID] = None
    all_artists: List[str]
    release_date: Optional[str] = None
    total_tracks: int
    done_tracks: int
    pending_tracks: int
    failed_tracks: int

    class Config:
        from_attributes = True