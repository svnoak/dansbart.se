"""
Feature worker tasks - Classification from stored analysis data.

These tasks use neckenml-core (MIT licensed) only.
No audio processing - just re-classification from stored artifacts.
"""
from celery import shared_task
from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.core.models import Track
from app.services.classification import ClassificationService


@celery_app.task(bind=True, acks_late=True, queue='feature')
def reclassify_library_task(self):
    """
    Re-classify all tracks in the library from stored analysis data.

    This task reads stored ML artifacts and runs the StyleClassifier
    to update dance style predictions. Does not perform any audio analysis.

    Returns:
        dict: Statistics about the reclassification (updated, skipped counts)
    """
    print("[Feature Worker] Starting library reclassification...")

    db = SessionLocal()
    try:
        service = ClassificationService(db)
        result = service.reclassify_library()
        print(f"[Feature Worker] Reclassification complete: {result}")
        return result
    except Exception as e:
        print(f"[Feature Worker] Error during reclassification: {e}")
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
    print(f"[Feature Worker] Classifying track {track_id}...")

    db = SessionLocal()
    try:
        track = db.query(Track).filter(Track.id == track_id).first()
        if not track:
            print(f"[Feature Worker] Track {track_id} not found")
            return {"error": "Track not found"}

        service = ClassificationService(db)
        service.classify_track_immediately(track, analysis_data)

        return {"status": "success", "track_id": track_id}
    except Exception as e:
        print(f"[Feature Worker] Error classifying track {track_id}: {e}")
        raise
    finally:
        db.close()
