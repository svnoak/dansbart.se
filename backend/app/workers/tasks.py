"""
DEPRECATED: This file is kept for backwards compatibility.

Tasks have been split into:
- tasks_audio.py: Heavy ML tasks (audio analysis)
- tasks_light.py: Light I/O tasks (discovery, ingestion, backfill)

Import all tasks here to maintain existing imports elsewhere in the codebase.
"""

# Import audio tasks
from app.workers.tasks_audio import (
    analyze_track_task,
    get_analysis_service
)

# Import light tasks
from app.workers.tasks_light import (
    spider_crawl_related_task,
    spider_crawl_search_task,
    spider_backfill_task
)

# Re-export for backwards compatibility
__all__ = [
    'analyze_track_task',
    'get_analysis_service',
    'spider_crawl_related_task',
    'spider_crawl_search_task',
    'spider_backfill_task',
]