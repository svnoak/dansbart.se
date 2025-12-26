"""
Discovery service for curated playlists and recommendations.
"""
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.core.models import Track, PlaybackLink, TrackDanceStyle, TrackArtist, TrackAlbum
from app.services.tracks import TrackService
from sqlalchemy import and_, or_
from sqlalchemy.orm import selectinload, joinedload


class DiscoveryService:
    """Service for discovery features including curated playlists."""

    def __init__(self, db: Session):
        self.db = db
        self.track_service = TrackService(db)

    def _get_playlist_tracks(self, filters: List, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Helper method to fetch tracks with common filters.

        Args:
            filters: List of SQLAlchemy filter conditions
            limit: Maximum number of tracks to return

        Returns:
            List of formatted track dictionaries
        """
        query = self.db.query(Track).join(
            Track.playback_links
        ).join(
            Track.dance_styles
        ).filter(
            PlaybackLink.is_working == True,
            Track.is_flagged == False,
            *filters
        ).options(
            selectinload(Track.dance_styles),
            selectinload(Track.artist_links).joinedload(TrackArtist.artist),
            selectinload(Track.album_links).joinedload(TrackAlbum.album),
            selectinload(Track.playback_links)
        ).distinct().limit(limit)

        tracks = []
        for track_model in query.all():
            formatted = self.track_service.format_track(track_model)
            if formatted:
                tracks.append(formatted)
        return tracks

    def get_beginner_friendly_playlist(self, limit: int = 8) -> Dict[str, Any]:
        """
        Get playlist of beginner-friendly tracks.
        Common styles, moderate tempo, no vocals.
        """
        tracks = self._get_playlist_tracks([
            TrackDanceStyle.dance_style.in_(['Hambo', 'Polska', 'Vals', 'Schottis']),
            TrackDanceStyle.confidence >= 0.8,
            or_(TrackDanceStyle.effective_bpm == None, and_(TrackDanceStyle.effective_bpm >= 80, TrackDanceStyle.effective_bpm <= 140)),
            Track.has_vocals == False
        ], limit=limit)

        if not tracks:
            return None

        return {
            "id": "beginner-friendly",
            "name": "Perfekt för nybörjare",
            "description": "Klassiska dansstilar i lagom tempo",
            "track_count": len(tracks),
            "tracks": tracks[:6]
        }

    def get_teaching_playlist(self, limit: int = 8) -> Dict[str, Any]:
        """
        Get playlist for teaching.
        Clear structure, good duration (2-5 minutes), no vocals.
        """
        tracks = self._get_playlist_tracks([
            TrackDanceStyle.confidence >= 0.9,
            Track.duration_ms >= 120000,  # At least 2 minutes
            Track.duration_ms <= 300000,  # Max 5 minutes
            Track.has_vocals == False
        ], limit=limit)

        if not tracks:
            return None

        return {
            "id": "teaching",
            "name": "Bra för undervisning",
            "description": "Tydlig struktur och lagom längd",
            "track_count": len(tracks),
            "tracks": tracks[:6]
        }

    def get_instrumental_playlist(self, limit: int = 8) -> Dict[str, Any]:
        """
        Get playlist of pure instrumental tracks.
        """
        tracks = self._get_playlist_tracks([
            Track.has_vocals == False,
            TrackDanceStyle.confidence >= 0.7
        ], limit=limit)

        if not tracks:
            return None

        return {
            "id": "instrumental",
            "name": "Rent instrumental",
            "description": "Utan sång",
            "track_count": len(tracks),
            "tracks": tracks[:6]
        }

    def get_fast_playlist(self, limit: int = 8) -> Dict[str, Any]:
        """
        Get playlist of fast, energetic tracks.
        BPM >= 140.
        """
        tracks = self._get_playlist_tracks([
            TrackDanceStyle.effective_bpm >= 140,
            TrackDanceStyle.confidence >= 0.7
        ], limit=limit)

        if not tracks:
            return None

        return {
            "id": "fast",
            "name": "Snabbt & energiskt",
            "description": "För dig som gillar högt tempo",
            "track_count": len(tracks),
            "tracks": tracks[:6]
        }

    def get_rare_styles_playlist(self, limit: int = 8) -> Dict[str, Any]:
        """
        Get playlist of rare dance styles.
        """
        tracks = self._get_playlist_tracks([
            TrackDanceStyle.dance_style.in_(['Kadrilj', 'Engelska', 'Menuett', 'Mazurka', 'Reinlender', 'Springar']),
            TrackDanceStyle.confidence >= 0.7
        ], limit=limit)

        if not tracks:
            return None

        return {
            "id": "rare-styles",
            "name": "Ovanliga dansstilar",
            "description": "Utforska mindre vanliga danser",
            "track_count": len(tracks),
            "tracks": tracks[:6]
        }

    def get_all_playlists(self) -> List[Dict[str, Any]]:
        """
        Get all curated playlists.

        Returns:
            List of playlist dictionaries, each containing metadata and preview tracks
        """
        playlists = []

        # Add each playlist type
        playlist_methods = [
            self.get_beginner_friendly_playlist,
            self.get_teaching_playlist,
            self.get_instrumental_playlist,
            self.get_fast_playlist,
            self.get_rare_styles_playlist
        ]

        for method in playlist_methods:
            playlist = method()
            if playlist:
                playlists.append(playlist)

        return playlists
