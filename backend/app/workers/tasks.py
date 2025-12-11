from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.services.analysis import AnalysisService

# GLOBAL VARIABLE (Per Worker Process)
# This starts as None. The first task this worker runs will fill it.
# Subsequent tasks on the same worker will reuse it.
_worker_analysis_service = None

def get_analysis_service():
    global _worker_analysis_service
    if _worker_analysis_service is None:
        print("🔧 WORKER INIT: Loading TensorFlow/Essentia models for this process...")
        # This triggers the heavy load INSIDE the correct process
        _worker_analysis_service = AnalysisService(None)
    return _worker_analysis_service

@celery_app.task(acks_late=True)
def analyze_track_task(track_id: str):
    print(f"🏋️‍♂️ WORKER: Starting analysis for {track_id}")

    # 1. Get the service (Loads model if first run)
    service = get_analysis_service()

    # 2. Create a fresh DB session
    db = SessionLocal()
    try:
        # 3. Inject the fresh session into the reused service
        service.db = db

        # 4. Run Logic
        service.analyze_track_by_id(track_id)

        print(f"✅ WORKER: Finished {track_id}")
    except Exception as e:
        db.rollback()
        print(f"❌ WORKER FAILED: {e}")
    finally:
        db.close()


@celery_app.task(acks_late=True, time_limit=3600)
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
    print(f"⚠️  WORKER: spider_crawl_related_task is DEPRECATED")
    print(f"   Redirecting to backfill mode with max_artists={max_discoveries}")

    from app.workers.discovery.spider import DiscoverySpider

    db = SessionLocal()
    try:
        spider = DiscoverySpider(db)
        stats = spider.backfill_existing_artists(max_artists=max_discoveries)

        print(f"✅ WORKER: Backfill complete - {stats['artists_crawled']} artists, {stats['tracks_found']} tracks")
        return stats
    except Exception as e:
        db.rollback()
        print(f"❌ WORKER: Backfill failed - {e}")
        raise
    finally:
        db.close()


@celery_app.task(acks_late=True, time_limit=3600)
def spider_crawl_search_task(max_discoveries: int = 10):
    """
    Background task for crawling via Spotify search.

    Args:
        max_discoveries: Maximum new artists to crawl

    Returns:
        dict: Statistics about the crawl
    """
    print(f"🔍 WORKER: Starting search-based crawl (max={max_discoveries})")

    from app.workers.discovery.spider import DiscoverySpider

    db = SessionLocal()
    try:
        spider = DiscoverySpider(db)
        stats = spider.crawl_by_search(max_discoveries=max_discoveries)

        print(f"✅ WORKER: Search crawl complete - {stats['artists_crawled']} artists, {stats['tracks_found']} tracks")
        return stats
    except Exception as e:
        db.rollback()
        print(f"❌ WORKER: Search crawl failed - {e}")
        raise
    finally:
        db.close()


@celery_app.task(acks_late=True, time_limit=3600)
def spider_backfill_task(max_artists: int = 20, discover_from_albums: bool = True):
    """
    Background task for backfilling existing artists' discographies.

    Args:
        max_artists: Maximum artists to backfill
        discover_from_albums: If True, also discover new artists from compilation/collaborative albums

    Returns:
        dict: Statistics about the backfill
    """
    print(f"🔄 WORKER: Starting backfill (max={max_artists}, discover_from_albums={discover_from_albums})")

    from app.workers.discovery.spider import DiscoverySpider

    db = SessionLocal()
    try:
        spider = DiscoverySpider(db)
        stats = spider.backfill_existing_artists(
            max_artists=max_artists,
            discover_from_albums=discover_from_albums
        )

        print(f"✅ WORKER: Backfill complete - {stats['artists_crawled']} artists, {stats['tracks_found']} tracks")
        return stats
    except Exception as e:
        db.rollback()
        print(f"❌ WORKER: Backfill failed - {e}")
        raise
    finally:
        db.close()