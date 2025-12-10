from fastapi import APIRouter, Depends, HTTPException, Header, BackgroundTasks, Query
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.services.pipeline import PipelineService
from pydantic import BaseModel
from app.services.feedback import FeedbackService
from app.core.models import Track, TrackDanceStyle, TrackArtist
from app.workers.tasks import analyze_track_task
from app.services.classification import ClassificationService
import os

router = APIRouter()

# Simple security
ADMIN_SECRET = "my-super-secret-password-123"

def verify_admin(x_admin_token: str = Header(None)):
    #ADMIN_SECRET = os.getenv("ADMIN_PASSWORD")
    

    if not ADMIN_SECRET:
        # This logs an error on the server side so you know config is missing
        print("CRITICAL ERROR: ADMIN_PASSWORD is not set!") 
        raise HTTPException(status_code=500, detail="Server misconfiguration")
    if x_admin_token != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Not authorized")
    return True

class IngestRequest(BaseModel):
    playlist_id: str

@router.post("/ingest")
def trigger_ingest(
    req: IngestRequest, 
    x_admin_token: str = Header(None),
    db: Session = Depends(get_db)
):
    if x_admin_token != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Not authorized")

    pipeline = PipelineService(db)
    return pipeline.ingest_and_process_playlist(req.playlist_id)

@router.get("/tracks")
def get_all_tracks_admin(
    search: str = Query(None),
    status: str = Query(None, description="Filter by status: PENDING, PROCESSING, DONE, FAILED"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    x_admin_token: str = Header(None),
    db: Session = Depends(get_db)
):
    """
    Admin endpoint to list all tracks with their status.
    """
    if x_admin_token != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = db.query(Track).options(
        joinedload(Track.dance_styles),
        joinedload(Track.artist_links).joinedload(TrackArtist.artist)
    )
    
    if search:
        query = query.filter(Track.title.ilike(f"%{search}%"))
    
    if status:
        query = query.filter(Track.processing_status == status)
    
    total = query.count()
    tracks = query.order_by(Track.created_at.desc()).offset(offset).limit(limit).all()
    
    results = []
    for track in tracks:
        primary_style = next((s for s in track.dance_styles if s.is_primary), None)
        artist_names = [link.artist.name for link in track.artist_links] if track.artist_links else []
        
        results.append({
            "id": str(track.id),
            "title": track.title,
            "artists": artist_names,
            "status": track.processing_status,
            "dance_style": primary_style.dance_style if primary_style else None,
            "confidence": primary_style.confidence if primary_style else None,
            "created_at": track.created_at.isoformat() if track.created_at else None
        })
    
    return {
        "items": results,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.post("/tracks/{track_id}/reanalyze")
def trigger_reanalysis(
    track_id: str,
    x_admin_token: str = Header(None),
    db: Session = Depends(get_db)
):
    """
    Forces a complete re-analysis of a track.
    Resets status to PENDING and queues for analysis.
    """
    if x_admin_token != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    # Reset status to trigger re-analysis
    track.processing_status = "PENDING"
    db.commit()
    
    # Queue the analysis task
    analyze_track_task.delay(track_id)
    
    return {
        "status": "success",
        "message": f"Re-analysis queued for: {track.title}"
    }


@router.post("/tracks/{track_id}/reclassify")
def trigger_reclassification(
    track_id: str,
    x_admin_token: str = Header(None),
    db: Session = Depends(get_db)
):
    """
    Re-runs only the classification (no audio re-download/analysis).
    Useful when classification logic has been updated.
    """
    if x_admin_token != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    track = db.query(Track).options(
        joinedload(Track.analysis_sources),
        joinedload(Track.dance_styles),
        joinedload(Track.artist_links).joinedload(TrackArtist.artist),
        joinedload(Track.album)
    ).filter(Track.id == track_id).first()
    
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    # Check if we have analysis data
    source = next((s for s in track.analysis_sources if s.source_type == 'hybrid_ml_v2'), None)
    if not source:
        raise HTTPException(status_code=400, detail="No analysis data found. Run full re-analysis instead.")
    
    # Run classification
    classifier = ClassificationService(db)
    classifier.classify_track_immediately(track)
    
    # Get the new primary style
    db.refresh(track)
    primary_style = next((s for s in track.dance_styles if s.is_primary), None)
    
    return {
        "status": "success",
        "message": f"Reclassified: {track.title}",
        "new_style": primary_style.dance_style if primary_style else "Unknown"
    }


@router.post("/reclassify-all")
def trigger_reclassify_all(
    x_admin_token: str = Header(None),
    db: Session = Depends(get_db)
):
    """
    Re-runs classification on ALL tracks (useful after updating classification logic).
    """
    if x_admin_token != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    classifier = ClassificationService(db)
    classifier.reclassify_library()
    
    return {
        "status": "success",
        "message": "Library reclassification complete"
    }


@router.post("/tracks/{track_id}/structure/reset")
def reset_track_structure_endpoint(
    track_id: str, 
    db: Session = Depends(get_db)
):
    service = FeedbackService(db)
    result = service.reset_track_structure(track_id)
    
    if not result:
        raise HTTPException(status_code=404, detail="Track or AI source not found")
    
    return {
        "status": "success", 
        "message": "Structure reset to AI defaults.",
        "updates": result
    }