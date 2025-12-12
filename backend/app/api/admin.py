from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_
from app.core.database import get_db
from app.core.config import settings
from app.services.pipeline import PipelineService
from pydantic import BaseModel
from typing import List
from app.services.feedback import FeedbackService
from app.core.models import (
    Track, PlaybackLink, AnalysisSource, TrackDanceStyle, 
    TrackStyleVote, TrackFeelVote, TrackStructureVersion, 
    ArtistCrawlLog, RejectionLog, TrackArtist, TrackPlayback, 
    UserInteraction, Artist, Album, PendingArtistApproval
)
import redis
from app.core.config import settings


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
        # --- STEP 1: Clear Redis ---
        try:
            r = redis.from_url(settings.REDIS_URL) 
            r.flushdb()
            print("Redis flushed.")
        except Exception as e:
            print(f"Warning: Could not flush Redis: {e}")

        # --- STEP 2: Clear Logs ---
        db.query(ArtistCrawlLog).delete()
        db.query(RejectionLog).delete()
        
        # --- STEP 3: Delete Pending Tracks ---
        pending_tracks = db.query(Track).filter(Track.processing_status == "PENDING").all()
        pending_track_ids = [t.id for t in pending_tracks]
        
        if pending_track_ids:
            print(f"Deleting {len(pending_track_ids)} pending tracks...")
            
            # Manually delete children (Foreign Keys don't always cascade)
            db.query(TrackArtist).filter(TrackArtist.track_id.in_(pending_track_ids)).delete(synchronize_session=False)
            db.query(PlaybackLink).filter(PlaybackLink.track_id.in_(pending_track_ids)).delete(synchronize_session=False)
            db.query(AnalysisSource).filter(AnalysisSource.track_id.in_(pending_track_ids)).delete(synchronize_session=False)
            db.query(TrackDanceStyle).filter(TrackDanceStyle.track_id.in_(pending_track_ids)).delete(synchronize_session=False)
            db.query(TrackStyleVote).filter(TrackStyleVote.track_id.in_(pending_track_ids)).delete(synchronize_session=False)
            db.query(TrackFeelVote).filter(TrackFeelVote.track_id.in_(pending_track_ids)).delete(synchronize_session=False)
            db.query(TrackStructureVersion).filter(TrackStructureVersion.track_id.in_(pending_track_ids)).delete(synchronize_session=False)
            
            # Safeguard against missing tables
            try:
                db.query(TrackPlayback).filter(TrackPlayback.track_id.in_(pending_track_ids)).delete(synchronize_session=False)
            except ProgrammingError:
                db.rollback() 
            
            try:
                db.query(UserInteraction).filter(UserInteraction.track_id.in_(pending_track_ids)).delete(synchronize_session=False)
            except ProgrammingError:
                db.rollback()

            # Delete the tracks
            db.query(Track).filter(Track.id.in_(pending_track_ids)).delete(synchronize_session=False)
            
            # Commit tracking deletion before finding orphans
            db.commit()

        # --- STEP 4: Delete Orphan Albums (Albums with 0 tracks) ---
        # Subquery: Find all album IDs that ARE currently used by a track
        active_album_ids = db.query(Track.album_id).filter(Track.album_id.isnot(None)).distinct()
        
        # Delete albums NOT in that list
        deleted_albums = db.query(Album).filter(Album.id.notin_(active_album_ids)).delete(synchronize_session=False)
        print(f"Deleted {deleted_albums} orphan albums.")
        db.commit() # Commit so artists can be freed up

        # --- STEP 5: Delete Orphan Artists (Artists with 0 tracks) ---
        # Subquery: Find all artist IDs that ARE currently linked to a track
        active_artist_ids = db.query(TrackArtist.artist_id).distinct()
        
        # Delete artists NOT in that list
        # Note: We already deleted orphan albums, so we don't need to worry about album foreign keys
        deleted_artists = db.query(Artist).filter(Artist.id.notin_(active_artist_ids)).delete(synchronize_session=False)
        print(f"Deleted {deleted_artists} orphan artists.")
        
        db.commit()

        return {
            "status": "success", 
            "message": f"Scrub complete. Deleted {len(pending_track_ids)} pending tracks, {deleted_albums} orphan albums, and {deleted_artists} orphan artists."
        }

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

