from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.models import Track, TrackFeedback, TrackDanceStyle, AnalysisSource
from app.core.music_theory import categorize_tempo
import numpy as np

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
            is_agreement = (
                style_row.bpm_multiplier == new_multiplier and 
                style_row.is_user_confirmed
            )

            style_row.is_primary = True
            style_row.bpm_multiplier = new_multiplier
            style_row.effective_bpm = effective_bpm
            style_row.tempo_category = category
            style_row.is_user_confirmed = True
            style_row.confidence = 1.0
            
            if is_agreement:
                style_row.confirmation_count += 1
            else:
                # If they changed the speed or revived a dead style, reset count to 1 (the current user)
                style_row.confirmation_count = 1
                
            self.db.add(style_row)
        else:
            style_row = TrackDanceStyle(
                track_id=track.id,
                dance_style=style,
                is_primary=False, 
                bpm_multiplier=new_multiplier,
                effective_bpm=effective_bpm,
                tempo_category=category,
                is_user_confirmed=True,
                confidence=1.0,
                confirmation_count=1
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

    def process_structure_feedback(self, track_id: str, bars: list[float] = None, sections: list[float] = None, labels: list[str] = None) -> bool:
        """
        Handles structural corrections (Grid, Sections, Labels).
        Strategy: Immediate Update + History Log.
        """
        track = self.db.query(Track).filter(Track.id == track_id).first()
        if not track:
            return False

        # 1. SAVE HISTORY (The Golden Dataset)
        # We create a feedback entry to record WHO changed WHAT.
        # (If you add user_id later, this becomes an audit log)
        new_fb = TrackFeedback(
            track_id=track.id,
            # We reuse the existing model but populate structural fields
            corrected_bars=bars,
            corrected_sections=sections,
            corrected_section_labels=labels
            # suggested_style/tempo left null
        )
        self.db.add(new_fb)

        # 2. APPLY UPDATES (Live Correction)
        # If the user provided new data, we overwrite the Track's current state.
        # We trust the human editor over the AI or previous state.
        
        if bars:
            # If bars are provided (e.g. from Tap-to-Beat), we might want to 
            # linearize them (fix jitter) before saving.
            cleaned_bars = self._linearize_bars(bars, track.duration_ms)
            track.bars = cleaned_bars
            
        if sections:
            track.sections = sections
            
        if labels:
            track.section_labels = labels

        self.db.commit()
        return True

    def _linearize_bars(self, raw_taps: list[float], duration_ms: int) -> list[float]:
        """
        Takes messy human taps and returns a mathematically perfect grid.
        """
        if not raw_taps or len(raw_taps) < 2:
            return raw_taps

        # Linear Regression: y = mx + c
        x = np.arange(len(raw_taps))
        y = np.array(raw_taps)
        m, c = np.polyfit(x, y, 1) # m = seconds/bar, c = start offset

        # Generate full grid
        duration_sec = (duration_ms or 0) / 1000
        if duration_sec == 0: duration_sec = raw_taps[-1] + 10 # Fallback

        new_bars = []
        current = c
        while current < duration_sec:
            if current >= 0:
                new_bars.append(round(current, 3)) # Round for cleaner JSON
            current += m
            
        return new_bars
    
def reset_track_structure(self, track_id: str) -> dict | None:
        """
        1. Reverts Track to AI defaults.
        2. Marks all previous user structural edits as REJECTED.
        """
        track = self.db.query(Track).filter(Track.id == track_id).first()
        if not track: return None
        
        # 1. Fetch original AI data
        source = next((s for s in track.analysis_sources if s.source_type == 'hybrid_ml_v2'), None)
        if not source or not source.raw_data:
            return None

        original_bars = source.raw_data.get('bars')
        original_sections = source.raw_data.get('sections')
        original_labels = source.raw_data.get('section_labels')

        # 2. MARK HISTORY AS REJECTED
        # We find any feedback that touched the structure and mark it as 'bad'
        self.db.query(TrackFeedback).filter(
            TrackFeedback.track_id == track.id,
            TrackFeedback.is_rejected == False, # Only touch currently valid ones
            # Check if they touched bars OR sections
            or_(
                TrackFeedback.corrected_bars.isnot(None), 
                TrackFeedback.corrected_sections.isnot(None)
            )
        ).update({"is_rejected": True})

        # 3. RESTORE TRACK STATE
        track.bars = original_bars
        track.sections = original_sections
        track.section_labels = original_labels
        
        # 4. LOG THE RESET ACTION
        # We create a new row saying "System Reset", which acts as the new "Head" of history
        reset_log = TrackFeedback(
            track_id=track.id,
            tempo_correction="reset_structure",
            suggested_style="System Reset",
            corrected_bars=original_bars,
            corrected_sections=original_sections,
            corrected_section_labels=original_labels,
            is_rejected=False # This is a valid action
        )
        
        self.db.add(reset_log)
        self.db.add(track)
        self.db.commit()
        
        return {
            "bars": original_bars,
            "sections": original_sections,
            "section_labels": original_labels
        }