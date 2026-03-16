"""
Model training service for the dance style classifier.

Gathers training data from user-confirmed and high-confidence tracks,
then retrains the ClassificationHead using neckenml's TrainingService.
"""
import structlog
from sqlalchemy.orm import Session
from app.core.models import Track, AnalysisSource, TrackDanceStyle
from neckenml.core import compute_derived_features, ClassificationHead

log = structlog.get_logger()

MINIMUM_TRAINING_SAMPLES = 50
HIGH_CONFIDENCE_THRESHOLD = 0.95


class ModelTrainingService:
    """Trains the classification model from confirmed and high-confidence tracks."""

    def __init__(self, db: Session):
        self.db = db

    def train_from_confirmed_tracks(self) -> dict:
        """
        Gather training data and retrain the classification head.

        Training data comes from two sources:
        1. User-confirmed tracks (is_user_confirmed = true)
        2. High-confidence metadata-classified tracks (confidence >= 0.95)

        Returns:
            dict with training stats (status, trained_on, styles, accuracy)
        """
        embeddings = []
        labels = []
        styles_seen = set()

        # Source 1: User-confirmed styles
        confirmed_styles = (
            self.db.query(TrackDanceStyle)
            .filter(TrackDanceStyle.is_user_confirmed == True)
            .all()
        )

        confirmed_count = self._collect_training_data(
            confirmed_styles, embeddings, labels, styles_seen
        )
        log.info("collected_confirmed_tracks", count=confirmed_count)

        # Source 2: High-confidence metadata-classified styles
        high_conf_styles = (
            self.db.query(TrackDanceStyle)
            .filter(
                TrackDanceStyle.confidence >= HIGH_CONFIDENCE_THRESHOLD,
                TrackDanceStyle.is_user_confirmed == False,
            )
            .all()
        )

        high_conf_count = self._collect_training_data(
            high_conf_styles, embeddings, labels, styles_seen
        )
        log.info("collected_high_confidence_tracks", count=high_conf_count)

        total_samples = len(embeddings)
        if total_samples < MINIMUM_TRAINING_SAMPLES:
            log.warn(
                "insufficient_training_data",
                samples=total_samples,
                minimum=MINIMUM_TRAINING_SAMPLES,
            )
            return {
                "status": "skipped",
                "reason": "insufficient_data",
                "samples": total_samples,
                "minimum": MINIMUM_TRAINING_SAMPLES,
            }

        # Train the model
        log.info(
            "training_model",
            samples=total_samples,
            styles=sorted(styles_seen),
        )

        head = ClassificationHead()
        head.train(embeddings, labels)

        return {
            "status": "trained",
            "trained_on": total_samples,
            "confirmed_samples": confirmed_count,
            "high_confidence_samples": high_conf_count,
            "styles": sorted(styles_seen),
        }

    def _collect_training_data(
        self,
        dance_styles: list[TrackDanceStyle],
        embeddings: list,
        labels: list,
        styles_seen: set,
    ) -> int:
        """
        For each TrackDanceStyle, load the matching AnalysisSource and compute
        the feature vector. Appends to embeddings/labels lists.

        Returns the number of samples successfully collected.
        """
        count = 0
        for style in dance_styles:
            source = (
                self.db.query(AnalysisSource)
                .filter(
                    AnalysisSource.track_id == style.track_id,
                    AnalysisSource.source_type.in_(
                        ["neckenml_analyzer", "hybrid_ml_v2"]
                    ),
                )
                .first()
            )

            if not source or not source.raw_data:
                continue

            try:
                if source.source_type == "neckenml_analyzer":
                    features = compute_derived_features(source.raw_data)
                else:
                    features = source.raw_data

                embedding = features.get("embedding")
                if not embedding or len(embedding) != 217:
                    continue

                embeddings.append(embedding)
                labels.append(style.dance_style)
                styles_seen.add(style.dance_style)
                count += 1

            except Exception:
                log.debug(
                    "skipping_track_feature_error",
                    track_id=str(style.track_id),
                    exc_info=True,
                )

        return count
