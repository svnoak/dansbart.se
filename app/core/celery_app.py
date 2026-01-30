"""
Celery configuration for the audio worker.

This worker processes audio analysis tasks from the 'audio' queue.

AGPL-3.0 License - See LICENSE file for details.
"""
import os
from celery import Celery

# Get Redis URL from env or default to localhost
BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "dansbart_audio_worker",
    broker=BROKER_URL,
    backend=BROKER_URL,
    include=["app.workers.tasks_audio"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Stockholm",
    enable_utc=True,

    # Task routing - all tasks go to audio queue
    task_routes={
        'app.workers.tasks_audio.analyze_track_task': {'queue': 'audio'},
    },

    # Default queue
    task_default_queue='audio',
)
