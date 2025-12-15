from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from app.core.models import Track, TrackStyleVote, TrackDanceStyle, TrackStructureVersion, DanceMovementFeedback, TrackFeelVote, StyleKeyword
from app.core.music_theory import categorize_tempo
import uuid

class FeedbackService:
    def __init__(self, db: Session):
        self.db = db

    # =========================================================================
    #  PART 1: STYLE VOTING (Genre & Tempo)
    # =========================================================================

    def _resolve_style_hierarchy(self, input_style: str) -> tuple[str, str | None]:
        """
        Takes user input (e.g. "Reinländer", "Polska", "boda")
        Returns (MainStyle, SubStyle) tuple.
        Example: "Reinländer" -> ("Schottis", "Reinländer")
        Example: "Schottis" -> ("Schottis", None)
        """
        if not input_style:
            return ("Unknown", None)

        # 1. Check if input matches a specific Sub-Style in definitions
        # We look for where sub_style matches, OR where keyword matches
        match = self.db.query(StyleKeyword).filter(
            or_(
                StyleKeyword.sub_style.ilike(input_style),
                StyleKeyword.keyword.ilike(input_style),
                StyleKeyword.main_style.ilike(input_style)
            )
        ).first()

        if match:
            # If the input matches a Sub-Style explicitly (e.g. "Reinländer")
            if match.sub_style and match.sub_style.lower() == input_style.lower():
                return (match.main_style, match.sub_style)
            
            # If input is the Main Style (e.g. "Schottis")
            if match.main_style.lower() == input_style.lower():
                return (match.main_style, None)
                
            # If it matched a keyword (e.g. "rheinlender" -> Reinländer)
            if match.sub_style:
                return (match.main_style, match.sub_style)
            return (match.main_style, None)

        # Fallback: Assume it's a new Main Style if we don't know it
        return (input_style, None)

    def process_feedback(
        self, 
        track_id: str, 
        style: str, 
        tempo_correction: str, 
        tempo_category: str | None = None, 
        explicit_main_style: str | None = None
    ) -> dict | None:
        track = self.db.query(Track).filter(Track.id == track_id).first()
        if not track: return None

        # --- STEP 0: DETERMINE HIERARCHY ---
        # 1. If Frontend sent specific hierarchy, trust it.
        if explicit_main_style:
            final_main = explicit_main_style
            # If the style name equals the main name, it's a generic vote (Sub is None)
            # If they differ (Main="Schottis", Style="Reinländer"), then Sub="Reinländer"
            final_sub = style if style.lower() != explicit_main_style.lower() else None
        else:
            # 2. Fallback to the old guessing logic (for older app versions or API calls)
            final_main, final_sub = self._resolve_style_hierarchy(style)

        # Vote string is specific: "Reinländer"
        vote_string = final_sub if final_sub else final_main

        # --- STEP 1: RECORD VOTE ---
        # We record exactly what was clicked
        new_vote = TrackStyleVote(
            track_id=track.id,
            suggested_style=vote_string, 
            tempo_correction=tempo_correction
        )
        self.db.add(new_vote)
        self.db.flush()

        # --- STEP 2: CALCULATE METRICS ---
        new_multiplier = 1.0
        if tempo_correction == "half": new_multiplier = 0.5
        elif tempo_correction == "double": new_multiplier = 2.0
        
        source = next((s for s in track.analysis_sources if s.source_type == 'hybrid_ml_v2'), None)
        raw_bpm = source.raw_data.get('tempo_bpm', 0) if source else 0
        effective_bpm = int(raw_bpm * new_multiplier)
        
        if tempo_category and tempo_category in ("Slow", "Medium", "Fast", "Turbo"):
            category = tempo_category
        else:
            category = categorize_tempo(final_main, effective_bpm)

        # --- STEP 3: UPSERT TRACK DANCE STYLE ROW ---
        # Search using BOTH Main and Sub columns
        query_filters = [
            TrackDanceStyle.track_id == track.id,
            TrackDanceStyle.dance_style == final_main # e.g. "Schottis"
        ]
        
        if final_sub:
            query_filters.append(TrackDanceStyle.sub_style == final_sub) # e.g. "Reinländer"
        else:
            query_filters.append(TrackDanceStyle.sub_style == None)

        style_row = self.db.query(TrackDanceStyle).filter(*query_filters).first()

        if style_row:
            is_agreement = (
                style_row.bpm_multiplier == new_multiplier and 
                style_row.is_user_confirmed
            )
            # Update existing
            style_row.bpm_multiplier = new_multiplier
            style_row.effective_bpm = effective_bpm
            style_row.tempo_category = category
            style_row.is_user_confirmed = True
            style_row.confidence = 1.0
            
            if is_agreement:
                style_row.confirmation_count += 1
            else:
                style_row.confirmation_count = 1
        else:
            # Create new
            style_row = TrackDanceStyle(
                track_id=track.id,
                dance_style=final_main,  # Correctly saves "Schottis"
                sub_style=final_sub,     # Correctly saves "Reinländer"
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

        # --- STEP 4: PURGE CONFLICTING AI GUESSES ---
        # If confirmed as "Schottis", remove unconfirmed "Polska"
        self.db.query(TrackDanceStyle).filter(
            TrackDanceStyle.track_id == track.id,
            TrackDanceStyle.dance_style != final_main,
            TrackDanceStyle.is_user_confirmed == False
        ).delete(synchronize_session=False)

        # --- STEP 5: RUN ELECTION ---
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
                "sub_style": winner.sub_style,
                "effective_bpm": winner.effective_bpm,
                "tempo_category": winner.tempo_category,
                "style_confidence": 1.0,
                "bpm_multiplier": winner.bpm_multiplier
            }
        
        return None

    def _elect_primary_style(self, track_id: str):
        """
        Sets is_primary=True for the style with the most votes.
        Handles mapping vote strings back to (Main, Sub) rows.
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

        # Winner is a string like "Reinländer" or "Schottis"
        winning_string = vote_counts[0].suggested_style
        
        # Resolve it back to Main/Sub to find the correct row
        win_main, win_sub = self._resolve_style_hierarchy(winning_string)

        # Reset all
        self.db.query(TrackDanceStyle).filter(
            TrackDanceStyle.track_id == track_id
        ).update({"is_primary": False})

        # Set winner
        # We need to match exactly (Main, Sub) OR (Main, None) depending on what won
        filters = [
            TrackDanceStyle.track_id == track_id,
            TrackDanceStyle.dance_style == win_main
        ]
        
        if win_sub:
            filters.append(TrackDanceStyle.sub_style == win_sub)
        else:
            filters.append(TrackDanceStyle.sub_style == None)

        self.db.query(TrackDanceStyle).filter(*filters).update({"is_primary": True})

    def confirm_secondary_style(self, track_id: str, style: str) -> dict | None:
        track = self.db.query(Track).filter(Track.id == track_id).first()
        if not track: return None
        
        # Normalize input to find correct row
        main, sub = self._resolve_style_hierarchy(style)
        
        filters = [
            TrackDanceStyle.track_id == track.id,
            TrackDanceStyle.dance_style == main
        ]
        if sub: filters.append(TrackDanceStyle.sub_style == sub)
        else: filters.append(TrackDanceStyle.sub_style == None)

        style_row = self.db.query(TrackDanceStyle).filter(*filters).first()

        if not style_row: return None

        style_row.confirmation_count += 1
        style_row.is_user_confirmed = True
        self.db.commit()

        # Build display string
        display_style = style_row.sub_style if style_row.sub_style else style_row.dance_style
        return {"style": display_style, "confirmations": style_row.confirmation_count}

    def create_structure_version(self, track_id: str, bars: list = None, sections: list = None, labels: list = None, description: str = None, author_alias: str = None):
        track = self.db.query(Track).filter(Track.id == track_id).first()
        if not track: return None
        cleaned_bars = bars
        if bars: cleaned_bars = self._linearize_bars(bars, track.duration_ms)
        final_bars = cleaned_bars if cleaned_bars is not None else track.bars
        final_sections = sections if sections is not None else track.sections
        final_labels = labels if labels is not None else track.section_labels
        snapshot_data = { "bars": final_bars, "sections": final_sections, "labels": final_labels }
        final_alias = author_alias if author_alias and author_alias.strip() else "Anonym Användare"
        new_version = TrackStructureVersion(
            track_id=track.id, description=description or "Användarkorrigering",
            structure_data=snapshot_data, vote_count=1, is_active=False, author_alias=final_alias
        )
        self.db.add(new_version)
        self.db.commit()
        self.db.refresh(new_version)
        self._run_structure_election(track.id)
        return new_version

    def vote_on_structure(self, version_id: str, vote_type: str):
        version = self.db.query(TrackStructureVersion).filter(TrackStructureVersion.id == version_id).first()
        if not version: return None
        if vote_type == "up": version.vote_count += 1
        elif vote_type == "down": version.vote_count -= 1
        self.db.commit()
        self._run_structure_election(version.track_id)
        return {"new_score": version.vote_count, "is_active": version.is_active}

    def report_structure(self, version_id: str):
        version = self.db.query(TrackStructureVersion).filter(TrackStructureVersion.id == version_id).first()
        if not version: return
        version.report_count += 1
        if version.report_count >= 5:
            version.is_hidden = True
            if version.is_active:
                version.is_active = False
                self.db.commit()
                self._run_structure_election(version.track_id)
        self.db.commit()

    def _run_structure_election(self, track_id: uuid.UUID):
        candidates = (
            self.db.query(TrackStructureVersion)
            .filter(TrackStructureVersion.track_id == track_id, TrackStructureVersion.is_hidden == False)
            .order_by(TrackStructureVersion.vote_count.desc(), TrackStructureVersion.created_at.desc())
            .all()
        )
        if not candidates: return
        winner = candidates[0]
        if not winner.is_active:
            self.db.query(TrackStructureVersion).filter(TrackStructureVersion.track_id == track_id).update({"is_active": False})
            winner.is_active = True
            track = self.db.query(Track).filter(Track.id == track_id).first()
            if track:
                data = winner.structure_data
                track.bars = data.get("bars")
                track.sections = data.get("sections")
                track.section_labels = data.get("labels")
            self.db.commit()

    def _linearize_bars(self, raw_taps: list[float], duration_ms: int) -> list[float]:
        if not raw_taps or len(raw_taps) < 2: return raw_taps
        n = len(raw_taps)
        sum_x = sum(range(n))
        sum_y = sum(raw_taps)
        sum_xy = sum(i * raw_taps[i] for i in range(n))
        sum_x2 = sum(i * i for i in range(n))
        m = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x * sum_x)
        c = (sum_y - m * sum_x) / n
        duration_sec = (duration_ms or 0) / 1000
        if duration_sec == 0: duration_sec = raw_taps[-1] + 10
        new_bars = []
        current = c
        while current < duration_sec:
            if current >= 0: new_bars.append(round(current, 3))
            current += m
        return new_bars

    def process_movement_feedback(self, track_id: str, style: str, tags: list[str]):
        track = self.db.query(Track).filter(Track.id == track_id).first()
        if not track: return False
        for tag in tags:
            vote = TrackFeelVote(track_id=track.id, feel_tag=tag)
            self.db.add(vote)
        for tag in tags:
            global_stat = self.db.query(DanceMovementFeedback).filter(
                DanceMovementFeedback.dance_style == style, DanceMovementFeedback.movement_tag == tag
            ).first()
            if not global_stat:
                global_stat = DanceMovementFeedback(dance_style=style, movement_tag=tag, score=0, occurrences=0)
                self.db.add(global_stat)
            global_stat.score += 10
            global_stat.occurrences += 1
        self.db.commit()
        return True