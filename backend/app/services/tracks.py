from sqlalchemy.orm import Session, joinedload
from app.core.models import Track, TrackDanceStyle, TrackArtist, DanceMovementFeedback

class TrackService:
    def __init__(self, db: Session):
        self.db = db

    def get_playable_tracks(self, style: str = None, min_bpm: int = None, max_bpm: int = None):
        """
        Fetches tracks.
        - Filters out broken links.
        - Includes 'Unclassified' tracks if no specific style filter is applied.
        """
        
        # 1. BASE QUERY
        query = self.db.query(Track).outerjoin(Track.dance_styles)
        query = query.filter(Track.processing_status.in_(['DONE', 'FAILED']))

        # 2. APPLY FILTERS
        if style:
            query = query.filter(TrackDanceStyle.dance_style.ilike(style))
        
        if min_bpm:
            query = query.filter(TrackDanceStyle.effective_bpm >= min_bpm)
        
        if max_bpm:
            query = query.filter(TrackDanceStyle.effective_bpm <= max_bpm)

        # 3. OPTIMIZE LOADING (CRITICAL UPDATE)
        query = query.options(
            joinedload(Track.playback_links),
            joinedload(Track.dance_styles),
            joinedload(Track.structure_versions),
            
            # NEW: Eager load the Album
            joinedload(Track.album),
            
            # NEW: Eager load the Bridge Table -> Then the Artist
            # This ensures track.artist_links[0].artist is already loaded
            joinedload(Track.artist_links).joinedload(TrackArtist.artist)
        ).distinct()

        tracks = query.all()

        # Gather all unique styles currently visible in this list
        visible_styles = set()
        for t in tracks:
            primary = next((s for s in t.dance_styles if s.is_primary), None)
            if primary:
                visible_styles.add(primary.dance_style)
        
        # Fetch the top tags for these styles in ONE query
        style_feel_map = self._get_global_feels(list(visible_styles))

        results = []

        for track in tracks:
            # --- A. FILTER BROKEN LINKS ---
            valid_links = [l for l in track.playback_links if l.is_working]

            if not valid_links:
                continue

            # --- B. DETERMINE STYLE ---
            primary_style = next((s for s in track.dance_styles if s.is_primary), None)

            if style:
                matched_style = next(
                    (s for s in track.dance_styles if s.dance_style.lower() == style.lower()),
                    primary_style
                )
            else:
                matched_style = primary_style

            # --- C. HANDLE UNCLASSIFIED ---
            if matched_style:
                final_style = matched_style.dance_style
                final_bpm = matched_style.effective_bpm
                final_category = matched_style.tempo_category
                final_confidence = matched_style.confidence
                final_confirmations = matched_style.confirmation_count
            else:
                final_style = "Unclassified"
                final_bpm = 0
                final_category = "Unknown"
                final_confidence = 0.0
                final_confirmations = 0

            # --- D. FORMAT OUTPUT ---            
            sorted_links = sorted(
                track.artist_links, 
                key=lambda x: 0 if x.role == 'primary' else 1
            )

            # 1. Get generic tags for this style (e.g. Hambo -> Sviktande)
            global_tags = style_feel_map.get(final_style, [])

            # 2. Refine based on THIS track's physics (Bounciness)
            final_tags = self._refine_tags_with_physics(global_tags, track.bounciness)
            
            artist_list = []
            for link in sorted_links:
                artist_list.append({
                    "id": link.artist.id,
                    "name": link.artist.name,
                    "role": link.role,
                    "image_url": link.artist.image_url
                })

            # 2. Build Album Object
            album_data = None
            if track.album:
                album_data = {
                    "id": track.album.id,
                    "title": track.album.title,
                    "cover_image_url": track.album.cover_image_url,
                    "release_date": track.album.release_date
                }

            results.append({
                "id": str(track.id),
                "title": track.title,
                "artists": artist_list,
                "album": album_data,
                "dance_style": final_style,
                "feel_tags": final_tags,
                "effective_bpm": final_bpm,
                "tempo_category": final_category,
                "style_confidence": final_confidence,
                "style_confirmations": final_confirmations,
                "swing_ratio": track.swing_ratio,
                "articulation": track.articulation,
                "bounciness": track.bounciness,
                "has_vocals": track.has_vocals,
                "duration": track.duration_ms,
                "bars": track.bars,
                "sections": track.sections,
                "section_labels": track.section_labels,
                "version_count": len(track.structure_versions),
                "playback_links": [
                    {"id": str(l.id), "platform": l.platform, "deep_link": l.deep_link}
                    for l in valid_links
                ]
            })

        return results
    
    def _get_global_feels(self, styles: list[str]) -> dict:
        """
        Returns: {'Hambo': ['Sviktande', 'Majestätisk'], 'Schottis': [...]}
        """
        if not styles: return {}

        rows = (
            self.db.query(DanceMovementFeedback)
            .filter(DanceMovementFeedback.dance_style.in_(styles))
            .order_by(DanceMovementFeedback.score.desc())
            .all()
        )

        mapped = {}
        for r in rows:
            if r.dance_style not in mapped:
                mapped[r.dance_style] = []
            # Cap at top 3 tags per style
            if len(mapped[r.dance_style]) < 3:
                mapped[r.dance_style].append(r.movement_tag)
        return mapped

    def _refine_tags_with_physics(self, global_tags: list[str], bounciness: float | None) -> list[str]:
        """
        Adjusts tags based on audio analysis.
        """
        if not bounciness: return global_tags
        
        tags = global_tags[:] # Copy

        # If it's physically flat, remove bouncy words
        if bounciness < 0.35 and "Studsigt" in tags:
            tags.remove("Studsigt")
            if "Flytande" not in tags: tags.append("Flytande")

        # If it's physically bouncy, ensure bouncy words are first
        if bounciness > 0.65:
            if "Sviktande" in tags:
                tags.remove("Sviktande")
                tags.insert(0, "Sviktande")
        
        return tags[:3]