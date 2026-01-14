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

    def get_beginner_friendly_playlist(self, limit: int = 24) -> Dict[str, Any]:
        """
        Get playlist of beginner-friendly tracks.
        One track from each main style, instrumental, medium tempo.
        """
        # Get a few tracks from each main style
        common_styles = ['Hambo', 'Polska', 'Vals', 'Schottis', 'Engelska', 'Mazurka']
        all_tracks = []

        for style in common_styles:
            style_tracks = self._get_playlist_tracks([
                TrackDanceStyle.dance_style == style,
                TrackDanceStyle.confidence >= 0.8,
                or_(TrackDanceStyle.effective_bpm == None, and_(TrackDanceStyle.effective_bpm >= 80, TrackDanceStyle.effective_bpm <= 140)),
                Track.has_vocals == False
            ], limit=4)
            all_tracks.extend(style_tracks)

        if not all_tracks:
            return None

        return {
            "id": "beginner-friendly",
            "name": "Perfekt för nybörjare",
            "description": "En av varje dansstil, instrumental och lagom tempo",
            "track_count": len(all_tracks),
            "tracks": all_tracks[:6]
        }

    def get_party_playlist(self, limit: int = 8) -> Dict[str, Any]:
        """
        Get party playlist with classic dance mix.
        2 polskas, 1 schottis, 1 vals, and some variety.
        """
        all_tracks = []

        # Get 2 polskas
        polska_tracks = self._get_playlist_tracks([
            TrackDanceStyle.dance_style == 'Polska',
            TrackDanceStyle.confidence >= 0.8,
        ], limit=2)
        all_tracks.extend(polska_tracks)

        # Get 1 schottis
        schottis_tracks = self._get_playlist_tracks([
            TrackDanceStyle.dance_style == 'Schottis',
            TrackDanceStyle.confidence >= 0.8,
        ], limit=1)
        all_tracks.extend(schottis_tracks)

        # Get 1 vals
        vals_tracks = self._get_playlist_tracks([
            TrackDanceStyle.dance_style == 'Vals',
            TrackDanceStyle.confidence >= 0.8,
        ], limit=1)
        all_tracks.extend(vals_tracks)

        # Get some variety (hambo, engelska, etc.)
        variety_tracks = self._get_playlist_tracks([
            TrackDanceStyle.dance_style.in_(['Hambo', 'Engelska', 'Mazurka']),
            TrackDanceStyle.confidence >= 0.8,
        ], limit=4)
        all_tracks.extend(variety_tracks)

        if not all_tracks:
            return None

        return {
            "id": "party",
            "name": "Festspellista",
            "description": "2 polskor, 1 schottis, 1 vals och lite variation",
            "track_count": len(all_tracks),
            "tracks": all_tracks[:6]
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

    def get_slow_dances_playlist(self, limit: int = 8) -> Dict[str, Any]:
        """
        Get playlist of slow, relaxed tracks.
        BPM <= 100.
        """
        tracks = self._get_playlist_tracks([
            TrackDanceStyle.effective_bpm <= 100,
            TrackDanceStyle.confidence >= 0.7
        ], limit=limit)

        if not tracks:
            return None

        return {
            "id": "slow",
            "name": "Lugna danser",
            "description": "Lågt tempo och avslappnad känsla",
            "track_count": len(tracks),
            "tracks": tracks[:6]
        }

    def get_fast_dances_playlist(self, limit: int = 8) -> Dict[str, Any]:
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
            "name": "Snabba danser",
            "description": "Högt tempo och energi",
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
            self.get_party_playlist,
            self.get_beginner_friendly_playlist,
            self.get_slow_dances_playlist,
            self.get_fast_dances_playlist,
            self.get_instrumental_playlist,
        ]

        for method in playlist_methods:
            playlist = method()
            if playlist:
                playlists.append(playlist)

        return playlists
