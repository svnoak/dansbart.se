"""
Audio Worker Tasks
Heavy ML-based audio analysis and classification tasks.
Requires: TensorFlow, Essentia, Madmom, Librosa
"""
from celery.exceptions import MaxRetriesExceededError
from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.services.analysis import AnalysisService
from app.core.models import Track
import gc

# GLOBAL VARIABLE (Per Worker Process)
# This starts as None. The first task this worker runs will fill it.
# Subsequent tasks on the same worker will reuse it.
_worker_analysis_service = None

def get_analysis_service():
    global _worker_analysis_service
    if _worker_analysis_service is None:
        print("🔧 AUDIO WORKER INIT: Loading TensorFlow/Essentia models for this process...")
        # This triggers the heavy load INSIDE the correct process
        _worker_analysis_service = AnalysisService(None)
    return _worker_analysis_service

def cleanup_tf_resources():
    """Clean up TensorFlow/Keras resources to free memory"""
    try:
        import tensorflow as tf
        from tensorflow import keras
        # Clear Keras session to free GPU/CPU memory
        keras.backend.clear_session()
        # Force TensorFlow garbage collection
        tf.keras.backend.clear_session()
        print("   [CLEANUP] Cleared TensorFlow/Keras session")
    except Exception as e:
        print(f"   [CLEANUP] Could not clear TF session: {e}")


@celery_app.task(
    bind=True,
    acks_late=True,
    queue='audio',
    autoretry_for=(Exception,),
    retry_backoff=60,  # Start with 60s, then exponential backoff
    retry_backoff_max=600,  # Max 10 minutes between retries
    max_retries=3,
    retry_jitter=True,  # Add randomness to prevent thundering herd
)
def analyze_track_task(self, track_id: str):
    """
    Heavy ML task: Audio analysis with TensorFlow/Essentia models.
    Routed to: audio queue (audio worker only)

    Automatic retry:
    - Retries up to 3 times on any exception
    - Exponential backoff: 60s, 120s, 240s (capped at 600s)
    - On final failure, marks track as FAILED
    """
    attempt = self.request.retries + 1
    max_attempts = self.max_retries + 1
    print(f"🏋️‍♂️ AUDIO WORKER: Starting analysis for {track_id} (attempt {attempt}/{max_attempts})")

    # 1. Get the service (Loads model if first run)
    service = get_analysis_service()

    # 2. Create a fresh DB session
    db = SessionLocal()
    try:
        # 3. Inject the fresh session into the reused service
        service.db = db

        # 4. Run Logic
        service.analyze_track_by_id(track_id)

        print(f"✅ AUDIO WORKER: Finished {track_id}")

        # Clean up TensorFlow resources after successful completion
        cleanup_tf_resources()
        gc.collect()

    except MaxRetriesExceededError:
        # All retries exhausted - mark as FAILED
        print(f"💀 AUDIO WORKER: Max retries exceeded for {track_id}, marking as FAILED")
        try:
            track = db.query(Track).filter(Track.id == track_id).first()
            if track:
                track.processing_status = "FAILED"
                db.commit()
        except Exception as status_err:
            print(f"⚠️ Failed to update status to FAILED: {status_err}")
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ AUDIO WORKER FAILED (attempt {attempt}/{max_attempts}): {e}")

        # If this is the last retry, mark as FAILED
        if self.request.retries >= self.max_retries:
            print(f"💀 AUDIO WORKER: Final attempt failed for {track_id}, marking as FAILED")
            try:
                track = db.query(Track).filter(Track.id == track_id).first()
                if track:
                    track.processing_status = "FAILED"
                    db.commit()
            except Exception as status_err:
                print(f"⚠️ Failed to update status to FAILED: {status_err}")
        else:
            # Reset to PENDING so it can be picked up again if worker crashes
            try:
                track = db.query(Track).filter(Track.id == track_id).first()
                if track and track.processing_status == "PROCESSING":
                    track.processing_status = "PENDING"
                    db.commit()
                    print(f"🔄 Reset {track_id} to PENDING for retry")
            except Exception as status_err:
                print(f"⚠️ Failed to reset status to PENDING: {status_err}")
        raise
    finally:
        # Always cleanup resources, even on failure
        cleanup_tf_resources()
        gc.collect()
        db.close()
