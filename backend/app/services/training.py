from sqlalchemy.orm import Session
from app.core.models import Track, TrackDanceStyle, AnalysisSource
from neckenml.training import TrainingService as neckenmlTrainer
import numpy as np


class TrainingService:
    """
    Dansbart.se-specific training service that uses proprietary user feedback data
    to train the open-source neckenml classifier.
    """

    def __init__(self, db: Session):
        self.db = db
        self.trainer = neckenmlTrainer()

    def train_from_feedback(self, min_confirmations: int = 1) -> bool:
        """
        Trains the classifier using ONLY tracks that meet the consensus threshold.

        This is proprietary to dansbart.se - it uses the is_user_confirmed and
        confirmation_count fields to curate high-quality training data.

        Args:
            min_confirmations: How many users must confirm before the AI learns from it?
                               Set to 1 for speed, 3+ for quality.
        """
        print(f"🧠 Training Service: Looking for tracks with >= {min_confirmations} confirmations...")

        # 1. QUERY THE WINNERS (using dansbart.se-specific feedback fields)
        query = (
            self.db.query(TrackDanceStyle, AnalysisSource)
            .join(Track, TrackDanceStyle.track_id == Track.id)
            .join(AnalysisSource, AnalysisSource.track_id == Track.id)
            .filter(AnalysisSource.source_type == 'hybrid_ml_v2')
            .filter(TrackDanceStyle.is_primary == True)  # Only learn from the winner
            .filter(TrackDanceStyle.is_user_confirmed == True)  # Only humans (PROPRIETARY)
            .filter(TrackDanceStyle.confirmation_count >= min_confirmations)  # Consensus (PROPRIETARY)
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

        # 2. TRAIN using neckenml's generic trainer
        count = len(labels)
        print(f"   Found {count} high-quality examples from user feedback.")

        if count >= 5:
            # Use neckenml's training service with our proprietary data
            return self.trainer.train_from_data(
                embeddings=np.array(embeddings),
                labels=labels
            )

        return False