"""
Light Worker Tasks
I/O-bound tasks: Discovery (Spotify), Ingestion, Backfill, Maintenance.
No ML models required.
"""
from datetime import datetime, timedelta, timezone
from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.core.models import Track

@celery_app.task(acks_late=True, time_limit=3600, queue='light')
def spider_crawl_related_task(seed_limit: int = 5, max_discoveries: int = 10):
    """
    DEPRECATED: Use spider_backfill_task instead.

    Related artists crawl tends to drift away from Swedish/Nordic folk.
    This task now redirects to backfill_existing_artists() for better control.

    Args:
        seed_limit: Ignored (kept for backwards compatibility)
        max_discoveries: Used as max_artists for backfill

    Returns:
        dict: Statistics about the crawl
    """
    print(f"⚠️  LIGHT WORKER: spider_crawl_related_task is DEPRECATED")
    print(f"   Redirecting to backfill mode with max_artists={max_discoveries}")

    from app.workers.discovery.spider import DiscoverySpider

    db = SessionLocal()
    try:
        spider = DiscoverySpider(db)
        stats = spider.backfill_existing_artists(max_artists=max_discoveries)

        print(f"✅ LIGHT WORKER: Backfill complete - {stats['artists_crawled']} artists, {stats['tracks_found']} tracks")
        return stats
    except Exception as e:
        db.rollback()
        print(f"❌ LIGHT WORKER: Backfill failed - {e}")
        raise
    finally:
        db.close()


@celery_app.task(acks_late=True, time_limit=3600, queue='light')
def spider_crawl_search_task(max_discoveries: int = 10):
    """
    Background task for crawling via Spotify search.

    Args:
        max_discoveries: Maximum new artists to crawl

    Returns:
        dict: Statistics about the crawl
    """
    print(f"🔍 LIGHT WORKER: Starting search-based crawl (max={max_discoveries})")

    from app.workers.discovery.spider import DiscoverySpider

    db = SessionLocal()
    try:
        spider = DiscoverySpider(db)
        stats = spider.crawl_by_search(max_discoveries=max_discoveries)

        print(f"✅ LIGHT WORKER: Search crawl complete - {stats['artists_crawled']} artists, {stats['tracks_found']} tracks")
        return stats
    except Exception as e:
        db.rollback()
        print(f"❌ LIGHT WORKER: Search crawl failed - {e}")
        raise
    finally:
        db.close()


@celery_app.task(acks_late=True, time_limit=3600, queue='light')
def spider_backfill_task(max_artists: int = 20, discover_from_albums: bool = True):
    """
    Background task for backfilling existing artists' discographies.

    Args:
        max_artists: Maximum artists to backfill
        discover_from_albums: If True, also discover new artists from compilation/collaborative albums

    Returns:
        dict: Statistics about the backfill
    """
    print(f"🔄 LIGHT WORKER: Starting backfill (max={max_artists}, discover_from_albums={discover_from_albums})")

    from app.workers.discovery.spider import DiscoverySpider

    db = SessionLocal()
    try:
        spider = DiscoverySpider(db)
        stats = spider.backfill_existing_artists(
            max_artists=max_artists,
            discover_from_albums=discover_from_albums
        )

        print(f"✅ LIGHT WORKER: Backfill complete - {stats['artists_crawled']} artists, {stats['tracks_found']} tracks")
        return stats
    except Exception as e:
        db.rollback()
        print(f"❌ LIGHT WORKER: Backfill failed - {e}")
        raise
    finally:
        db.close()


@celery_app.task(acks_late=True, queue='light')
def cleanup_orphaned_tracks_task(stuck_threshold_minutes: int = 30):
    """
    Periodic maintenance task: Find and re-queue orphaned tracks.

    Tracks can get stuck in PROCESSING status if:
    - Worker crashes mid-processing
    - Docker containers are stopped
    - Database connection issues

    This task finds tracks stuck in PROCESSING for longer than the threshold
    and resets them to PENDING, then re-queues them for analysis.

    Args:
        stuck_threshold_minutes: How long a track can be in PROCESSING before
                                 it's considered orphaned (default: 30 minutes)

    Returns:
        dict: Statistics about recovered tracks
    """
    print(f"🧹 CLEANUP: Looking for tracks stuck in PROCESSING > {stuck_threshold_minutes} minutes")

    db = SessionLocal()
    try:
        threshold_time = datetime.now(timezone.utc) - timedelta(minutes=stuck_threshold_minutes)

        # Find tracks stuck in PROCESSING
        # We check created_at as a proxy - ideally we'd have a processing_started_at field
        # but for now this works since PROCESSING tracks should complete within minutes
        stuck_tracks = db.query(Track).filter(
            Track.processing_status == "PROCESSING"
        ).all()

        # Filter to only truly stuck tracks (no recent analysis data)
        orphaned_tracks = []
        for track in stuck_tracks:
            # Check if track has any analysis sources (if it does, it might be legitimately processing)
            has_recent_analysis = any(
                source.analyzed_at and source.analyzed_at > threshold_time
                for source in track.analysis_sources
            )
            if not has_recent_analysis:
                orphaned_tracks.append(track)

        if not orphaned_tracks:
            print("✅ CLEANUP: No orphaned tracks found")
            return {"recovered": 0, "tracks": []}

        print(f"🔍 CLEANUP: Found {len(orphaned_tracks)} orphaned tracks")

        # Reset to PENDING and re-queue
        recovered_tracks = []
        for track in orphaned_tracks:
            track.processing_status = "PENDING"
            recovered_tracks.append({
                "id": str(track.id),
                "title": track.title
            })
            print(f"   🔄 Reset: {track.title}")

        db.commit()

        # Re-queue for analysis (lazy import to avoid circular deps)
        from app.workers.tasks import analyze_track_task
        for track_info in recovered_tracks:
            analyze_track_task.delay(track_info["id"])
            print(f"   📤 Re-queued: {track_info['title']}")

        print(f"✅ CLEANUP: Recovered {len(recovered_tracks)} orphaned tracks")
        return {
            "recovered": len(recovered_tracks),
            "tracks": recovered_tracks
        }

    except Exception as e:
        db.rollback()
        print(f"❌ CLEANUP FAILED: {e}")
        raise
    finally:
        db.close()
