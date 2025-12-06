from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.models import DanceMovementFeedback

class MovementManager:
    # 1. THE SEED DATA (Your "Best Guess" defaults)
    # Used only if the database is empty or has low confidence.
    SEEDS = {
        "Hambo": ["Sviktande", "Gungande", "Tungt"],
        "Schottis": ["Sviktande", "Drivande", "Kantig"],
        "Snoa": ["Platt", "Drivande", "Jämn"],
        "Vals": ["Flytande", "Lätt", "Mjuk"],
        "Polka": ["Studsigt", "Drivande", "Snabbt"],
        "Slängpolska": ["Flytande", "Jämn", "Oändlig"],
        "Polska": ["Tungt", "Hängande", "Mustigt"] # Generic Polska
    }

    def __init__(self, db: Session):
        self.db = db

    def get_feel_profile(self, dance_style: str) -> list[dict]:
        """
        Returns the current 'Crowd Wisdom' for a dance style.
        Returns: [{"tag": "Sviktande", "score": 0.85}, ...]
        """
        # A. Check Database first
        records = self.db.query(DanceMovementFeedback).filter(
            DanceMovementFeedback.dance_style == dance_style
        ).order_by(DanceMovementFeedback.score.desc()).all()

        # B. COLD START CHECK
        # If we have less than 5 votes total, mix in the Seeds so the UI isn't empty.
        total_votes = sum(r.occurrences for r in records)
        
        if total_votes < 5:
            return self._mix_seeds_with_data(dance_style, records)

        # C. Return Normalized Data
        return [
            {
                "tag": r.movement_tag,
                "percent": int((r.score / total_votes) * 100),
                "is_dominant": (r.score / total_votes) > 0.4 # Flag if it's a defining trait
            }
            for r in records
        ]

    def register_feedback(self, dance_style: str, selected_tags: list[str]):
        """
        The Learning Function. Call this when user submits feedback.
        """
        for tag in selected_tags:
            # 1. Find existing record or create new
            record = self.db.query(DanceMovementFeedback).filter(
                DanceMovementFeedback.dance_style == dance_style,
                DanceMovementFeedback.movement_tag == tag
            ).first()

            if not record:
                record = DanceMovementFeedback(
                    dance_style=dance_style, 
                    movement_tag=tag, 
                    score=0, 
                    occurrences=0
                )
                self.db.add(record)

            # 2. Update Weights
            # Simple addition model. You could make recent votes worth more later.
            record.score += 1.0
            record.occurrences += 1
        
        self.db.commit()

    def _mix_seeds_with_data(self, style, records):
        """Helper to return hardcoded seeds if DB is cold."""
        defaults = self.SEEDS.get(style, ["Odefinierad"])
        
        # Convert DB records to simple dict
        db_data = {r.movement_tag: r.score for r in records}
        
        result = []
        for tag in defaults:
            # If DB has data, use it, otherwise give it a 'fake' starting score
            score = db_data.get(tag, 10.0) 
            result.append({"tag": tag, "percent": 0, "status": "seed"})
            
        return result