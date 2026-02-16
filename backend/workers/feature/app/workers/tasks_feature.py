"""
Feature worker tasks - Classification from stored analysis data.

These tasks use neckenml-core (MIT licensed) only.
No audio processing - just re-classification from stored artifacts.
"""
import structlog
from celery import shared_task
from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.core.models import Track
from app.services.classification import ClassificationService

log = structlog.get_logger()


@celery_app.task(bind=True, acks_late=True, queue='feature')
def reclassify_library_task(self):
    """
    Re-classify all tracks in the library from stored analysis data.

    This task reads stored ML artifacts and runs the StyleClassifier
    to update dance style predictions. Does not perform any audio analysis.

    Returns:
        dict: Statistics about the reclassification (updated, skipped counts)
    """
    log.info("starting_library_reclassification")

    db = SessionLocal()
    try:
        service = ClassificationService(db)
        result = service.reclassify_library()
        log.info("reclassification_complete", result=result)
        return result
    except Exception as e:
        log.error("reclassification_failed", exc_info=True)
        raise
    finally:
        db.close()


@celery_app.task(bind=True, acks_late=True, queue='feature')
def classify_track_task(self, track_id: str, analysis_data: dict = None):
    """
    Classify a single track from stored analysis data.

    Args:
        track_id: UUID of the track to classify
        analysis_data: Optional pre-computed analysis data (from audio worker)

    Returns:
        dict: Classification result or error
    """
    log.info("classifying_track", track_id=track_id)

    db = SessionLocal()
    try:
        track = db.query(Track).filter(Track.id == track_id).first()
        if not track:
            log.warn("track_not_found", track_id=track_id)
            return {"error": "Track not found"}

        service = ClassificationService(db)
        service.classify_track_immediately(track, analysis_data)

        return {"status": "success", "track_id": track_id}
    except Exception as e:
        log.error("classification_failed", track_id=track_id, exc_info=True)
        raise
    finally:
        db.close()
