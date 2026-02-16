"""Celery application configuration."""
import structlog
from celery import Celery
from celery.signals import task_prerun, task_postrun, task_failure

from app.core.config import settings
from app.core.logging import setup_logging, init_canonical, emit_canonical

setup_logging()

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


@task_prerun.connect
def on_task_start(sender=None, task_id=None, task=None, args=None,
                  kwargs=None, **kw):
    headers = getattr(task.request, "headers", None) or {}
    trace_id = headers.get("trace_id") or task_id
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        trace_id=trace_id, task_id=task_id, task_name=sender.name
    )
    init_canonical(sender.name, task_id, trace_id)


@task_postrun.connect
def on_task_end(sender=None, task_id=None, task=None, retval=None,
                state=None, **kw):
    emit_canonical(state)
    structlog.contextvars.clear_contextvars()


@task_failure.connect
def on_task_failure(sender=None, task_id=None, exception=None,
                    traceback=None, **kw):
    log = structlog.get_logger()
    log.error("task.failed", exception=str(exception), exc_info=True)
