from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.models import Track, TrackFeedback, TrackDanceStyle, AnalysisSource
from app.core.music_theory import categorize_tempo

class FeedbackService:
    def __init__(self, db: Session):
        self.db = db

    def process_feedback(self, track_id: str, style: str, tempo_correction: str) -> dict | None:
        """
        1. Records user input.
        2. Purges AI guesses.
        3. Elects new Primary style based on votes.
        4. Returns the NEW Primary data for the frontend.
        """
        track = self.db.query(Track).filter(Track.id == track_id).first()
        if not track:
            return None

        # --- STEP 1: RECORD VOTE ---
        new_fb = TrackFeedback(
            track_id=track.id,
            suggested_style=style,
            tempo_correction=tempo_correction
        )
        self.db.add(new_fb)
        self.db.flush()

        # --- STEP 2: CALCULATE METRICS ---
        new_multiplier = 1.0
        if tempo_correction == "half": new_multiplier = 0.5
        elif tempo_correction == "double": new_multiplier = 2.0
        
        source = next((s for s in track.analysis_sources if s.source_type == 'hybrid_ml_v2'), None)
        raw_bpm = source.raw_data.get('tempo_bpm', 0) if source else 0
        effective_bpm = int(raw_bpm * new_multiplier)
        category = categorize_tempo(style, effective_bpm)

        # --- STEP 3: PURGE AI GUESSES ---
        # Delete unconfirmed styles that contradict the current vote
        self.db.query(TrackDanceStyle).filter(
            TrackDanceStyle.track_id == track.id,
            TrackDanceStyle.dance_style != style,
            TrackDanceStyle.is_user_confirmed == False
        ).delete(synchronize_session=False)

        # --- STEP 4: UPSERT CANDIDATE ROW ---
        style_row = self.db.query(TrackDanceStyle).filter(
            TrackDanceStyle.track_id == track.id,
            TrackDanceStyle.dance_style == style
        ).first()

        if style_row:
            style_row.bpm_multiplier = new_multiplier
            style_row.effective_bpm = effective_bpm
            style_row.tempo_category = category
            style_row.is_user_confirmed = True
            style_row.confidence = 1.0 
        else:
            style_row = TrackDanceStyle(
                track_id=track.id,
                dance_style=style,
                is_primary=False, 
                bpm_multiplier=new_multiplier,
                effective_bpm=effective_bpm,
                tempo_category=category,
                is_user_confirmed=True,
                confidence=1.0
            )
            self.db.add(style_row)
        
        self.db.flush()

        # --- STEP 5: THE ELECTION ---
        self._elect_primary_style(track.id)
        
        # Commit to save everything
        self.db.commit()

        # --- STEP 6: FETCH THE WINNER ---
        # We query the DB for the new Primary row to send back to the frontend.
        # This ensures the UI reflects exactly what the database decided.
        winner = self.db.query(TrackDanceStyle).filter(
            TrackDanceStyle.track_id == track.id,
            TrackDanceStyle.is_primary == True
        ).first()

        if winner:
            return {
                "dance_style": winner.dance_style,
                "effective_bpm": winner.effective_bpm,
                "tempo_category": winner.tempo_category,
                "style_confidence": 1.0,
                "bpm_multiplier": winner.bpm_multiplier
            }
        
        return None

    def _elect_primary_style(self, track_id: str):
        """
        Sets is_primary=True for the style with the most votes.
        """
        vote_counts = (
            self.db.query(
                TrackFeedback.suggested_style, 
                func.count(TrackFeedback.id).label('count')
            )
            .filter(TrackFeedback.track_id == track_id)
            .group_by(TrackFeedback.suggested_style)
            .order_by(func.count(TrackFeedback.id).desc())
            .all()
        )

        if not vote_counts:
            return

        winning_style = vote_counts[0].suggested_style

        # Reset all to Secondary
        self.db.query(TrackDanceStyle).filter(
            TrackDanceStyle.track_id == track_id
        ).update({"is_primary": False})

        # Set Winner to Primary
        self.db.query(TrackDanceStyle).filter(
            TrackDanceStyle.track_id == track_id,
            TrackDanceStyle.dance_style == winning_style
        ).update({"is_primary": True})