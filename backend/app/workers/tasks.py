"""
DEPRECATED: This file is kept for backwards compatibility.

Tasks have been split into:
- tasks_audio.py: Heavy ML tasks (audio analysis)
- tasks_light.py: Light I/O tasks (discovery, ingestion, backfill)

Import all tasks here to maintain existing imports elsewhere in the codebase.

IMPORTANT: Uses lazy imports to avoid loading heavy ML dependencies in API backend.
"""

# Lazy imports - only loaded when actually called
def __getattr__(name):
    """Lazy load tasks to avoid importing heavy dependencies in API backend."""
    if name == 'analyze_track_task' or name == 'get_analysis_service':
        from app.workers.tasks_audio import analyze_track_task, get_analysis_service
        if name == 'analyze_track_task':
            return analyze_track_task
        else:
            return get_analysis_service
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
    'get_analysis_service',
    'spider_crawl_related_task',
    'spider_crawl_search_task',
    'spider_backfill_task',
    'cleanup_orphaned_tracks_task',
]