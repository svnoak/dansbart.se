from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.core.database import get_db
from app.core.config import settings
from app.services.pipeline import PipelineService
from app.services.feedback import FeedbackService
from app.services.admin_tracks import AdminTrackService
from app.services.admin_artists import AdminArtistService
from app.services.admin_albums import AdminAlbumService
from app.services.admin_rejections import AdminRejectionService
from app.services.admin_data_cleaning import AdminDataCleaningService
from app.services.admin_pending_approvals import AdminPendingApprovalService
from pydantic import BaseModel
from typing import List
from app.core.models import (
    Track, ArtistCrawlLog, TrackArtist, Artist
)
from app.api.admin.admin_schemas import AlbumOutAdmin, AdminArtistListItem, AdminTrackListItem
from app.api.schemas import Page

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

@router.post("/danger/reset-crawl-data")
def reset_crawl_data(
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    DANGER: Nuclear option.
    1. Flushes Redis cache.
    2. Deletes ALL ArtistCrawlLogs & RejectionLogs.
    3. Deletes ALL tracks with status 'PENDING' (and children).
    4. Deletes Orphan Albums (0 tracks).
    5. Deletes Orphan Artists (0 tracks).
    """
    try:
        service = AdminDataCleaningService(db)
        result = service.reset_crawl_data()
        return result
    except Exception as e:
        db.rollback()
        print(f"Error resetting data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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

@router.get("/tracks", response_model=Page[AdminTrackListItem])
def get_all_tracks_admin(
    search: str = Query(None),
    status: str = Query(None, description="Filter by status: PENDING, PROCESSING, DONE, FAILED"),
    flagged: bool = Query(None, description="Filter by flagged status"),
    artist_id: str = Query(None, description="Filter by artist ID"),
    album_id: str = Query(None, description="Filter by album ID"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Admin endpoint to list all tracks with their status.
    """
    service = AdminTrackService(db)
    return service.get_tracks_paginated(search, status, flagged, artist_id, album_id, limit, offset)


@router.get("/artists", response_model=Page[AdminArtistListItem])
def get_all_artists_admin(
    search: str = Query(None, description="Search artists by name"),
    isolated: str = Query(None, description="Filter by isolation status: 'true' or 'false'"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    service = AdminArtistService(db)
    return service.get_artists_paginated(search, isolated, limit, offset)


@router.get("/albums", response_model=Page[AlbumOutAdmin])
def get_all_albums_admin(
    search: str = Query(None, description="Search albums by title"),
    artist_id: str = Query(None, description="Filter by artist_id"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Admin endpoint to list all albums with track counts.
    """
    service = AdminAlbumService(db)
    return service.get_albums_paginated(search, artist_id, limit, offset)


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

    # Queue the analysis task (lazy import to avoid loading heavy deps)
    from app.workers.tasks import analyze_track_task
    analyze_track_task.delay(track_id)

    return {
        "status": "success",
        "message": f"Re-analysis queued for: {track.title}"
    }


class BulkReanalyzeRequest(BaseModel):
    status_filter: str = "PENDING"  # PENDING, PROCESSING, FAILED, or "all"
    limit: int = 100  # Max tracks to re-analyze at once


@router.post("/tracks/bulk-reanalyze")
def trigger_bulk_reanalysis(
    req: BulkReanalyzeRequest = BulkReanalyzeRequest(),
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Bulk re-analyze tracks based on their status.

    Use cases:
    - status_filter="everything": Force re-analyze ALL tracks (including DONE) [NEW]
    - status_filter="all": Re-analyze all non-DONE tracks (recovery)
    - status_filter="PENDING": Re-queue tracks that were never processed
    - status_filter="PROCESSING": Recover orphaned tracks stuck in processing
    - status_filter="FAILED": Retry all failed tracks

    Args:
        status_filter: Which status to filter by
        limit: Maximum number of tracks to re-analyze (max: 5000)
    """
    # Increased limit cap for admin convenience
    if req.limit > 5000:
        req.limit = 5000

    # Build query based on status filter
    query = db.query(Track)
    
    if req.status_filter == "everything":
        # No filter - fetch everything including DONE tracks
        pass
    elif req.status_filter == "all":
        # Recovery mode - fetch everything NOT done
        query = query.filter(Track.processing_status != "DONE")
    elif req.status_filter in ["PENDING", "PROCESSING", "FAILED"]:
        query = query.filter(Track.processing_status == req.status_filter)
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status_filter. Use: everything, all, PENDING, PROCESSING, FAILED"
        )

    tracks = query.limit(req.limit).all()

    if not tracks:
        return {
            "status": "success",
            "message": f"No tracks found with status: {req.status_filter}",
            "queued": 0,
            "tracks": []
        }

    # Reset all to PENDING and queue
    from app.workers.tasks import analyze_track_task

    queued_tracks = []
    for track in tracks:
        track.processing_status = "PENDING"
        queued_tracks.append({
            "id": str(track.id),
            "title": track.title
        })

    db.commit()

    # Queue all tracks for analysis
    for track_info in queued_tracks:
        analyze_track_task.delay(track_info["id"])

    return {
        "status": "success",
        "message": f"Queued {len(queued_tracks)} tracks for re-analysis",
        "queued": len(queued_tracks),
        "tracks": queued_tracks
    }


@router.post("/maintenance/cleanup-orphaned")
def trigger_orphaned_cleanup(
    stuck_threshold_minutes: int = Query(30, ge=5, le=1440),
    _: bool = Depends(verify_admin)
):
    """
    Manually trigger cleanup of orphaned tracks.

    Finds tracks stuck in PROCESSING status for longer than the threshold
    and resets them to PENDING, then re-queues them for analysis.

    This runs automatically every 15 minutes, but you can trigger it manually.

    Args:
        stuck_threshold_minutes: How long a track can be in PROCESSING before
                                 it's considered orphaned (default: 30, min: 5, max: 1440)

    Returns:
        Task ID to check status
    """
    from app.workers.tasks import cleanup_orphaned_tracks_task

    task = cleanup_orphaned_tracks_task.delay(stuck_threshold_minutes)

    return {
        "status": "queued",
        "message": f"Cleanup task queued (threshold: {stuck_threshold_minutes} minutes)",
        "task_id": task.id
    }


@router.get("/maintenance/isrc-stats")
def get_isrc_stats(
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Get statistics about ISRCs in the database.
    Shows how many tracks have real ISRCs, fallback ISRCs, or no ISRCs.
    """
    from app.services.isrc_backfill import ISRCBackfillService

    service = ISRCBackfillService(db)
    return service.get_backfill_stats()


@router.post("/maintenance/backfill-isrcs")
def backfill_isrcs(
    limit: int = Query(None, description="Limit number of tracks to process (None for all)"),
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Backfill missing ISRCs for tracks that have Spotify links.

    This fetches full track details from Spotify to get ISRCs for tracks that:
    - Have no ISRC (NULL)
    - Have fallback ISRCs (generated hashes)

    Args:
        limit: Maximum number of tracks to process (None for all)

    Returns:
        Statistics about the backfill operation
    """
    from app.services.isrc_backfill import ISRCBackfillService

    service = ISRCBackfillService(db)
    result = service.backfill_isrcs(limit=limit)

    return result


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
    
    # Check if we have analysis data (support both old and new formats)
    source = next((s for s in track.analysis_sources
                  if s.source_type in ['neckenml_analyzer', 'hybrid_ml_v2']), None)
    if not source:
        raise HTTPException(status_code=400, detail="No analysis data found. Run full re-analysis instead.")

    # Run classification (lazy import to avoid loading worker deps)
    from app.services.classification import ClassificationService
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
    Queues a background task to re-run classification on ALL tracks.
    This is better than running synchronously since it can take a long time on large libraries.
    """

    # Queue the reclassification as a background task
    from app.workers.tasks_light import reclassify_library_task
    task = reclassify_library_task.delay()

    return {
        "status": "queued",
        "message": "Library reclassification task queued",
        "task_id": task.id
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

    # Queue the appropriate async task based on mode (lazy import)
    from app.workers.tasks import spider_crawl_search_task, spider_backfill_task

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


# ===== REJECTION / BLOCKLIST ENDPOINTS =====

class RejectRequest(BaseModel):
    reason: str = "Not relevant"
    dry_run: bool = False  # If true, preview what would be deleted without actually deleting
    delete_content: bool = True  # If true, delete content. If false, only block from spider.

@router.get("/pending/artists")
def get_pending_artists(
    search: str = Query(None, description="Search artists by name"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Get all artists that have tracks pending analysis.
    Useful for reviewing artists before they get fully analyzed.
    """
    service = AdminArtistService(db)
    return service.get_pending_artists(search, limit, offset)

@router.get("/pending/albums")
def get_pending_albums(
    artist_id: str = Query(None, description="Filter by artist_id"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Get all albums that have tracks pending analysis.
    Optionally filter by artist_id to see a specific artist's albums.
    """
    service = AdminAlbumService(db)
    return service.get_pending_albums(artist_id, limit, offset)

@router.get("/tracks/duplicates")
def get_duplicate_tracks(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Get tracks that share the same ISRC (duplicates).
    Returns groups of tracks with the same ISRC for easy duplicate management.
    """
    service = AdminTrackService(db)
    return service.get_duplicate_tracks(limit, offset)

@router.delete("/tracks/{track_id}")
def delete_track(
    track_id: str,
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Delete a track without adding it to the blocklist.
    Use this for removing duplicate tracks.
    """
    service = AdminTrackService(db)
    try:
        deleted = service.delete_tracks_with_cascade([track_id])
        db.commit()
        return {"message": f"Track deleted successfully", "deleted": deleted}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tracks/{track_id}/reject")
def reject_track(
    track_id: str,
    req: RejectRequest = RejectRequest(),
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Reject a track and delete it from the database.
    Also adds the track's Spotify ID to the rejection blocklist.

    Set dry_run=true to preview what would be deleted without actually deleting.
    """
    service = AdminTrackService(db)
    try:
        result = service.reject_track(track_id, req.reason, req.dry_run)
        if not req.dry_run:
            db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/artists/{artist_id}/reject")
def reject_artist(
    artist_id: str,
    req: RejectRequest = RejectRequest(),
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Reject an artist and delete all their pending tracks.
    Adds the artist's Spotify ID to the rejection blocklist to prevent re-ingestion.
    Tracks that are already analyzed (DONE) are kept.

    Set dry_run=true to preview what would be deleted without actually deleting.
    """
    service = AdminArtistService(db)
    try:
        result = service.reject_artist(artist_id, req.reason, req.dry_run, req.delete_content)
        if not req.dry_run:
            db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/albums/{album_id}/reject")
def reject_album(
    album_id: str,
    req: RejectRequest = RejectRequest(),
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Reject an album and delete all its pending tracks.
    Note: Albums don't always have Spotify IDs, so blocklisting may not work for all albums.

    Set dry_run=true to preview what would be deleted without actually deleting.
    """
    service = AdminAlbumService(db)
    try:
        result = service.reject_album(album_id, req.reason, req.dry_run)
        if not req.dry_run:
            db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/rejections")
def get_rejection_list(
    entity_type: str = Query(None, description="Filter by entity_type: track, artist, album"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Get the list of rejected items (blocklist).
    """
    service = AdminRejectionService(db)
    return service.get_rejections_paginated(entity_type, limit, offset)

@router.delete("/rejections/{rejection_id}")
def remove_from_blocklist(
    rejection_id: str,
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Remove an item from the rejection blocklist.
    Useful if you want to allow re-ingestion of a previously rejected item.
    """
    service = AdminRejectionService(db)
    try:
        entity_name = service.remove_from_blocklist(rejection_id)
        db.commit()
        return {
            "status": "success",
            "message": f"'{entity_name}' removed from blocklist"
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ===== PENDING ARTIST APPROVAL ENDPOINTS =====

@router.get("/pending-artists")
def get_pending_artists_for_approval(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Get artists discovered by the spider that are pending manual approval.
    These are artists with low confidence genre classification.
    """
    service = AdminPendingApprovalService(db)
    return service.get_pending_artists_for_approval(limit, offset)

@router.post("/pending-artists/{artist_id}/approve")
def approve_pending_artist(
    artist_id: str,
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Approve a pending artist and ingest their discography.
    """
    service = AdminPendingApprovalService(db)
    try:
        result = service.approve_pending_artist(artist_id)
        db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=404 if "not found" in str(e).lower() else 400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to ingest artist: {str(e)}")

@router.post("/pending-artists/{artist_id}/reject")
def reject_pending_artist(
    artist_id: str,
    req: RejectRequest = RejectRequest(),
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Reject a pending artist and add them to the blocklist.
    """
    service = AdminPendingApprovalService(db)
    try:
        result = service.reject_pending_artist(artist_id, req.reason)
        db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ===== SMART REJECTION HELPERS =====

@router.get("/artists/{artist_id}/isolation-check")
def get_artist_isolation_status(
    artist_id: str,
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Check if an artist is isolated or shares content with other artists in the database.
    Useful for smart rejection decisions.
    """
    service = AdminArtistService(db)
    artist = db.query(Artist).filter(Artist.id == artist_id).first()
    if not artist:
        raise HTTPException(status_code=404, detail="Artist not found")

    isolation_info = service.get_artist_isolation_info(artist_id)

    return {
        "artist_id": artist_id,
        "artist_name": artist.name,
        **isolation_info,
        "recommendation": "safe_to_reject" if isolation_info["is_isolated"] else "review_shared_content"
    }

class BulkRejectRequest(BaseModel):
    ids: list[str]
    reason: str = "Bulk rejection"
    delete_content: bool = True  # If true, delete content. If false, only block from spider.

@router.post("/artists/bulk-reject")
def bulk_reject_artists(
    req: BulkRejectRequest,
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Reject multiple artists at once.
    """
    service = AdminArtistService(db)
    try:
        result = service.bulk_reject_artists(req.ids, req.reason, req.delete_content)
        db.commit()
        return result
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/artists/{artist_id}/approve")
def approve_artist(
    artist_id: str,
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Approve an artist by queuing all their pending tracks for analysis.
    """
    service = AdminArtistService(db)
    try:
        result = service.approve_artist(artist_id)
        db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


class BulkApproveRequest(BaseModel):
    ids: List[str]

@router.post("/artists/bulk-approve")
def bulk_approve_artists(
    req: BulkApproveRequest,
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Approve multiple artists:
    1. Marks them as verified (so they leave the isolation list).
    2. Queues any pending tracks for analysis.
    """
    service = AdminArtistService(db)
    try:
        result = service.bulk_approve_artists(req.ids)
        db.commit()
        return result
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/artists/{artist_id}/collaboration-network")
def get_collaboration_network(
    artist_id: str,
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Get detailed collaboration network for an artist.
    Returns all collaborating artists and albums for the rejection workflow.
    """
    service = AdminArtistService(db)
    try:
        result = service.get_collaboration_network(artist_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class RejectNetworkRequest(BaseModel):
    artist_ids: List[str]
    album_ids: List[str]
    reason: str = "Network rejection"

@router.post("/reject-network")
def reject_network(
    req: RejectNetworkRequest,
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Reject a network of artists and albums together.
    Used by the enhanced rejection modal.
    """
    service = AdminArtistService(db)
    try:
        result = service.reject_network(req.artist_ids, req.album_ids, req.reason)
        db.commit()
        return result
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


class BlockSpotifyRequest(BaseModel):
    spotify_id: str
    artist_name: str
    reason: str = "Blocked from spider"

@router.post("/blocklist/add")
def add_to_blocklist(
    req: BlockSpotifyRequest,
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    service = AdminRejectionService(db)

    # Check if already blocked
    if service.check_if_blocked(req.spotify_id, 'artist'):
        return {"message": "Already blocked"}

    try:
        service.add_to_blocklist('artist', req.spotify_id, req.artist_name, req.reason)
        db.commit()
        return {"status": "success", "message": f"Added {req.artist_name} to blocklist"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ===== STYLE KEYWORDS ENDPOINTS =====

class StyleKeywordRequest(BaseModel):
    keyword: str
    main_style: str
    sub_style: str | None = None

class StyleKeywordUpdateRequest(BaseModel):
    keyword: str | None = None
    main_style: str | None = None
    sub_style: str | None = None
    is_active: bool | None = None


@router.get("/style-keywords")
def get_style_keywords(
    search: str = Query(None, description="Search keywords"),
    main_style: str = Query(None, description="Filter by main style"),
    is_active: bool = Query(None, description="Filter by active status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Get paginated list of style keywords.
    Used for Admin UI to manage keyword mappings.
    """
    from app.services.admin_style_keywords import AdminStyleKeywordService
    service = AdminStyleKeywordService(db)
    return service.get_keywords_paginated(search, main_style, is_active, limit, offset)


@router.get("/style-keywords/stats")
def get_style_keyword_stats(
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Get keyword statistics (counts by style, unique styles, cache info).
    """
    from app.services.admin_style_keywords import AdminStyleKeywordService
    service = AdminStyleKeywordService(db)
    return service.get_stats()


@router.get("/style-keywords/{keyword_id}")
def get_style_keyword(
    keyword_id: str,
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Get a single style keyword by ID.
    """
    from app.services.admin_style_keywords import AdminStyleKeywordService
    service = AdminStyleKeywordService(db)
    try:
        return service.get_keyword_by_id(keyword_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/style-keywords")
def create_style_keyword(
    req: StyleKeywordRequest,
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Create a new style keyword mapping.
    Automatically invalidates the classifier cache.
    """
    from app.services.admin_style_keywords import AdminStyleKeywordService
    service = AdminStyleKeywordService(db)
    try:
        result = service.create_keyword(req.keyword, req.main_style, req.sub_style)
        return {"status": "success", "keyword": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/style-keywords/{keyword_id}")
def update_style_keyword(
    keyword_id: str,
    req: StyleKeywordUpdateRequest,
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Update an existing style keyword.
    Automatically invalidates the classifier cache.
    """
    from app.services.admin_style_keywords import AdminStyleKeywordService
    service = AdminStyleKeywordService(db)
    try:
        result = service.update_keyword(
            keyword_id,
            keyword=req.keyword,
            main_style=req.main_style,
            sub_style=req.sub_style,
            is_active=req.is_active
        )
        return {"status": "success", "keyword": result}
    except ValueError as e:
        status_code = 400 if "exists" in str(e) else 404
        raise HTTPException(status_code=status_code, detail=str(e))


@router.delete("/style-keywords/{keyword_id}")
def delete_style_keyword(
    keyword_id: str,
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Delete a style keyword.
    Consider using is_active=false instead for audit trail.
    """
    from app.services.admin_style_keywords import AdminStyleKeywordService
    service = AdminStyleKeywordService(db)
    if service.delete_keyword(keyword_id):
        return {"status": "success", "message": "Keyword deleted"}
    raise HTTPException(status_code=404, detail="Keyword not found")


@router.post("/style-keywords/invalidate-cache")
def invalidate_keyword_cache(
    _: bool = Depends(verify_admin)
):
    """
    Manually invalidate the style keywords cache.
    Useful if database was modified directly.
    """
    from app.services.style_keywords_cache import invalidate_cache
    invalidate_cache()
    return {"status": "success", "message": "Cache invalidated"}