@router.get("/tracks")
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

    # Build base query with necessary joins
    if artist_id:
        # When filtering by artist, we need to join TrackArtist for the filter
        query = db.query(Track).join(Track.artist_links).options(
            joinedload(Track.dance_styles),
            joinedload(Track.artist_links).joinedload(TrackArtist.artist),
            joinedload(Track.album)
        ).filter(TrackArtist.artist_id == artist_id)
    else:
        query = db.query(Track).options(
            joinedload(Track.dance_styles),
            joinedload(Track.artist_links).joinedload(TrackArtist.artist),
            joinedload(Track.album)
        )

    if search:
        query = query.filter(Track.title.ilike(f"%{search}%"))

    if status:
        query = query.filter(Track.processing_status == status)

    if flagged is not None:
        query = query.filter(Track.is_flagged == flagged)

    if album_id:
        query = query.filter(Track.album_id == album_id)
    
    total = query.count()
    tracks = query.order_by(Track.created_at.desc()).offset(offset).limit(limit).all()
    
    results = []
    for track in tracks:
        primary_style = next((s for s in track.dance_styles if s.is_primary), None)
        artist_names = [link.artist.name for link in track.artist_links] if track.artist_links else []

        # Get album info
        album_title = track.album.title if track.album else None
        album_id = str(track.album_id) if track.album_id else None

        results.append({
            "id": str(track.id),
            "title": track.title,
            "artists": artist_names,
            "album_title": album_title,
            "album_id": album_id,
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


@router.get("/artists")
def get_all_artists_admin(
    search: str = Query(None, description="Search artists by name"),
    isolated: str = Query(None, description="Filter by isolation status: 'true' or 'false'"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Admin endpoint to list all artists with track counts and collaboration info.
    """
    query = db.query(Artist)

    if search:
        query = query.filter(Artist.name.ilike(f"%{search}%"))

    # Get all artists first to filter by isolation status
    all_artists = query.order_by(Artist.name).all()

    # Filter by isolation if requested
    if isolated is not None:
        filter_isolated = isolated.lower() == 'true'
        filtered_artists = []
        for artist in all_artists:
            isolation_info = check_artist_isolation(str(artist.id), db)
            if isolation_info["is_isolated"] == filter_isolated:
                filtered_artists.append(artist)
        all_artists = filtered_artists

    total = len(all_artists)
    artists = all_artists[offset:offset + limit]

    results = []
    for artist in artists:
        # Count tracks by status
        total_tracks = db.query(Track).join(TrackArtist).filter(
            TrackArtist.artist_id == artist.id
        ).count()

        done_tracks = db.query(Track).join(TrackArtist).filter(
            TrackArtist.artist_id == artist.id,
            Track.processing_status == "DONE"
        ).count()

        pending_tracks = db.query(Track).join(TrackArtist).filter(
            TrackArtist.artist_id == artist.id,
            Track.processing_status == "PENDING"
        ).count()

        # Get collaboration info
        isolation_info = check_artist_isolation(str(artist.id), db)

        results.append({
            "id": str(artist.id),
            "name": artist.name,
            "spotify_id": artist.spotify_id,
            "image_url": artist.image_url,
            "total_tracks": total_tracks,
            "done_tracks": done_tracks,
            "pending_tracks": pending_tracks,
            "is_isolated": isolation_info["is_isolated"],
            "shared_with_artists": isolation_info["shared_with_artists"],
            "shared_tracks": isolation_info["shared_tracks"],
            "shared_albums": isolation_info["shared_albums"]
        })

    return {
        "items": results,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/albums")
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
    query = db.query(Album).options(joinedload(Album.artist))

    if search:
        query = query.filter(Album.title.ilike(f"%{search}%"))

    if artist_id:
        query = query.filter(Album.artist_id == artist_id)

    total = query.count()
    albums = query.order_by(Album.title).offset(offset).limit(limit).all()

    results = []
    for album in albums:
        # Count tracks by status
        total_tracks = db.query(Track).filter(Track.album_id == album.id).count()

        done_tracks = db.query(Track).filter(
            Track.album_id == album.id,
            Track.processing_status == "DONE"
        ).count()

        pending_tracks = db.query(Track).filter(
            Track.album_id == album.id,
            Track.processing_status == "PENDING"
        ).count()

        # Get all unique artists on this album
        album_artists = db.query(Artist).join(TrackArtist).join(Track).filter(
            Track.album_id == album.id
        ).distinct().all()
        artist_names = [a.name for a in album_artists]

        results.append({
            "id": str(album.id),
            "title": album.title,
            "artist_name": album.artist.name if album.artist else None,
            "artist_id": str(album.artist_id) if album.artist_id else None,
            "all_artists": artist_names,
            "cover_image_url": album.cover_image_url,
            "release_date": album.release_date,
            "total_tracks": total_tracks,
            "done_tracks": done_tracks,
            "pending_tracks": pending_tracks
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

    # Queue the analysis task (lazy import to avoid loading heavy deps)
    from app.workers.tasks import analyze_track_task
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
    Re-runs classification on ALL tracks (useful after updating classification logic).
    """

    # Lazy import to avoid loading worker deps
    from app.services.classification import ClassificationService
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
    # Get artists with pending tracks
    query = db.query(Artist).join(TrackArtist).join(Track).filter(
        Track.processing_status == "PENDING"
    ).distinct()

    if search:
        query = query.filter(Artist.name.ilike(f"%{search}%"))

    total = query.count()
    artists = query.order_by(Artist.name).offset(offset).limit(limit).all()

    results = []
    for artist in artists:
        # Count pending tracks for this artist
        pending_count = db.query(Track).join(TrackArtist).filter(
            TrackArtist.artist_id == artist.id,
            Track.processing_status == "PENDING"
        ).count()

        # Count already analyzed tracks
        analyzed_count = db.query(Track).join(TrackArtist).filter(
            TrackArtist.artist_id == artist.id,
            Track.processing_status == "DONE"
        ).count()

        # Get collaboration info
        isolation_info = check_artist_isolation(str(artist.id), db)

        results.append({
            "id": str(artist.id),
            "name": artist.name,
            "spotify_id": artist.spotify_id,
            "image_url": artist.image_url,
            "pending_tracks": pending_count,
            "analyzed_tracks": analyzed_count,
            "total_tracks": pending_count + analyzed_count,
            "warning": "Analyzed tracks will be kept" if analyzed_count > 0 else None,
            "is_isolated": isolation_info["is_isolated"],
            "shared_with_artists": isolation_info["shared_with_artists"],
            "shared_tracks": isolation_info["shared_tracks"],
            "shared_albums": isolation_info["shared_albums"]
        })

    return {
        "items": results,
        "total": total,
        "limit": limit,
        "offset": offset
    }

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
    # Get albums with pending tracks
    query = db.query(Album).join(Track).filter(
        Track.processing_status == "PENDING"
    ).distinct().options(joinedload(Album.artist))

    if artist_id:
        query = query.filter(Album.artist_id == artist_id)

    total = query.count()
    albums = query.order_by(Album.title).offset(offset).limit(limit).all()

    results = []
    for album in albums:
        # Count pending tracks for this album
        pending_count = db.query(Track).filter(
            Track.album_id == album.id,
            Track.processing_status == "PENDING"
        ).count()

        # Count total tracks (all statuses)
        total_tracks = db.query(Track).filter(
            Track.album_id == album.id
        ).count()

        # Count done tracks
        done_tracks = db.query(Track).filter(
            Track.album_id == album.id,
            Track.processing_status == "DONE"
        ).count()

        # Get all unique artists on this album
        album_artists = db.query(Artist).join(TrackArtist).join(Track).filter(
            Track.album_id == album.id
        ).distinct().all()
        artist_names = [a.name for a in album_artists]

        results.append({
            "id": str(album.id),
            "title": album.title,
            "artist_name": album.artist.name if album.artist else None,
            "artist_id": str(album.artist_id) if album.artist_id else None,
            "all_artists": artist_names,  # All artists featured on this album
            "cover_image_url": album.cover_image_url,
            "release_date": album.release_date,
            "pending_tracks": pending_count,
            "done_tracks": done_tracks,
            "total_tracks": total_tracks
        })

    return {
        "items": results,
        "total": total,
        "limit": limit,
        "offset": offset
    }

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
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    # Get Spotify ID from playback links
    spotify_link = next((l for l in track.playback_links if l.platform == 'spotify'), None)
    spotify_id = None
    if spotify_link:
        # Extract Spotify track ID from URL
        # Format: spotify:track:ID or https://open.spotify.com/track/ID
        link = spotify_link.deep_link
        if link.startswith('spotify:track:'):
            spotify_id = link.split(':')[-1]
        elif '/track/' in link:
            spotify_id = link.split('/track/')[-1].split('?')[0]

    track_title = track.title
    artist_name = track.primary_artist.name if track.primary_artist else None

    # DRY RUN: Just preview what would happen
    if req.dry_run:
        return {
            "status": "dry_run",
            "message": f"DRY RUN: Would reject track '{track_title}'",
            "preview": {
                "track_id": str(track.id),
                "track_title": track_title,
                "artist": artist_name,
                "album": track.album.title if track.album else None,
                "status": track.processing_status,
                "would_blocklist": spotify_id is not None,
                "spotify_id": spotify_id
            }
        }

    # Add to rejection log if we have a Spotify ID
    if spotify_id:
        existing_rejection = db.query(RejectionLog).filter(
            RejectionLog.spotify_id == spotify_id,
            RejectionLog.entity_type == 'track'
        ).first()

        if not existing_rejection:
            rejection = RejectionLog(
                entity_type='track',
                spotify_id=spotify_id,
                entity_name=track_title,
                reason=req.reason,
                additional_data={'artist': artist_name}
            )
            db.add(rejection)

    # Delete the track (cascade will handle related records)
    db.delete(track)
    db.commit()

    return {
        "status": "success",
        "message": f"Track '{track_title}' has been rejected and deleted",
        "blocklisted": spotify_id is not None
    }

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
    artist = db.query(Artist).filter(Artist.id == artist_id).first()
    if not artist:
        raise HTTPException(status_code=404, detail="Artist not found")

    artist_name = artist.name
    spotify_id = artist.spotify_id

    # Check artist isolation status for smart rejection
    isolation_info = check_artist_isolation(artist_id, db)

    # Get pending tracks that would be deleted
    pending_tracks = db.query(Track).join(TrackArtist).filter(
        TrackArtist.artist_id == artist_id,
        Track.processing_status == "PENDING"
    ).all()

    # Get analyzed tracks that would be kept
    analyzed_tracks = db.query(Track).join(TrackArtist).filter(
        TrackArtist.artist_id == artist_id,
        Track.processing_status == "DONE"
    ).all()

    # Count remaining tracks (analyzed + processing, etc.)
    remaining_tracks_count = db.query(Track).join(TrackArtist).filter(
        TrackArtist.artist_id == artist_id,
        Track.processing_status != "PENDING"
    ).count()

    # Get albums that would be affected
    albums_with_pending = db.query(Album).join(Track).filter(
        Track.album_id.isnot(None),
        Album.artist_id == artist_id
    ).distinct().all()

    albums_info = []
    for album in albums_with_pending:
        pending_in_album = db.query(Track).filter(
            Track.album_id == album.id,
            Track.processing_status == "PENDING"
        ).count()
        total_in_album = db.query(Track).filter(
            Track.album_id == album.id
        ).count()

        albums_info.append({
            "title": album.title,
            "pending_tracks": pending_in_album,
            "total_tracks": total_in_album,
            "would_be_deleted": total_in_album == pending_in_album
        })

    # DRY RUN: Just preview what would happen
    if req.dry_run:
        return {
            "status": "dry_run",
            "message": f"DRY RUN: Would reject artist '{artist_name}'",
            "preview": {
                "artist_name": artist_name,
                "spotify_id": spotify_id,
                "would_delete_pending_tracks": len(pending_tracks),
                "would_keep_analyzed_tracks": len(analyzed_tracks),
                "would_delete_artist": remaining_tracks_count == 0,
                "would_blocklist": spotify_id is not None,
                "affected_albums": albums_info,
                "isolation_info": isolation_info,  # Smart rejection info
                "sample_pending_tracks": [
                    {
                        "title": t.title,
                        "album": t.album.title if t.album else None
                    } for t in pending_tracks[:10]  # Show first 10 as samples
                ],
                "sample_kept_tracks": [
                    {
                        "title": t.title,
                        "album": t.album.title if t.album else None
                    } for t in analyzed_tracks[:10]  # Show first 10 as samples
                ] if analyzed_tracks else []
            }
        }

    # Add to rejection log if we have a Spotify ID
    if spotify_id:
        existing_rejection = db.query(RejectionLog).filter(
            RejectionLog.spotify_id == spotify_id,
            RejectionLog.entity_type == 'artist'
        ).first()

        if not existing_rejection:
            rejection = RejectionLog(
                entity_type='artist',
                spotify_id=spotify_id,
                entity_name=artist_name,
                reason=req.reason,
                additional_data={}
            )
            db.add(rejection)

    # Delete all pending tracks for this artist (with related records)
    for track in pending_tracks:
        # Delete related playback links first (not cascaded in model)
        db.query(PlaybackLink).filter(PlaybackLink.track_id == track.id).delete()
        # Now delete the track
        db.delete(track)

    # Check if artist has any remaining tracks
    if remaining_tracks_count == 0:
        db.delete(artist)

    db.commit()

    return {
        "status": "success",
        "message": f"Artist '{artist_name}' rejected. Deleted {len(pending_tracks)} pending tracks.",
        "artist_deleted": remaining_tracks_count == 0,
        "kept_tracks": len(analyzed_tracks),
        "blocklisted": spotify_id is not None,
        "isolation_info": isolation_info  # Include for frontend warning
    }

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
    album = db.query(Album).options(joinedload(Album.artist)).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    album_title = album.title
    album_artist = album.artist.name if album.artist else "Unknown"

    # Get all unique artists on this album
    album_artists = db.query(Artist).join(TrackArtist).join(Track).filter(
        Track.album_id == album_id
    ).distinct().all()
    artist_names = [a.name for a in album_artists]

    # Get pending tracks that would be deleted
    pending_tracks = db.query(Track).filter(
        Track.album_id == album_id,
        Track.processing_status == "PENDING"
    ).all()

    # Get other tracks that would be kept
    kept_tracks = db.query(Track).filter(
        Track.album_id == album_id,
        Track.processing_status != "PENDING"
    ).all()

    remaining_tracks_count = len(kept_tracks)

    # DRY RUN: Just preview what would happen
    if req.dry_run:
        return {
            "status": "dry_run",
            "message": f"DRY RUN: Would reject album '{album_title}'",
            "preview": {
                "album_title": album_title,
                "album_artist": album_artist,
                "all_artists_on_album": artist_names,
                "would_delete_pending_tracks": len(pending_tracks),
                "would_keep_tracks": len(kept_tracks),
                "would_delete_album": remaining_tracks_count == 0,
                "sample_pending_tracks": [
                    {
                        "title": t.title,
                        "artists": [link.artist.name for link in t.artist_links]
                    } for t in pending_tracks[:10]  # Show first 10 as samples
                ],
                "sample_kept_tracks": [
                    {
                        "title": t.title,
                        "status": t.processing_status,
                        "artists": [link.artist.name for link in t.artist_links]
                    } for t in kept_tracks[:10]  # Show first 10 as samples
                ] if kept_tracks else []
            }
        }

    # Delete all pending tracks for this album (with related records)
    for track in pending_tracks:
        # Delete related playback links first (not cascaded in model)
        db.query(PlaybackLink).filter(PlaybackLink.track_id == track.id).delete()
        # Now delete the track
        db.delete(track)

    # If no remaining tracks, delete the album too
    if remaining_tracks_count == 0:
        db.delete(album)

    db.commit()

    return {
        "status": "success",
        "message": f"Album '{album_title}' rejected. Deleted {len(pending_tracks)} pending tracks.",
        "album_deleted": remaining_tracks_count == 0,
        "kept_tracks": len(kept_tracks),
        "blocklisted": False  # Album blocklisting not implemented yet
    }

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
    query = db.query(RejectionLog)

    if entity_type:
        query = query.filter(RejectionLog.entity_type == entity_type)

    total = query.count()
    rejections = query.order_by(RejectionLog.rejected_at.desc()).offset(offset).limit(limit).all()

    results = []
    for rejection in rejections:
        results.append({
            "id": str(rejection.id),
            "entity_type": rejection.entity_type,
            "entity_name": rejection.entity_name,
            "spotify_id": rejection.spotify_id,
            "reason": rejection.reason,
            "rejected_at": rejection.rejected_at.isoformat(),
            "additional_data": rejection.additional_data
        })

    return {
        "items": results,
        "total": total,
        "limit": limit,
        "offset": offset
    }

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
    rejection = db.query(RejectionLog).filter(RejectionLog.id == rejection_id).first()
    if not rejection:
        raise HTTPException(status_code=404, detail="Rejection not found")

    entity_name = rejection.entity_name
    db.delete(rejection)
    db.commit()

    return {
        "status": "success",
        "message": f"'{entity_name}' removed from blocklist"
    }


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
    query = db.query(PendingArtistApproval).filter(
        PendingArtistApproval.status == 'pending'
    )

    total = query.count()
    artists = query.order_by(PendingArtistApproval.discovered_at.desc()).offset(offset).limit(limit).all()

    results = []
    for artist in artists:
        results.append({
            "id": str(artist.id),
            "spotify_id": artist.spotify_id,
            "name": artist.name,
            "image_url": artist.image_url,
            "detected_genres": artist.detected_genres,
            "music_genre": artist.music_genre_classification,
            "genre_confidence": artist.genre_confidence,
            "discovered_at": artist.discovered_at.isoformat(),
            "discovery_source": artist.discovery_source
        })

    return {
        "items": results,
        "total": total,
        "limit": limit,
        "offset": offset
    }

@router.post("/pending-artists/{artist_id}/approve")
def approve_pending_artist(
    artist_id: str,
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Approve a pending artist and ingest their discography.
    """
    from datetime import datetime
    from app.workers.ingestion.spotify import SpotifyIngestor
    from app.workers.tasks import analyze_track_task
    from app.services.genre_classifier import GenreClassifier

    artist = db.query(PendingArtistApproval).filter(PendingArtistApproval.id == artist_id).first()
    if not artist:
        raise HTTPException(status_code=404, detail="Pending artist not found")

    if artist.status != 'pending':
        raise HTTPException(status_code=400, detail=f"Artist already {artist.status}")

    # Mark as approved
    artist.status = 'approved'
    artist.reviewed_at = datetime.utcnow()

    try:
        # Ingest the artist
        ingestor = SpotifyIngestor(db)
        track_ids = ingestor.ingest_artist_albums(artist.spotify_id)

        # Queue tracks for analysis
        if track_ids:
            for tid in track_ids:
                analyze_track_task.delay(tid)

        # Log the crawl
        crawl_log = ArtistCrawlLog(
            spotify_artist_id=artist.spotify_id,
            artist_name=artist.name,
            tracks_found=len(track_ids) if isinstance(track_ids, list) else track_ids,
            status='success',
            detected_genres=artist.detected_genres or [],
            music_genre_classification=artist.music_genre_classification,
            discovery_source=f'manual_approval_from_{artist.discovery_source}'
        )
        db.add(crawl_log)

        # Update track genres
        genre_classifier = GenreClassifier(db)
        tracks_updated = genre_classifier.classify_all_tracks_for_artist(artist.spotify_id)

        db.commit()

        return {
            "status": "success",
            "message": f"Approved and ingested {artist.name}",
            "tracks_found": len(track_ids) if isinstance(track_ids, list) else track_ids,
            "tracks_tagged": tracks_updated
        }

    except Exception as e:
        db.rollback()
        artist.status = 'pending'  # Revert status on error
        db.commit()
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
    from datetime import datetime

    artist = db.query(PendingArtistApproval).filter(PendingArtistApproval.id == artist_id).first()
    if not artist:
        raise HTTPException(status_code=404, detail="Pending artist not found")

    # Mark as rejected
    artist.status = 'rejected'
    artist.reviewed_at = datetime.utcnow()

    # Add to rejection blocklist
    rejection = RejectionLog(
        entity_type='artist',
        spotify_id=artist.spotify_id,
        entity_name=artist.name,
        reason=req.reason or 'Not relevant',
        additional_data={
            'genres': artist.detected_genres,
            'classification': artist.music_genre_classification,
            'confidence': artist.genre_confidence
        }
    )
    db.add(rejection)
    db.commit()

    return {
        "status": "success",
        "message": f"Rejected {artist.name} and added to blocklist"
    }


# ===== SMART REJECTION HELPERS =====

def check_artist_isolation(artist_id: str, db: Session) -> dict:
    """
    Check if an artist is isolated (only appears alone) or shares tracks/albums with other artists.
    Returns a dict with:
    - is_isolated: bool
    - shared_with_artists: list of artist names they collaborate with
    - shared_tracks: count
    - shared_albums: count
    """
    # Get all tracks by this artist
    artist_tracks = db.query(Track).join(TrackArtist).filter(
        TrackArtist.artist_id == artist_id
    ).all()

    shared_with = set()
    shared_track_count = 0
    shared_album_ids = set()

    for track in artist_tracks:
        # Check if track has multiple artists
        other_artists = [
            link.artist for link in track.artist_links
            if str(link.artist_id) != artist_id
        ]

        if other_artists:
            shared_track_count += 1
            for other_artist in other_artists:
                shared_with.add(other_artist.name)

            if track.album_id:
                shared_album_ids.add(track.album_id)

    return {
        "is_isolated": len(shared_with) == 0,
        "shared_with_artists": list(shared_with),
        "shared_tracks": shared_track_count,
        "shared_albums": len(shared_album_ids),
        "total_tracks": len(artist_tracks)
    }

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
    artist = db.query(Artist).filter(Artist.id == artist_id).first()
    if not artist:
        raise HTTPException(status_code=404, detail="Artist not found")

    isolation_info = check_artist_isolation(artist_id, db)

    return {
        "artist_id": artist_id,
        "artist_name": artist.name,
        **isolation_info,
        "recommendation": "safe_to_reject" if isolation_info["is_isolated"] else "review_shared_content"
    }

class BulkRejectRequest(BaseModel):
    ids: list[str]
    reason: str = "Bulk rejection"

@router.post("/artists/bulk-reject")
def bulk_reject_artists(
    req: BulkRejectRequest,
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
        
    """
    Reject multiple artists at once.
    """
    success_count = 0
    errors = 0
    
    # 1. Fetch all artists
    artists = db.query(Artist).filter(Artist.id.in_(req.ids)).all()
    
    for artist in artists:
        try:
            # Logic similar to single reject_artist
            spotify_id = artist.spotify_id
            artist_name = artist.name
            
            # Add to blocklist
            if spotify_id:
                exists = db.query(RejectionLog).filter(
                    RejectionLog.spotify_id == spotify_id,
                    RejectionLog.entity_type == 'artist'
                ).first()
                
                if not exists:
                    rejection = RejectionLog(
                        entity_type='artist',
                        spotify_id=spotify_id,
                        entity_name=artist_name,
                        reason=req.reason
                    )
                    db.add(rejection)

            # Delete pending tracks
            pending_tracks = db.query(Track).join(TrackArtist).filter(
                TrackArtist.artist_id == artist.id,
                Track.processing_status == "PENDING"
            ).all()

            for track in pending_tracks:
                db.query(PlaybackLink).filter(PlaybackLink.track_id == track.id).delete()
                db.delete(track)

            # Delete artist if no tracks left (simplified check for bulk speed)
            remaining_tracks = db.query(Track).join(TrackArtist).filter(
                TrackArtist.artist_id == artist.id,
                Track.processing_status != "PENDING"
            ).count()
            
            if remaining_tracks == 0:
                db.delete(artist)
            
            success_count += 1
            
        except Exception as e:
            print(f"Error rejecting {artist.id}: {e}")
            errors += 1

    db.commit()
    
    return {
        "status": "success",
        "message": f"Rejected {success_count} artists. {errors} failed."
    }


@router.post("/artists/{artist_id}/approve")
def approve_artist(
    artist_id: str,
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Approve an artist by queuing all their pending tracks for analysis.
    """
    artist = db.query(Artist).filter(Artist.id == artist_id).first()
    if not artist:
        raise HTTPException(status_code=404, detail="Artist not found")

    # Get all pending tracks for this artist
    pending_tracks = db.query(Track).join(TrackArtist).filter(
        TrackArtist.artist_id == artist_id,
        Track.processing_status == "PENDING"
    ).all()

    if not pending_tracks:
        return {
            "status": "success",
            "message": f"No pending tracks found for {artist.name}",
            "tracks_queued": 0
        }

    # Queue all tracks for analysis
    from app.workers.tasks import analyze_track_task
    for track in pending_tracks:
        analyze_track_task.delay(str(track.id))

    return {
        "status": "success",
        "message": f"Queued {len(pending_tracks)} tracks for analysis for {artist.name}",
        "tracks_queued": len(pending_tracks)
    }


class BulkApproveRequest(BaseModel):
    ids: List[str]


@router.post("/artists/bulk-approve")
def bulk_approve_artists(
    req: BulkApproveRequest,
    _: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """
    Approve multiple artists at once by queuing all their pending tracks for analysis.
    """
    success_count = 0
    total_tracks_queued = 0
    errors = 0

    # Fetch all artists
    artists = db.query(Artist).filter(Artist.id.in_(req.ids)).all()

    from app.workers.tasks import analyze_track_task

    for artist in artists:
        try:
            # Get all pending tracks for this artist
            pending_tracks = db.query(Track).join(TrackArtist).filter(
                TrackArtist.artist_id == artist.id,
                Track.processing_status == "PENDING"
            ).all()

            # Queue all tracks for analysis
            for track in pending_tracks:
                analyze_track_task.delay(str(track.id))

            total_tracks_queued += len(pending_tracks)
            success_count += 1

        except Exception as e:
            print(f"Error approving {artist.id}: {e}")
            errors += 1

    db.commit()

    return {
        "status": "success",
        "message": f"Approved {success_count} artists, queued {total_tracks_queued} tracks for analysis. {errors} failed."
    }


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
    # Check if already blocked
    exists = db.query(RejectionLog).filter(
        RejectionLog.spotify_id == req.spotify_id,
        RejectionLog.entity_type == 'artist'
    ).first()
    
    if exists:
        return {"message": "Already blocked"}
        
    rejection = RejectionLog(
        entity_type='artist',
        spotify_id=req.spotify_id,
        entity_name=req.artist_name,
        reason=req.reason
    )
    db.add(rejection)
    db.commit()
    
    return {"status": "success", "message": f"Added {req.artist_name} to blocklist"}