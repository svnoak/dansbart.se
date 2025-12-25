from sqlalchemy.orm import Session
from app.core.models import Track, AnalysisSource, TrackDanceStyle
from neckenml.classifier import StyleClassifier
from neckenml import compute_derived_features
from app.core.music_theory import categorize_tempo
from app.services.style_keywords_cache import get_sorted_keywords
from app.repository import track

class ClassificationService:
    def __init__(self, db: Session):
        self.db = db
        # Pass db session and callback functions to classifier
        self.classifier = StyleClassifier(
            db=db,
            categorize_tempo_fn=categorize_tempo,
            get_keywords_fn=get_sorted_keywords
        )

    def _get_features_from_source(self, source: AnalysisSource) -> dict:
        """
        Extracts features from an AnalysisSource, handling both:
        - Old format (source_type='hybrid_ml_v2'): raw_data contains features directly
        - New format (source_type='neckenml_analyzer'): raw_data contains artifacts
        """
        if source.source_type == "neckenml_analyzer":
            # New format: compute features from artifacts
            print(f"   ⚡ Computing features from stored artifacts (fast!)")
            return compute_derived_features(source.raw_data)
        else:
            # Old format: raw_data IS the features
            return source.raw_data

    def _save_predictions(self, track, predictions):
        try:
            # 1. Wipe existing styles for this track
            # Since we checked 'is_locked' in the loop above, we know
            # we are only deleting unconfirmed/AI-generated data here.
            self.db.query(TrackDanceStyle).filter(TrackDanceStyle.track_id == track.id).delete()

            # 2. Add new styles
            for p in predictions:
                new_style = TrackDanceStyle(
                    track_id=track.id,
                    dance_style=p['style'],
                    sub_style=p.get('sub_style'),  # Save sub-style from metadata match
                    is_primary=(p['type'] == 'Primary'),
                    confidence=p.get('confidence', 0.0),
                    tempo_category=p.get('dance_tempo'),
                    bpm_multiplier=p.get('multiplier', 1.0),
                    effective_bpm=p.get('effective_bpm', 0),
                    is_user_confirmed=False  # AI predictions are never confirmed by default
                )
                self.db.add(new_style)

            self.db.commit()

        except Exception as e:
            self.db.rollback()
            print(f"   ❌ Error saving {track.title}: {e}")

    def reclassify_library(self):
        """
        Loops through ALL tracks in the library.
        If a track is NOT confirmed by a user, we re-run the classification
        using the latest AI Brain.

        Returns:
            dict: Statistics about the reclassification (updated, skipped)
        """
        print("🔄 Re-evaluating library with new intelligence...")

        # 1. Get all tracks that have analysis data (both old and new formats)
        tracks = (self.db.query(Track)
                  .join(AnalysisSource)
                  .filter(AnalysisSource.source_type.in_(['neckenml_analyzer', 'hybrid_ml_v2']))
                  .all())

        updated_count = 0
        skipped_count = 0

        for track in tracks:
            # --- THE SAFETY LOCK ---
            is_locked = any(s.is_user_confirmed for s in track.dance_styles)

            if is_locked:
                skipped_count += 1
                continue

            # --- THE RE-CLASSIFICATION ---
            # Support both old (hybrid_ml_v2) and new (neckenml_analyzer) formats
            source = next((s for s in track.analysis_sources
                          if s.source_type in ['neckenml_analyzer', 'hybrid_ml_v2']), None)
            if not source: continue

            # 1. Get features (compute from artifacts if new format)
            features = self._get_features_from_source(source)

            # 2. Ask the Brain
            predictions = self.classifier.classify(track, features)

            # 2. Save
            self._save_predictions(track, predictions)

            updated_count += 1

        print(f"✅ Re-classification complete.")
        print(f"   - Updated: {updated_count} tracks (AI refined)")
        print(f"   - Skipped: {skipped_count} tracks (User locked)")

        return {"updated": updated_count, "skipped": skipped_count}

    def classify_track_immediately(self, track: Track, analysis_data: dict = None):
        """
        Classifies a specific track instance immediately.
        Accepts optional 'analysis_data' to avoid DB lookups during the initial analysis pipeline.
        """
        # 1. Check if user locked it (Safety check)
        for style in track.dance_styles:
            if style.is_user_confirmed:
                print(f"   🔒 Skipping {track.title} (User Confirmed)")
                return

        # 2. Get Analysis Data (Optimization applied here)
        features = analysis_data

        if not features:
            # Fallback: Fetch from DB if not provided directly
            source = next((s for s in track.analysis_sources
                          if s.source_type in ['neckenml_analyzer', 'hybrid_ml_v2']), None)
            if source:
                features = self._get_features_from_source(source)

        if not features:
            print(f"   ⚠️ No analysis data found for {track.title}")
            return

        # 3. Update Vocals flag (Descriptive)
        # We rely on the analysis data for this, not just the DB column
        is_instrumental = features.get('is_likely_instrumental', True)
        track.has_vocals = not is_instrumental
        self.db.add(track)

        # 4. Run The Brain
        predictions = self.classifier.classify(track, features)

        # 5. Save
        self._save_predictions(track, predictions)
        
        # Logging
        if predictions:
            primary = predictions[0]
            print(f"   ✅ Classified: {primary['style']} ({primary['dance_tempo']})")
        else:
            print(f"   ⚠️ Classifier returned no results for {track.title}")