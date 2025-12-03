from pydantic import BaseModel
from uuid import UUID
from typing import List, Optional

class PlaybackLinkOut(BaseModel):
    id: str
    platform: str
    deep_link: str

class TrackOut(BaseModel):
    id: UUID
    title: str
    artist_name: str
    album_name: Optional[str] = None
    
    # Computed fields from your classifier
    dance_style: str
    has_vocals: bool | None = False
    style_confidence: float = 0.0
    style_confirmations: int = 0
    effective_bpm: int
    tempo_category: str | None
    duration: int | None = None
    bars: List[float] | None = None
    sections: List[float] | None = None,
    section_labels: List[str] | None = None
    playback_links: List[PlaybackLinkOut]

    class Config:
        from_attributes = True

class LinkSubmission(BaseModel):
    url: str

class FeedbackIn(BaseModel):
    style: str  # e.g., "Hambo"
    tempo_correction: str # "ok", "half", "double"