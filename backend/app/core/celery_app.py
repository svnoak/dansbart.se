import os
from celery import Celery

# Get Redis URL from env or default to localhost (for local testing)
BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "dansbart_worker",
    broker=BROKER_URL,
    backend=BROKER_URL,
    include=["app.workers.tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Stockholm",
    enable_utc=True,
)