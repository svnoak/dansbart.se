"""
DEPRECATED: This file is kept for backwards compatibility.

Tasks have been split into:
- tasks_light.py: Light I/O tasks (discovery, ingestion, backfill)
- Audio tasks are now in the external dansbart-audio-worker repo (AGPL)

Import all tasks here to maintain existing imports elsewhere in the codebase.
"""
from app.core.celery_app import celery_app

# Lazy imports - only loaded when actually called
def __getattr__(name):
    """Lazy load tasks to avoid importing heavy dependencies in API backend."""
    if name == 'analyze_track_task':
        # Audio tasks are handled by external worker via Celery
        # Return a signature that sends to the external worker's task
        def send_analyze_task(track_id):
            return celery_app.send_task(
                'app.workers.tasks_audio.analyze_track_task',
                args=[track_id],
                queue='audio'
            )
        return send_analyze_task
    elif name in ('spider_crawl_related_task', 'spider_crawl_search_task', 'spider_backfill_task', 'cleanup_orphaned_tracks_task'):
        from app.workers.tasks_light import (
            spider_crawl_related_task,
            spider_crawl_search_task,
            spider_backfill_task,
            cleanup_orphaned_tracks_task
        )
        if name == 'spider_crawl_related_task':
            return spider_crawl_related_task
        elif name == 'spider_crawl_search_task':
            return spider_crawl_search_task
        elif name == 'spider_backfill_task':
            return spider_backfill_task
        else:
            return cleanup_orphaned_tracks_task
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")

# Re-export for backwards compatibility
__all__ = [
    'analyze_track_task',
    'spider_crawl_related_task',
    'spider_crawl_search_task',
    'spider_backfill_task',
    'cleanup_orphaned_tracks_task',
]
