from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.core.models import Track, TrackStyleVote, TrackDanceStyle, TrackStructureVersion, DanceMovementFeedback, TrackFeelVote
from app.core.music_theory import categorize_tempo
import uuid

class FeedbackService:
    def __init__(self, db: Session):
        self.db = db

    # =========================================================================
    #  PART 1: STYLE VOTING (Genre & Tempo)
    # =========================================================================

    def process_feedback(self, track_id: str, style: str, tempo_correction: str, tempo_category: str | None = None) -> dict | None:
        """
        1. Records user input in TrackStyleVote.
        2. Purges unconfirmed AI guesses.
        3. Elects new Primary style based on vote counts.
        4. Returns the NEW Primary data for the frontend.
        
        Args:
            tempo_category: Direct category ("Slow", "Medium", "Fast", "Turbo") when no BPM available
        """
        track = self.db.query(Track).filter(Track.id == track_id).first()
        if not track:
            return None

        # --- STEP 1: RECORD VOTE ---
        new_vote = TrackStyleVote(
            track_id=track.id,
            suggested_style=style,
            tempo_correction=tempo_correction
        )
        self.db.add(new_vote)
        self.db.flush()

        # --- STEP 2: CALCULATE METRICS ---
        new_multiplier = 1.0
        if tempo_correction == "half": new_multiplier = 0.5
        elif tempo_correction == "double": new_multiplier = 2.0
        
        # Get raw BPM from analysis source (fallback logic)
        source = next((s for s in track.analysis_sources if s.source_type == 'hybrid_ml_v2'), None)
        raw_bpm = source.raw_data.get('tempo_bpm', 0) if source else 0
        effective_bpm = int(raw_bpm * new_multiplier)
        
        # Use direct tempo_category if provided (for tracks without BPM), otherwise calculate
        if tempo_category and tempo_category in ("Slow", "Medium", "Fast", "Turbo"):
            category = tempo_category
        else:
            category = categorize_tempo(style, effective_bpm)

        # --- STEP 3: PURGE UNCONFIRMED AI GUESSES ---
        # If users say "It's a Waltz", delete the unconfirmed "Cha Cha" guesses
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
                # Speed change or revival reset
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

        # --- STEP 5: RUN STYLE ELECTION ---
        self._elect_primary_style(track.id)
        
        self.db.commit()

        # --- STEP 6: RETURN WINNER ---
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

    def confirm_secondary_style(self, track_id: str, style: str) -> dict | None:
        """
        Confirms a secondary style WITHOUT affecting the primary election.
        This is used when users confirm "Can you also dance X?" - it should
        NOT change the primary style, only increment confirmation count.
        """
        track = self.db.query(Track).filter(Track.id == track_id).first()
        if not track:
            return None

        # Find the secondary style row
        style_row = self.db.query(TrackDanceStyle).filter(
            TrackDanceStyle.track_id == track.id,
            TrackDanceStyle.dance_style == style
        ).first()

        if not style_row:
            return None  # Style doesn't exist, nothing to confirm

        # Just increment confirmation count - don't touch is_primary or run election
        style_row.confirmation_count += 1
        style_row.is_user_confirmed = True
        
        self.db.commit()

        return {
            "style": style_row.dance_style,
            "confirmations": style_row.confirmation_count
        }

    def _elect_primary_style(self, track_id: str):
        """
        Sets is_primary=True for the dance style with the most votes.
        """
        vote_counts = (
            self.db.query(
                TrackStyleVote.suggested_style, 
                func.count(TrackStyleVote.id).label('count')
            )
            .filter(TrackStyleVote.track_id == track_id)
            .group_by(TrackStyleVote.suggested_style)
            .order_by(func.count(TrackStyleVote.id).desc())
            .all()
        )

        if not vote_counts:
            return

        winning_style = vote_counts[0].suggested_style

        self.db.query(TrackDanceStyle).filter(
            TrackDanceStyle.track_id == track_id
        ).update({"is_primary": False})

        self.db.query(TrackDanceStyle).filter(
            TrackDanceStyle.track_id == track_id,
            TrackDanceStyle.dance_style == winning_style
        ).update({"is_primary": True})


    # =========================================================================
    #  PART 2: STRUCTURE VERSIONING (Grid, Sections, Labels)
    # =========================================================================

    def create_structure_version(self, track_id: str, bars: list = None, sections: list = None, labels: list = None, description: str = None, author_alias: str = None):
        """
        Creates a new candidate version.
        If it's the first human edit, it usually becomes active immediately.
        """
        track = self.db.query(Track).filter(Track.id == track_id).first()
        if not track: return None

        # 1. Clean Data
        cleaned_bars = bars
        if bars:
            cleaned_bars = self._linearize_bars(bars, track.duration_ms)
        
        # Use existing track data if parts are missing (partial update)
        final_bars = cleaned_bars if cleaned_bars is not None else track.bars
        final_sections = sections if sections is not None else track.sections
        final_labels = labels if labels is not None else track.section_labels

        snapshot_data = {
            "bars": final_bars,
            "sections": final_sections,
            "labels": final_labels
        }

        final_alias = author_alias if author_alias and author_alias.strip() else "Anonym Användare"

        # 2. Create Version
        new_version = TrackStructureVersion(
            track_id=track.id,
            description=description or "Användarkorrigering",
            structure_data=snapshot_data,
            vote_count=1, # Creator's vote
            is_active=False, # Election will decide,
            author_alias=final_alias
        )
        self.db.add(new_version)
        self.db.commit()
        self.db.refresh(new_version)

        # 3. Trigger Election
        self._run_structure_election(track.id)
        
        return new_version

    def vote_on_structure(self, version_id: str, vote_type: str):
        """
        Upvote/Downvote a version. 
        """
        version = self.db.query(TrackStructureVersion).filter(TrackStructureVersion.id == version_id).first()
        if not version: return None

        if vote_type == "up":
            version.vote_count += 1
        elif vote_type == "down":
            version.vote_count -= 1
        
        self.db.commit()
        self._run_structure_election(version.track_id)

        return {"new_score": version.vote_count, "is_active": version.is_active}

    def report_structure(self, version_id: str):
        """
        Flags a version. Hides it if too many reports.
        """
        version = self.db.query(TrackStructureVersion).filter(TrackStructureVersion.id == version_id).first()
        if not version: return

        version.report_count += 1
        if version.report_count >= 5:
            version.is_hidden = True
            # If we hid the active one, we MUST elect a replacement
            if version.is_active:
                version.is_active = False
                self.db.commit() # Save state before running election
                self._run_structure_election(version.track_id)
        
        self.db.commit()

    def _run_structure_election(self, track_id: uuid.UUID):
        """
        Decides which version is the 'Truth'.
        Logic: The non-hidden version with the highest vote_count wins.
        """
        # 1. Find the winner
        candidates = (
            self.db.query(TrackStructureVersion)
            .filter(
                TrackStructureVersion.track_id == track_id,
                TrackStructureVersion.is_hidden == False
            )
            .order_by(TrackStructureVersion.vote_count.desc(), TrackStructureVersion.created_at.desc())
            .all()
        )

        if not candidates:
            return

        winner = candidates[0]

        # 2. Apply Winner if not already active
        if not winner.is_active:
            # Deactivate all
            self.db.query(TrackStructureVersion).filter(
                TrackStructureVersion.track_id == track_id
            ).update({"is_active": False})

            # Activate Winner
            winner.is_active = True
            
            # 3. FAST LOAD: Update the main Track table
            track = self.db.query(Track).filter(Track.id == track_id).first()
            if track:
                data = winner.structure_data
                track.bars = data.get("bars")
                track.sections = data.get("sections")
                track.section_labels = data.get("labels")

            self.db.commit()

    def _linearize_bars(self, raw_taps: list[float], duration_ms: int) -> list[float]:
        """
        Takes messy human taps and returns a mathematically perfect grid.
        Uses simple linear regression (least squares fit) without numpy.
        """
        if not raw_taps or len(raw_taps) < 2:
            return raw_taps

        # Simple linear regression: y = mx + c
        n = len(raw_taps)
        sum_x = sum(range(n))
        sum_y = sum(raw_taps)
        sum_xy = sum(i * raw_taps[i] for i in range(n))
        sum_x2 = sum(i * i for i in range(n))

        # Calculate slope (m) and intercept (c)
        m = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x * sum_x)
        c = (sum_y - m * sum_x) / n

        duration_sec = (duration_ms or 0) / 1000
        if duration_sec == 0: duration_sec = raw_taps[-1] + 10

        new_bars = []
        current = c
        while current < duration_sec:
            if current >= 0:
                new_bars.append(round(current, 3))
            current += m

        return new_bars
    

    # =========================================================================
    #  PART 3: MOVEMENT / FEEL VOTING (The "Smart Nudge")
    # =========================================================================

    def process_movement_feedback(self, track_id: str, style: str, tags: list[str]):
        """
        1. Logs the specific tags for this track (TrackFeelVote).
        2. Updates the Global Score for this Style (DanceMovementFeedback).
        """
        track = self.db.query(Track).filter(Track.id == track_id).first()
        if not track: return False

        # --- A. Record Individual Votes (For History/Reversion) ---
        for tag in tags:
            vote = TrackFeelVote(
                track_id=track.id,
                feel_tag=tag
            )
            self.db.add(vote)

        # --- B. Update The Global Brain (Self-Adjusting Weights) ---
        for tag in tags:
            # Check if this tag exists for this style
            global_stat = self.db.query(DanceMovementFeedback).filter(
                DanceMovementFeedback.dance_style == style,
                DanceMovementFeedback.movement_tag == tag
            ).first()

            if not global_stat:
                # New discovery! A user used a word we haven't seen for this style.
                global_stat = DanceMovementFeedback(
                    dance_style=style,
                    movement_tag=tag,
                    score=0,
                    occurrences=0
                )
                self.db.add(global_stat)
            
            # THE LEARNING MATH
            # You can tweak this. Current: Linear (+10 per vote).
            global_stat.score += 10
            global_stat.occurrences += 1

        self.db.commit()
        return True