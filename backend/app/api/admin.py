from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.config import settings
from app.services.pipeline import PipelineService
from pydantic import BaseModel
from app.services.feedback import FeedbackService
from app.core.models import Track, TrackArtist
from app.workers.tasks import analyze_track_task
from app.services.classification import ClassificationService

router = APIRouter()

def verify_admin(x_admin_token: str = Header(None)):
    """Verify admin token from request header against configured password."""
    if not settings.ADMIN_PASSWORD:
        # This logs an error on the server side so you know config is missing
        print("CRITICAL ERROR: ADMIN_PASSWORD is not set in environment!")
        raise HTTPException(status_code=500, detail="Server misconfiguration")
    if x_admin_token != settings.ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="Not authorized")
    return True

class IngestRequest(BaseModel):
    playlist_id: str

@router.post("/ingest")
def trigger_ingest(
    req: IngestRequest,
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    pipeline = PipelineService(db)
    return pipeline.ingest_and_process_playlist(req.playlist_id)

@router.get("/tracks")
def get_all_tracks_admin(
    search: str = Query(None),
    status: str = Query(None, description="Filter by status: PENDING, PROCESSING, DONE, FAILED"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Admin endpoint to list all tracks with their status.
    """
    
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
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Forces a complete re-analysis of a track.
    Resets status to PENDING and queues for analysis.
    """
    
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
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Re-runs only the classification (no audio re-download/analysis).
    Useful when classification logic has been updated.
    """
    
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
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Re-runs classification on ALL tracks (useful after updating classification logic).
    """
    
    classifier = ClassificationService(db)
    classifier.reclassify_library()
    
    return {
        "status": "success",
        "message": "Library reclassification complete"
    }


@router.post("/tracks/{track_id}/structure/reset")
def reset_track_structure_endpoint(
    track_id: str,
    _: bool = Depends(verify_admin),
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