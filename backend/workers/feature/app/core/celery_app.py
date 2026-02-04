"""Celery application configuration."""
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "dansbart-feature-worker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.workers.tasks_feature",
        "app.workers.tasks_light",
    ]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour
    task_soft_time_limit=3300,  # 55 minutes
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)

# Queue routing
celery_app.conf.task_routes = {
    "app.workers.tasks_feature.*": {"queue": "feature"},
    "app.workers.tasks_light.*": {"queue": "light"},
}
