import os
from celery import Celery
from celery.schedules import crontab

# Get Redis URL from env or default to localhost (for local testing)
BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")

# Determine which task modules to include based on worker type
# Set WORKER_TYPE env var in docker-compose.yml: "audio" or "light"
WORKER_TYPE = os.getenv("WORKER_TYPE", "all")

if WORKER_TYPE == "audio":
    # Audio worker: only load audio tasks
    task_includes = ["app.workers.tasks_audio"]
elif WORKER_TYPE == "light":
    # Light worker: only load light tasks
    task_includes = ["app.workers.tasks_light"]
else:
    # API/Default: load all tasks (for task enqueueing)
    task_includes = [
        "app.workers.tasks_audio",
        "app.workers.tasks_light",
    ]

celery_app = Celery(
    "dansbart_worker",
    broker=BROKER_URL,
    backend=BROKER_URL,
    include=task_includes
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Stockholm",
    enable_utc=True,

    # Task routing configuration
    # Routes tasks to specialized queues based on their requirements
    task_routes={
        # Audio tasks → audio queue (requires ML models)
        'app.workers.tasks_audio.analyze_track_task': {'queue': 'audio'},

        # Light tasks → light queue (I/O bound, no ML)
        'app.workers.tasks_light.spider_crawl_related_task': {'queue': 'light'},
        'app.workers.tasks_light.spider_crawl_search_task': {'queue': 'light'},
        'app.workers.tasks_light.spider_backfill_task': {'queue': 'light'},
        'app.workers.tasks_light.cleanup_orphaned_tracks_task': {'queue': 'light'},
        'app.workers.tasks_light.reclassify_library_task': {'queue': 'light'},

        # Backwards compatibility for tasks imported from old tasks.py
        'app.workers.tasks.analyze_track_task': {'queue': 'audio'},
        'app.workers.tasks.spider_crawl_related_task': {'queue': 'light'},
        'app.workers.tasks.spider_crawl_search_task': {'queue': 'light'},
        'app.workers.tasks.spider_backfill_task': {'queue': 'light'},
        'app.workers.tasks.cleanup_orphaned_tracks_task': {'queue': 'light'},
    },

    # Default queue for any unrouted tasks
    task_default_queue='light',

    # Periodic task schedule (Celery Beat)
    beat_schedule={
        'cleanup-orphaned-tracks-every-15-minutes': {
            'task': 'app.workers.tasks_light.cleanup_orphaned_tracks_task',
            'schedule': crontab(minute='*/15'),  # Every 15 minutes
            'args': (30,),  # stuck_threshold_minutes = 30
        },
    },
)