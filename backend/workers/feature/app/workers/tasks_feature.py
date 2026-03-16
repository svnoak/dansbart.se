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
from app.services.training import ModelTrainingService

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


@celery_app.task(name="retrain_model_task", bind=True, acks_late=True, queue='light')
def retrain_model_task(self, reclassify_after=False):
    """
    Retrain the dance style classification model from confirmed tracks.

    Gathers training data from user-confirmed and high-confidence tracks,
    then calls ClassificationHead.train() to update the model weights.

    Args:
        reclassify_after: If True, dispatch reclassify_library_task after training

    Returns:
        dict: Training statistics
    """
    log.info("starting_model_retrain", reclassify_after=reclassify_after)

    db = SessionLocal()
    try:
        service = ModelTrainingService(db)
        result = service.train_from_confirmed_tracks()
        log.info("model_retrain_complete", result=result)

        if reclassify_after and result.get("status") == "trained":
            log.info("dispatching_reclassification_after_retrain")
            reclassify_library_task.delay()

        return result
    except Exception as e:
        log.error("model_retrain_failed", exc_info=True)
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
