from sqlalchemy.orm import Session
from app.core.models import StyleKeyword, DanceMovementFeedback, TrackDanceStyle
from app.core.music_theory import get_tempo_description
from app.repository.track import TrackRepository

class TrackService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = TrackRepository(db)

    def get_style_hierarchy(self):
        """
        Returns a tree of styles based on ACTUAL DATA in TrackDanceStyle.
        Now looks at both 'dance_style' (Main) and 'sub_style' (Sub).
        """
        # 1. Fetch all unique pairs of (Main, Sub) that exist in your DB
        used_combinations = (
            self.db.query(TrackDanceStyle.dance_style, TrackDanceStyle.sub_style)
            .filter(TrackDanceStyle.confidence > 0.5) # Filter out noise
            .distinct()
            .all()
        )
        
        # used_combinations will look like:
        # [('Schottis', 'Reinländer'), ('Polska', 'Pols'), ('Schottis', None)]

        hierarchy = {}
        
        for main, sub in used_combinations:
            if not main: continue
            
            # Initialize the list for this Main Category if new
            if main not in hierarchy:
                hierarchy[main] = set()
            
            # If a sub_style exists for this row, add it to the list
            if sub:
                hierarchy[main].add(sub)

        # 2. Sort lists for the frontend
        return {k: sorted(list(v)) for k, v in hierarchy.items()}

    def get_playable_tracks(
        self, 
        main_style: str = None,
        sub_style: str = None,
        style_confirmed: bool = False,
        min_bpm: int = None, 
        max_bpm: int = None, 
        min_tempo: int = None,
        max_tempo: int = None,
        search: str = None,
        source: str = None,
        vocals: str = None,
        min_duration: int = None,
        max_duration: int = None,
        limit: int = 20, 
        offset: int = 0
    ):
        """
        Fetches tracks for the feed.
        """
        
        # 1. PREPARE STYLE LOGIC
        exact_style = None
        allowed_styles = None
        
        if sub_style:
            # User wants a specific dance. Ignore Main Category logic.
            exact_style = sub_style
        
        elif main_style:
            # User wants a whole family.
            keywords = self.db.query(StyleKeyword).filter(
                StyleKeyword.main_style.ilike(main_style)
            ).all()
            
            style_set = {main_style} 
            for kw in keywords:
                if kw.sub_style: style_set.add(kw.sub_style)
                # Also add the keyword if it acts as a style name (e.g. "Rørospols")
                style_set.add(kw.keyword)
                
            allowed_styles = list(style_set)

        # 2. CALL REPO
        tracks, base_total = self.repo.search_playable_tracks(
            exact_style=exact_style,
            allowed_styles=allowed_styles,
            style_confirmed=style_confirmed,
            min_bpm=min_bpm,
            max_bpm=max_bpm,
            min_duration_ms=min_duration * 1000 if min_duration else None,
            max_duration_ms=max_duration * 1000 if max_duration else None,
            vocals=vocals,
            search=search,
            source=source,
            limit=limit,
            offset=offset
        )

        # 3. POST-PROCESSING (Tags, Formatting, Tempo Logic)
        
        # Gather styles for Tag Lookup
        visible_styles = set()
        for t in tracks:
            primary = next((s for s in t.dance_styles if s.is_primary), None)
            if primary: visible_styles.add(primary.dance_style)
        
        style_feel_map = self._get_global_feels(list(visible_styles))
        
        results = []
        filtered_count = 0

        for track in tracks:
            # Filter Broken Links
            valid_links = [l for l in track.playback_links if l.is_working]
            if not valid_links: continue

            # Determine Display Style
            primary_style = next((s for s in track.dance_styles if s.is_primary), None)
            matched_style = primary_style

            # Highlight specific style if filtered
            target_filter = sub_style or main_style
            if target_filter:
                specific = next((s for s in track.dance_styles if target_filter.lower() in s.dance_style.lower()), None)
                if specific: matched_style = specific

            # Map fields
            if matched_style:
                final_style = matched_style.dance_style
                final_sub_style = matched_style.sub_style
                final_bpm = matched_style.effective_bpm
                final_category = matched_style.tempo_category
                final_confidence = matched_style.confidence
                final_confirmations = matched_style.confirmation_count
                final_verifications = matched_style.is_user_confirmed
            else:
                final_style = "Unclassified"
                final_sub_style = None
                final_bpm = 0
                final_category = "Unknown"
                final_confidence = 0.0
                final_confirmations = 0
                final_verifications = False

            # Format Output
            sorted_artists = sorted(track.artist_links, key=lambda x: 0 if x.role == 'primary' else 1)
            artist_list = [{"id": l.artist.id, "name": l.artist.name, "role": l.role} for l in sorted_artists]

            album_data = None
            if track.album:
                album_data = {
                    "id": track.album.id,
                    "title": track.album.title
                }
            
            # Tags & Physics
            tags = self._refine_tags_with_physics(style_feel_map.get(final_style, []), track.bounciness)
            
            # Secondary Styles
            secondary_styles = [
                {
                    "style": s.dance_style, 
                    "sub_style": s.sub_style,
                    "effective_bpm": s.effective_bpm, 
                    "tempo": get_tempo_description(s.dance_style, s.effective_bpm),
                    "confirmations": s.confirmation_count
                }
                for s in track.dance_styles if not s.is_primary
            ]

            # Tempo Description
            tempo_data = get_tempo_description(final_style, final_bpm) if final_bpm else None

            # Post-Query Tempo Filtering (Level 1-5)
            if tempo_data and (min_tempo or max_tempo):
                lvl = tempo_data["level"]
                if (min_tempo and lvl < min_tempo) or (max_tempo and lvl > max_tempo):
                    filtered_count += 1
                    continue

            results.append({
                "id": str(track.id),
                "title": track.title,
                "artists": artist_list,
                "album": album_data,
                "dance_style": final_style,
                "sub_style": final_sub_style,
                "feel_tags": tags,
                "effective_bpm": final_bpm,
                "tempo": tempo_data,
                "tempo_category": final_category,
                "style_confidence": final_confidence,
                "is_user_confirmed": final_verifications,
                "style_confirmations": final_confirmations,
                "secondary_styles": secondary_styles,
                "swing_ratio": track.swing_ratio,
                "bounciness": track.bounciness,
                "has_vocals": track.has_vocals,
                "duration": track.duration_ms,
                "version_count": len(track.structure_versions),
                "playback_links": [{"id": str(l.id), "platform": l.platform, "deep_link": l.deep_link} for l in valid_links]
            })

        total_count = base_total - filtered_count if (min_tempo or max_tempo) else base_total

        # Sort: User Confirmed > High Confidence
        results.sort(key=lambda x: (not x["is_user_confirmed"], not x["style_confirmations"], -x["style_confidence"]))

        return {
            "items": results,
            "total": total_count,
            "limit": limit,
            "offset": offset,
            "has_more": offset + len(results) < total_count
        }

    # ==================== HELPER METHODS ====================

    def _get_global_feels(self, styles: list[str]) -> dict:
        """Returns: {'Hambo': ['Sviktande', 'Majestätisk'], ...}"""
        if not styles: return {}
        rows = (
            self.db.query(DanceMovementFeedback)
            .filter(DanceMovementFeedback.dance_style.in_(styles))
            .order_by(DanceMovementFeedback.score.desc())
            .all()
        )
        mapped = {}
        for r in rows:
            if r.dance_style not in mapped: mapped[r.dance_style] = []
            if len(mapped[r.dance_style]) < 3: mapped[r.dance_style].append(r.movement_tag)
        return mapped

    def _refine_tags_with_physics(self, global_tags: list[str], bounciness: float | None) -> list[str]:
        """Adjusts tags based on audio analysis (e.g. bounciness)."""
        if not bounciness: return global_tags
        tags = global_tags[:]
        
        # Physics Logic: Flat vs Bouncy
        if bounciness < 0.35 and "Studsigt" in tags:
            tags.remove("Studsigt")
            if "Flytande" not in tags: tags.append("Flytande")

        if bounciness > 0.65:
            if "Sviktande" in tags:
                tags.remove("Sviktande")
                tags.insert(0, "Sviktande")
        
        return tags[:3]