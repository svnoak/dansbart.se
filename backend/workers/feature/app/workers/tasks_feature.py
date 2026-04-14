"""
Feature worker tasks - Classification from stored analysis data.

These tasks use neckenml-core (MIT licensed) only.
No audio processing - just re-classification from stored artifacts.
"""
import structlog
from celery import shared_task
from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.core.models import Track, AnalysisSource
from app.services.classification import ClassificationService
from app.services.training import ModelTrainingService
from app.services.style_config_cache import get_beats_per_bar
from sqlalchemy import desc

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


@celery_app.task(bind=True, acks_late=True, queue='feature')
def correct_bars_task(self, track_id: str, main_style: str, sub_style: str = None):
    """
    Re-derive bar positions for a track based on its confirmed dance style.

    Reads stored beat times from analysis_sources, looks up beats_per_bar
    from dance_style_config, and updates track.bars and any active
    TrackStructureVersion.

    Args:
        track_id: UUID of the track to update
        main_style: Confirmed main dance style (e.g. "Schottis")
        sub_style: Optional sub-style for more specific BPB lookup
    """
    log.info("correct_bars_start", track_id=track_id, main_style=main_style, sub_style=sub_style)

    db = SessionLocal()
    try:
        track = db.query(Track).filter(Track.id == track_id).first()
        if not track:
            log.warn("track_not_found", track_id=track_id)
            return {"error": "Track not found"}

        source = (
            db.query(AnalysisSource)
            .filter(
                AnalysisSource.track_id == track.id,
                AnalysisSource.source_type == "neckenml_analyzer",
            )
            .order_by(desc(AnalysisSource.analyzed_at))
            .first()
        )
        if not source:
            log.info("correct_bars_skipped", reason="no_analysis_source", track_id=track_id)
            return {"status": "skipped", "reason": "no_analysis_source"}

        beat_times = source.raw_data.get("rhythm_extractor", {}).get("beats", [])
        if not beat_times:
            log.info("correct_bars_skipped", reason="no_beat_times", track_id=track_id)
            return {"status": "skipped", "reason": "no_beat_times"}

        beats_per_bar = get_beats_per_bar(db, main_style, sub_style)
        if beats_per_bar is None:
            log.info("correct_bars_skipped", reason="no_style_config",
                     track_id=track_id, main_style=main_style)
            return {"status": "skipped", "reason": "no_style_config"}

        bars = [beat_times[i] for i in range(0, len(beat_times), beats_per_bar)]
        track.bars = bars

        for sv in track.structure_versions:
            if sv.is_active and sv.structure_data:
                sv.structure_data = {**sv.structure_data, "bars": bars}

        db.commit()

        log.info("correct_bars_done", track_id=track_id, main_style=main_style,
                 beats_per_bar=beats_per_bar, bar_count=len(bars))
        return {"status": "success", "bar_count": len(bars), "beats_per_bar": beats_per_bar}

    except Exception as e:
        db.rollback()
        log.error("correct_bars_failed", track_id=track_id, exc_info=True)
        raise
    finally:
        db.close()
