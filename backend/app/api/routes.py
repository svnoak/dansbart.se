from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.models import PlaybackLink
from app.api.schemas import TrackOut
from fastapi import HTTPException
from pydantic import BaseModel
from app.services.tracks import TrackService
from app.services.feedback import FeedbackService
from app.services.links import LinkService
from app.services.stats import StatsService

router = APIRouter()

class FeedbackIn(BaseModel):
    style: str  # e.g., "Hambo"
    tempo_correction: str # "ok", "half", "double"

@router.post("/tracks/{track_id}/feedback")
def submit_track_feedback(
    track_id: str, 
    feedback: FeedbackIn, 
    db: Session = Depends(get_db)
):
    service = FeedbackService(db)
    success = service.process_feedback(
        track_id=track_id,
        style=feedback.style,
        tempo_correction=feedback.tempo_correction
    )

    if not success:
        raise HTTPException(status_code=404, detail="Track not found")
    
    return {"status": "success", "message": "Feedback recorded. Votes updated."}

@router.get("/tracks", response_model=list[TrackOut])
def get_tracks(
    style: str = Query(None),
    min_bpm: int = Query(None),
    max_bpm: int = Query(None),
    db: Session = Depends(get_db)
):
    service = TrackService(db)
    return service.get_playable_tracks(
        style=style, 
        min_bpm=min_bpm, 
        max_bpm=max_bpm
    )

@router.patch("/links/{link_id}/report")
def report_broken_link(
    link_id: str, 
    reason: str = Query("broken"), # Default to 'broken', accept 'wrong_track'
    db: Session = Depends(get_db)
):
    service = LinkService(db)
    success = service.report_broken(link_id, reason)
    
    if not success:
        raise HTTPException(status_code=404, detail="Link not found")
    
    return {"status": "success", "message": f"Link flagged as {reason}"}

@router.get("/stats")
def get_library_stats(db: Session = Depends(get_db)):
    service = StatsService(db)
    return service.get_global_stats()