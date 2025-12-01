from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.models import Track, TrackFeedback, TrackDanceStyle, AnalysisSource
from app.core.music_theory import categorize_tempo

class FeedbackService:
    def __init__(self, db: Session):
        self.db = db

    def process_feedback(self, track_id: str, style: str, tempo_correction: str):
        """
        1. Records user input.
        2. Cleans up incorrect AI guesses.
        3. Recalculates the Primary Style based on popular vote.
        """
        track = self.db.query(Track).filter(Track.id == track_id).first()
        if not track:
            return False

        # --- STEP 1: RECORD VOTE (History) ---
        # We assume every feedback submission is a "Vote" for that style/tempo combo
        new_fb = TrackFeedback(
            track_id=track.id,
            suggested_style=style,
            tempo_correction=tempo_correction
        )
        self.db.add(new_fb)
        self.db.flush() # Save so we can count it in the election immediately

        # --- STEP 2: CALCULATE METRICS (For the new entry) ---
        # We need to know what the new style row *would* look like
        new_multiplier = 1.0
        if tempo_correction == "half": new_multiplier = 0.5
        elif tempo_correction == "double": new_multiplier = 2.0
        
        source = next((s for s in track.analysis_sources if s.source_type == 'hybrid_ml_v2'), None)
        raw_bpm = source.raw_data.get('tempo_bpm', 0) if source else 0
        effective_bpm = int(raw_bpm * new_multiplier)
        category = categorize_tempo(style, effective_bpm)

        # --- STEP 3: PURGE AI GUESSES ---
        # If a human has spoken, AI guesses for *other* styles are now irrelevant noise.
        # Delete unconfirmed styles that contradict the current vote.
        self.db.query(TrackDanceStyle).filter(
            TrackDanceStyle.track_id == track.id,
            TrackDanceStyle.dance_style != style,
            TrackDanceStyle.is_user_confirmed == False
        ).delete(synchronize_session=False)

        # --- STEP 4: UPSERT THE STYLE ROW ---
        # Ensure a row exists for this specific style so it can be a candidate
        style_row = self.db.query(TrackDanceStyle).filter(
            TrackDanceStyle.track_id == track.id,
            TrackDanceStyle.dance_style == style
        ).first()

        if style_row:
            # Update existing (Refine tempo/confidence)
            style_row.bpm_multiplier = new_multiplier
            style_row.effective_bpm = effective_bpm
            style_row.tempo_category = category
            style_row.is_user_confirmed = True
            style_row.confidence = 1.0 
        else:
            # Create new candidate
            style_row = TrackDanceStyle(
                track_id=track.id,
                dance_style=style,
                is_primary=False, # We decide primary in Step 5
                bpm_multiplier=new_multiplier,
                effective_bpm=effective_bpm,
                tempo_category=category,
                is_user_confirmed=True,
                confidence=1.0
            )
            self.db.add(style_row)
        
        self.db.flush() # Ensure row exists for the election

        # --- STEP 5: THE ELECTION (Determine Primary) ---
        self._elect_primary_style(track.id)

        self.db.commit()
        return True

    def _elect_primary_style(self, track_id: str):
        """
        Counts votes in TrackFeedback.
        The style with the most votes becomes Primary.
        Ties are broken by recency (latest vote wins).
        """
        # 1. Count votes per style
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

        # The winner is the first result (highest count)
        winning_style = vote_counts[0].suggested_style

        # 2. Reset everyone to Secondary
        self.db.query(TrackDanceStyle).filter(
            TrackDanceStyle.track_id == track_id
        ).update({"is_primary": False})

        # 3. Crown the King
        self.db.query(TrackDanceStyle).filter(
            TrackDanceStyle.track_id == track_id,
            TrackDanceStyle.dance_style == winning_style
        ).update({"is_primary": True})