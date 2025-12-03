from sqlalchemy.orm import Session, joinedload
from app.core.models import Track, TrackDanceStyle

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
        # Use outerjoin so we don't lose tracks that have 0 styles
        query = self.db.query(Track).outerjoin(Track.dance_styles)
        query = query.filter(Track.processing_status.in_(['DONE', 'FAILED']))

        # 2. APPLY FILTERS
        # Note: If filtering by style/bpm, we naturally exclude unclassified tracks
        # because the WHERE clause won't match NULL rows.
        if style:
            query = query.filter(TrackDanceStyle.dance_style.ilike(style))
        
        if min_bpm:
            query = query.filter(TrackDanceStyle.effective_bpm >= min_bpm)
        
        if max_bpm:
            query = query.filter(TrackDanceStyle.effective_bpm <= max_bpm)

        # 3. OPTIMIZE LOADING
        # distinct() is needed because joining one track to multiple styles 
        # might return the same track row multiple times in SQL
        query = query.options(
            joinedload(Track.playback_links),
            joinedload(Track.dance_styles)
        ).distinct()

        tracks = query.all()
        results = []

        for track in tracks:
            # --- A. FILTER BROKEN LINKS ---
            valid_links = [
                l for l in track.playback_links 
                if l.is_working
            ]

            # If no working links (Spotify OR Youtube), skip the track entirely.
            if not valid_links:
                continue

            # --- B. DETERMINE STYLE ---
            # Try to find the specific style requested, OR the Primary style
            matched_style = next(
                (s for s in track.dance_styles if (not style or s.dance_style.lower() == style.lower())), 
                next((s for s in track.dance_styles if s.is_primary), None)
            )

            # --- C. HANDLE UNCLASSIFIED ---
            if matched_style:
                # We have a valid style
                final_style = matched_style.dance_style
                final_bpm = matched_style.effective_bpm
                final_category = matched_style.tempo_category
                final_confidence = matched_style.confidence
                final_confirmations = matched_style.confirmation_count
            else:
                # No style found -> "Unclassified"
                final_style = "Unclassified"
                final_bpm = 0
                final_category = "Unknown"
                final_confidence = 0.0
                final_confirmations = 0

            # --- D. FORMAT OUTPUT ---
            # We return a dict that matches the Pydantic schema structure
            results.append({
                "id": str(track.id),
                "title": track.title,
                "artist_name": track.artist_name,
                "album_name": track.album_name,
                "dance_style": final_style,
                "effective_bpm": final_bpm,
                "tempo_category": final_category,
                "style_confidence": final_confidence,
                "style_confirmations": final_confirmations,
                "has_vocals": track.has_vocals,
                "duration": track.duration_ms,
                "bars": track.bars,
                "sections": track.sections,
                "section_labels": track.section_labels,
                "playback_links": [
                    {"id": str(l.id), "platform": l.platform, "deep_link": l.deep_link}
                    for l in valid_links
                ]
            })

        return results