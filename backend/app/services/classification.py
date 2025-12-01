from sqlalchemy.orm import Session
from app.core.models import Track, AnalysisSource, TrackDanceStyle
from app.workers.synthesis.style_classifier import StyleClassifier
from app.repository import track

class ClassificationService:
    def __init__(self, db: Session):
        self.db = db
        self.classifier = StyleClassifier() # Instantiate the "Brain"

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
                    is_primary=(p['type'] == 'Primary'),
                    confidence=p.get('confidence', 0.0),
                    tempo_category=p.get('dance_tempo'),
                    bpm_multiplier=p.get('multiplier', 1.0),
                    effective_bpm=p.get('effective_bpm', 0),
                    is_user_confirmed=False # AI predictions are never confirmed by default
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
        """
        print("🔄 Re-evaluating library with new intelligence...")
        
        # 1. Get all tracks that have analysis data
        # We join AnalysisSource to ensure they are ready to process
        tracks = (self.db.query(Track)
                  .join(AnalysisSource)
                  .filter(AnalysisSource.source_type == 'hybrid_ml_v2')
                  .all())
        
        updated_count = 0
        skipped_count = 0
        
        for track in tracks:
            # --- THE SAFETY LOCK ---
            # Check if a human has touched this track.
            # If ANY style associated with this track is confirmed, we skip it.
            is_locked = any(s.is_user_confirmed for s in track.dance_styles)
            
            if is_locked:
                skipped_count += 1
                continue # Do not touch user data!

            # --- THE RE-CLASSIFICATION ---
            # If we are here, the track is "AI Managed".
            # We don't care what it WAS (Polska, Unknown, etc).
            # We want to know what it IS NOW according to the new Brain.

            source = next((s for s in track.analysis_sources if s.source_type == 'hybrid_ml_v2'), None)
            if not source: continue

            # 1. Ask the Brain (It will use the updated .pkl model automatically)
            predictions = self.classifier.classify(track, source.raw_data)
            
            # 2. Save (This wipes the old unconfirmed styles and adds the new ones)
            self._save_predictions(track, predictions)
            
            updated_count += 1
            
        print(f"✅ Re-classification complete.")
        print(f"   - Updated: {updated_count} tracks (AI refined)")
        print(f"   - Skipped: {skipped_count} tracks (User locked)")

    def classify_track_immediately(self, track: Track):
        """
        Classifies a specific track instance immediately.
        Used by AnalysisService to chain the pipeline.
        """
        # 1. Check if user locked it (Safety check)
        # We access the relationship directly. 
        # Note: If it's a fresh analysis, there probably aren't styles yet, but good to be safe.
        for style in track.dance_styles:
            if style.is_user_confirmed:
                print(f"   🔒 Skipping {track.title} (User Confirmed)")
                return

        # 2. Get Analysis Data
        # We assume the analysis was JUST saved, so it's there.
        source = next((s for s in track.analysis_sources if s.source_type == 'hybrid_ml_v2'), None)
        
        if not source or not source.raw_data:
            print(f"   ⚠️ No analysis data found for {track.title}")
            return

        # 3. Update Vocals flag (Descriptive)
        is_instrumental = source.raw_data.get('is_likely_instrumental', True)
        track.has_vocals = not is_instrumental
        self.db.add(track)

        # 4. Run The Brain
        predictions = self.classifier.classify(track, source.raw_data)

        # 5. Save
        self._save_predictions(track, predictions)
        
        # Logging
        primary = predictions[0]
        print(f"   ✅ Classified: {primary['style']} ({primary['dance_tempo']})")