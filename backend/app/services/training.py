from sqlalchemy.orm import Session
from app.core.models import Track, TrackFeedback, AnalysisSource
from app.workers.audio.style_head import ClassificationHead

class TrainingService:
    def __init__(self, db: Session):
        self.db = db
        self.head = ClassificationHead() # Load the worker

    def train_from_feedback(self, min_examples: int = 5) -> bool:
        """
        Fetches user feedback, formats it for the AI, and triggers training.
        Returns True if training happened, False otherwise.
        """
        print("🧠 Training Service: Gathering feedback...")

        # 1. Query the 'Golden Data'
        # We need tracks that have BOTH user feedback AND an analysis embedding
        feedback_rows = (
            self.db.query(TrackFeedback, AnalysisSource)
            .join(Track, TrackFeedback.track_id == Track.id)
            .join(AnalysisSource, AnalysisSource.track_id == Track.id)
            .filter(AnalysisSource.source_type == 'hybrid_ml_v2')
            .all()
        )

        # 2. Extract Features (X) and Labels (y)
        embeddings = []
        labels = []

        for fb, analysis in feedback_rows:
            emb = analysis.raw_data.get('embedding')
            if emb:
                embeddings.append(emb)
                labels.append(fb.suggested_style)

        count = len(labels)
        print(f"   Found {count} valid feedback examples.")

        # 3. Train the Worker
        if count >= min_examples:
            self.head.train(embeddings, labels)
            return True
        else:
            print(f"   ⚠️ Not enough data to train ({count}/{min_examples} needed).")
            return False