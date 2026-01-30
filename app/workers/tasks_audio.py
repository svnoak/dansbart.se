"""
Audio Worker Celery Tasks.

Heavy ML-based audio analysis and classification tasks.
Requires: TensorFlow, Essentia, Madmom, Librosa, neckenml

AGPL-3.0 License - See LICENSE file for details.
"""
from celery.exceptions import MaxRetriesExceededError
from celery.signals import worker_shutdown
from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.services.analysis import AnalysisService
from app.core.models import Track
import gc

# Global variable (per worker process)
# Loads once, reused for subsequent tasks
_worker_analysis_service = None


def get_analysis_service():
    """Get or create the analysis service with loaded models."""
    global _worker_analysis_service
    if _worker_analysis_service is None:
        print("AUDIO WORKER INIT: Loading neckenml models for this process...")
        _worker_analysis_service = AnalysisService(None)
    return _worker_analysis_service


def cleanup_resources():
    """Clean up memory after analysis by forcing garbage collection."""
    collected = gc.collect()
    print(f"   [CLEANUP] Python GC collected {collected} objects")


@worker_shutdown.connect
def cleanup_worker_on_shutdown(**kwargs):
    """Clean up neckenml resources when worker shuts down gracefully."""
    global _worker_analysis_service
    if _worker_analysis_service and hasattr(_worker_analysis_service, '_analyzer'):
        if _worker_analysis_service._analyzer:
            print("WORKER SHUTDOWN: Cleaning up neckenml models...")
            _worker_analysis_service._analyzer.close()
            print("WORKER SHUTDOWN: Cleanup complete")


@celery_app.task(
    bind=True,
    acks_late=True,
    queue='audio',
    autoretry_for=(Exception,),
    retry_backoff=60,
    retry_backoff_max=600,
    max_retries=3,
    retry_jitter=True,
)
def analyze_track_task(self, track_id: str):
    """
    Main audio analysis task.

    Fetches audio from YouTube, runs ML analysis, and stores results.

    Automatic retry:
    - Retries up to 3 times on any exception
    - Exponential backoff: 60s, 120s, 240s (capped at 600s)
    - On final failure, marks track as FAILED
    """
    attempt = self.request.retries + 1
    max_attempts = self.max_retries + 1
    print(f"AUDIO WORKER: Starting analysis for {track_id} (attempt {attempt}/{max_attempts})")

    # Get the service (loads model if first run)
    service = get_analysis_service()

    # Create fresh DB session
    db = SessionLocal()
    try:
        # Inject session into reused service
        service.db = db
        service.repo.db = db
        service.classifier_service.db = db

        # Run analysis
        service.analyze_track_by_id(track_id)

        print(f"AUDIO WORKER: Finished {track_id}")

        # Clean up analyzer memory
        service.cleanup_analyzer_memory()
        cleanup_resources()
        gc.collect()

    except MaxRetriesExceededError:
        print(f"AUDIO WORKER: Max retries exceeded for {track_id}, marking as FAILED")
        try:
            track = db.query(Track).filter(Track.id == track_id).first()
            if track:
                track.processing_status = "FAILED"
                db.commit()
        except Exception as status_err:
            print(f"Failed to update status to FAILED: {status_err}")
        raise

    except Exception as e:
        db.rollback()
        print(f"AUDIO WORKER FAILED (attempt {attempt}/{max_attempts}): {e}")

        if self.request.retries >= self.max_retries:
            print(f"AUDIO WORKER: Final attempt failed for {track_id}, marking as FAILED")
            try:
                track = db.query(Track).filter(Track.id == track_id).first()
                if track:
                    track.processing_status = "FAILED"
                    db.commit()
            except Exception as status_err:
                print(f"Failed to update status to FAILED: {status_err}")
        else:
            try:
                track = db.query(Track).filter(Track.id == track_id).first()
                if track and track.processing_status == "PROCESSING":
                    track.processing_status = "PENDING"
                    db.commit()
                    print(f"Reset {track_id} to PENDING for retry")
            except Exception as status_err:
                print(f"Failed to reset status to PENDING: {status_err}")
        raise

    finally:
        try:
            service.cleanup_analyzer_memory()
        except Exception as e:
            print(f"Error during finally cleanup: {e}")

        cleanup_resources()
        gc.collect()
        db.close()
