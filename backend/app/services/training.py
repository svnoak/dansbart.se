from sqlalchemy.orm import Session
from app.core.models import Track, TrackDanceStyle, AnalysisSource
from app.workers.audio.style_head import ClassificationHead

class TrainingService:
    def __init__(self, db: Session):
        self.db = db
        self.head = ClassificationHead()

    def train_from_feedback(self, min_confirmations: int = 1) -> bool:
        """
        Trains the brain using ONLY tracks that meet the consensus threshold.
        
        Args:
            min_confirmations: How many humans must agree before the AI learns from it?
                               Set to 1 for now (Speed). Set to 3 later (Quality).
        """
        print(f"🧠 Training Service: Looking for tracks with >= {min_confirmations} confirmations...")

        # 1. QUERY THE WINNERS
        query = (self.db.query(TrackDanceStyle, AnalysisSource)
                 .join(Track, TrackDanceStyle.track_id == Track.id)
                 .join(AnalysisSource, AnalysisSource.track_id == Track.id)
                 .filter(AnalysisSource.source_type == 'hybrid_ml_v2')
                 .filter(TrackDanceStyle.is_primary == True)           # Only learn from the winner
                 .filter(TrackDanceStyle.is_user_confirmed == True)    # Only humans
                 .filter(TrackDanceStyle.confirmation_count >= min_confirmations)
        )
        
        results = query.all()

        if not results:
            print("   ⚠️ Not enough confirmed data to train yet.")
            return False

        embeddings = []
        labels = []

        for style_row, analysis in results:
            emb = analysis.raw_data.get('embedding')
            if emb:
                embeddings.append(emb)
                labels.append(style_row.dance_style)

        # 2. TRAIN
        count = len(labels)
        print(f"   found {count} high-quality examples.")
        
        # We need at least a few classes to train a classifier
        if count >= 5: 
            self.head.train(embeddings, labels)
            return True
        
        return False