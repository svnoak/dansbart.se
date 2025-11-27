from sqlalchemy.orm import Session
from app.core.models import Track, AnalysisSource, TrackDanceStyle
from app.workers.synthesis.style_classifier import StyleClassifier

class ClassificationService:
    def __init__(self, db: Session):
        self.db = db
        self.classifier = StyleClassifier() # Instantiate the "Brain"

    def classify_pending_tracks(self, limit: int = 50, force_refresh: bool = False):
        """
        Orchestrates the classification process:
        1. Finds tracks with audio analysis.
        2. Runs the StyleClassifier.
        3. Saves Primary + Secondary styles to the DB.
        """
        print(f"🧠 Starting Batch Classification (Limit: {limit})...")
        
        # 1. Base Query: Tracks with 'hybrid_ml_v2' analysis data
        query = (self.db.query(Track)
                .join(AnalysisSource)
                .filter(AnalysisSource.source_type == 'hybrid_ml_v2'))
        
        # Optimization: If not forcing refresh, skip tracks that already have styles
        if not force_refresh:
            query = query.outerjoin(TrackDanceStyle).filter(TrackDanceStyle.id == None)
            
        tracks = query.limit(limit).all()

        if not tracks:
            print("   ✨ No pending tracks found to classify.")
            return

        count = 0
        for track in tracks:
            # 2. Get the Analysis Data
            # We grab the specific source we trust
            source = next((s for s in track.analysis_sources if s.source_type == 'hybrid_ml_v2'), None)
            
            if not source or not source.raw_data:
                continue

            # 3. RUN CLASSIFIER LOGIC
            # This returns a LIST of dicts (Primary + Secondaries)
            predictions = self.classifier.classify(track, source.raw_data)

            # 4. SAVE RESULTS
            self._save_predictions(track, predictions)
            
            # Logging for CLI
            primary = predictions[0] # Primary is always first
            print(f"   ✅ {track.title[:30]:<30} -> {primary['style']:<12} ({primary['dance_tempo']}) | Conf: {int(primary['confidence']*100)}%")
            count += 1

        print(f"🏁 Finished. Classified {count} tracks.")

    def _save_predictions(self, track, predictions):
        """
        Wipes old styles and saves new ones (Primary + Secondaries).
        """
        try:
            # A. Wipe existing styles for this track (Idempotency)
            # This ensures we don't duplicate tags if we re-run
            self.db.query(TrackDanceStyle).filter(TrackDanceStyle.track_id == track.id).delete()

            # B. Add new styles
            for p in predictions:
                new_style = TrackDanceStyle(
                    track_id=track.id,
                    
                    # Core Style Info
                    dance_style=p['style'],
                    is_primary=(p['type'] == 'Primary'),
                    confidence=p.get('confidence', 0.0),
                    tempo_category=p.get('dance_tempo'),
                    
                    # Dancer Math (BPM / Multiplier)
                    bpm_multiplier=p.get('multiplier', 1.0),
                    effective_bpm=p.get('effective_bpm', 0)
                )
                self.db.add(new_style)
            
            # Commit per track (so if one fails, previous ones are saved)
            self.db.commit()
            
        except Exception as e:
            self.db.rollback()
            print(f"   ❌ Error saving {track.title}: {e}")