import os
from celery import Celery

# Get Redis URL from env or default to localhost (for local testing)
BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "dansbart_worker",
    broker=BROKER_URL,
    backend=BROKER_URL,
    include=[
        "app.workers.tasks",        # For backwards compatibility
        "app.workers.tasks_audio",  # Heavy ML tasks
        "app.workers.tasks_light",  # Light I/O tasks
    ]
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

        # Backwards compatibility for tasks imported from old tasks.py
        'app.workers.tasks.analyze_track_task': {'queue': 'audio'},
        'app.workers.tasks.spider_crawl_related_task': {'queue': 'light'},
        'app.workers.tasks.spider_crawl_search_task': {'queue': 'light'},
        'app.workers.tasks.spider_backfill_task': {'queue': 'light'},
    },

    # Default queue for any unrouted tasks
    task_default_queue='light',
)