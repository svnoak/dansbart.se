"""
Light Worker Tasks
I/O-bound tasks: Discovery (Spotify), Ingestion, Backfill.
No ML models required.
"""
from app.core.celery_app import celery_app
from app.core.database import SessionLocal

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
