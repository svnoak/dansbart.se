from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.core.database import get_db
from app.core.config import settings
from app.services.pipeline import PipelineService
from pydantic import BaseModel
from app.services.feedback import FeedbackService
from app.core.models import Track, TrackArtist, ArtistCrawlLog
from app.workers.tasks import (
    analyze_track_task,
    spider_crawl_related_task,
    spider_crawl_search_task,
    spider_backfill_task
)
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
    resource_id: str
    resource_type: str = "playlist"  # playlist, album, or artist

@router.post("/ingest")
def trigger_ingest(
    req: IngestRequest,
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    # Validate resource_type
    valid_types = ["playlist", "album", "artist"]
    if req.resource_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid resource_type. Must be one of: {', '.join(valid_types)}")

    pipeline = PipelineService(db)
    return pipeline.ingest_and_process(req.resource_id, req.resource_type)

@router.get("/tracks")
def get_all_tracks_admin(
    search: str = Query(None),
    status: str = Query(None, description="Filter by status: PENDING, PROCESSING, DONE, FAILED"),
    flagged: bool = Query(None, description="Filter by flagged status"),
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

    if flagged is not None:
        query = query.filter(Track.is_flagged == flagged)
    
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
            "created_at": track.created_at.isoformat() if track.created_at else None,
            "is_flagged": track.is_flagged,
            "flagged_at": track.flagged_at.isoformat() if track.flagged_at else None,
            "flag_reason": track.flag_reason
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


# ===== DISCOVERY SPIDER ENDPOINTS =====

class SpiderRequest(BaseModel):
    max_discoveries: int = 10
    mode: str = "backfill"  # "backfill" (recommended) or "search"
    discover_from_albums: bool = True  # For backfill mode: also discover artists from albums

@router.post("/spider/crawl")
def trigger_spider_crawl(
    req: SpiderRequest = SpiderRequest(),
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Trigger the discovery spider to crawl for Swedish/Nordic folk music (runs async in background).

    Modes:
    - "backfill": Complete discographies for artists already in database (RECOMMENDED)
      - Safer: only expands existing vetted artists
      - Focuses on completing your current collection
      - Optional: Also discovers new artists from compilation/collaborative albums (discover_from_albums=True)
    - "search": Discover new Swedish folk artists via targeted search queries
      - Uses Swedish-specific keywords (spelmanslag, svensk folkmusik, etc.)
      - More likely to find authentic Swedish/Nordic folk

    The spider will:
    1. Find Swedish/Nordic folk artists using the selected mode
    2. Apply strict genre filtering (rejects non-Nordic folk)
    3. Ingest full discographies with automatic genre tagging
    4. Track crawled artists to avoid duplicates

    Returns immediately with a task_id to check status later.
    """

    # Queue the appropriate async task based on mode
    if req.mode == "search":
        task = spider_crawl_search_task.delay(
            max_discoveries=req.max_discoveries
        )
    elif req.mode == "backfill":
        task = spider_backfill_task.delay(
            max_artists=req.max_discoveries,
            discover_from_albums=req.discover_from_albums
        )
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid mode '{req.mode}'. Use 'backfill' or 'search'."
        )

    return {
        "status": "queued",
        "message": f"Spider crawl queued in background ({req.mode} mode)",
        "task_id": task.id,
        "mode": req.mode,
        "parameters": {
            "max_discoveries": req.max_discoveries,
            "discover_from_albums": req.discover_from_albums if req.mode == "backfill" else None
        }
    }

@router.get("/spider/task/{task_id}")
def get_spider_task_status(
    task_id: str,
    _: bool = Depends(verify_admin)
):
    """
    Check the status of a spider crawl task.

    Returns:
    - state: PENDING, STARTED, SUCCESS, FAILURE, RETRY
    - result: Task result if completed (stats dict)
    - info: Additional info about the task state
    """
    from app.core.celery_app import celery_app

    result = celery_app.AsyncResult(task_id)

    response = {
        "task_id": task_id,
        "state": result.state,
        "ready": result.ready(),
        "successful": result.successful() if result.ready() else None
    }

    if result.ready():
        if result.successful():
            response["result"] = result.result
        else:
            response["error"] = str(result.info)
    else:
        # Task is still running or pending
        response["info"] = result.info

    return response


@router.get("/spider/history")
def get_crawl_history(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Get history of spider crawls.
    """

    query = db.query(ArtistCrawlLog)
    total = query.count()

    logs = query.order_by(ArtistCrawlLog.crawled_at.desc()).offset(offset).limit(limit).all()

    results = []
    for log in logs:
        results.append({
            "id": str(log.id),
            "artist_name": log.artist_name,
            "spotify_id": log.spotify_artist_id,
            "tracks_found": log.tracks_found,
            "music_genre": log.music_genre_classification,
            "detected_genres": log.detected_genres,
            "status": log.status,
            "discovery_source": log.discovery_source,
            "crawled_at": log.crawled_at.isoformat()
        })

    return {
        "items": results,
        "total": total,
        "limit": limit,
        "offset": offset
    }

@router.get("/spider/stats")
def get_spider_stats(
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Get overall spider statistics.
    """

    total_crawled = db.query(ArtistCrawlLog).count()
    total_tracks = db.query(ArtistCrawlLog).with_entities(
        func.sum(ArtistCrawlLog.tracks_found)
    ).scalar() or 0

    by_genre = db.query(
        ArtistCrawlLog.music_genre_classification,
        func.count(ArtistCrawlLog.id)
    ).group_by(ArtistCrawlLog.music_genre_classification).all()

    by_status = db.query(
        ArtistCrawlLog.status,
        func.count(ArtistCrawlLog.id)
    ).group_by(ArtistCrawlLog.status).all()

    return {
        "total_artists_crawled": total_crawled,
        "total_tracks_found": int(total_tracks),
        "by_genre": {genre: count for genre, count in by_genre if genre},
        "by_status": {status: count for status, count in by_status}
    }