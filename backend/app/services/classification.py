"""
Dance style classification service.

Uses neckenml's StyleClassifier to predict dance styles from stored audio features.
This service only reads from the database - the heavy ML analysis is done by the
external dansbart-audio-worker.
"""
from sqlalchemy.orm import Session
from app.core.models import Track, AnalysisSource, TrackDanceStyle
from neckenml.core import StyleClassifier, compute_derived_features
from app.core.music_theory import categorize_tempo
from app.services.style_keywords_cache import get_sorted_keywords


class ClassificationService:
    """
    Classifies tracks into dance styles based on stored audio analysis.

    Uses a combination of ML predictions and metadata matching.
    Note: This only re-classifies from stored artifacts - it does not
    perform audio analysis. For analysis, use the dansbart-audio-worker.
    """

    def __init__(self, db: Session):
        self.db = db
        if db:
            self.classifier = StyleClassifier(
                db=db,
                categorize_tempo_fn=categorize_tempo,
                get_keywords_fn=get_sorted_keywords
            )
        else:
            self.classifier = None

    def _get_features_from_source(self, source: AnalysisSource) -> dict:
        """
        Extract features from an AnalysisSource.

        Handles both old and new formats:
        - Old format (hybrid_ml_v2): raw_data contains features directly
        - New format (neckenml_analyzer): raw_data contains artifacts
        """
        if source.source_type == "neckenml_analyzer":
            print(f"   Computing features from stored artifacts (fast!)")
            return compute_derived_features(source.raw_data)
        else:
            return source.raw_data

    def _save_predictions(self, track, predictions):
        """Save classification predictions to database."""
        try:
            # Remove existing styles (only for non-confirmed tracks)
            self.db.query(TrackDanceStyle).filter(TrackDanceStyle.track_id == track.id).delete()

            # Add new styles
            for p in predictions:
                new_style = TrackDanceStyle(
                    track_id=track.id,
                    dance_style=p['style'],
                    sub_style=p.get('sub_style'),
                    is_primary=(p['type'] == 'Primary'),
                    confidence=p.get('confidence', 0.0),
                    tempo_category=p.get('dance_tempo'),
                    bpm_multiplier=p.get('multiplier', 1.0),
                    effective_bpm=p.get('effective_bpm', 0),
                    is_user_confirmed=False
                )
                self.db.add(new_style)

            self.db.commit()

        except Exception as e:
            self.db.rollback()
            print(f"   Error saving {track.title}: {e}")

    def reclassify_library(self):
        """
        Re-classify all tracks in the library from stored analysis data.

        Skips user-confirmed tracks to preserve manual corrections.

        Returns:
            dict: Statistics about the reclassification
        """
        print("Re-evaluating library with new intelligence...")

        tracks = (self.db.query(Track)
                  .join(AnalysisSource)
                  .filter(AnalysisSource.source_type.in_(['neckenml_analyzer', 'hybrid_ml_v2']))
                  .all())

        updated_count = 0
        skipped_count = 0

        for track in tracks:
            # Safety lock: don't override user-confirmed styles
            is_locked = any(s.is_user_confirmed for s in track.dance_styles)

            if is_locked:
                skipped_count += 1
                continue

            source = next((s for s in track.analysis_sources
                          if s.source_type in ['neckenml_analyzer', 'hybrid_ml_v2']), None)
            if not source:
                continue

            features = self._get_features_from_source(source)
            predictions = self.classifier.classify(track, features)
            self._save_predictions(track, predictions)

            updated_count += 1

        print(f"Re-classification complete.")
        print(f"   - Updated: {updated_count} tracks")
        print(f"   - Skipped: {skipped_count} tracks (user locked)")

        return {"updated": updated_count, "skipped": skipped_count}

    def classify_track_immediately(self, track: Track, analysis_data: dict = None):
        """
        Classify a specific track immediately from stored analysis.

        Args:
            track: Track instance to classify
            analysis_data: Optional pre-computed analysis data
        """
        # Check if user locked it
        for style in track.dance_styles:
            if style.is_user_confirmed:
                print(f"   Skipping {track.title} (User Confirmed)")
                return

        features = analysis_data

        if not features:
            source = next((s for s in track.analysis_sources
                          if s.source_type in ['neckenml_analyzer', 'hybrid_ml_v2']), None)
            if source:
                features = self._get_features_from_source(source)

        if not features:
            print(f"   No analysis data found for {track.title}")
            return

        # Update vocals flag
        is_instrumental = features.get('is_likely_instrumental', True)
        track.has_vocals = not is_instrumental
        self.db.add(track)

        # Run classification
        predictions = self.classifier.classify(track, features)

        # Save results
        self._save_predictions(track, predictions)

        if predictions:
            primary = predictions[0]
            print(f"   Classified: {primary['style']} ({primary['dance_tempo']})")
        else:
            print(f"   Classifier returned no results for {track.title}")
