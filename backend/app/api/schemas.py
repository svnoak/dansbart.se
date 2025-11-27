from pydantic import BaseModel
from uuid import UUID
from typing import List, Optional

class PlaybackLinkOut(BaseModel):
    platform: str
    deep_link: str

class TrackOut(BaseModel):
    id: UUID
    title: str
    artist_name: str
    album_name: Optional[str] = None
    
    # Computed fields from your classifier
    dance_style: str
    effective_bpm: int
    has_vocals: bool | None = False
    style_confidence: float = 0.0

    playback_links: List[PlaybackLinkOut]

    class Config:
        from_attributes = True