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

    def get_style_playlist(self, style: str, limit: int = 6) -> Dict[str, Any]:
        """
        Get playlist for a specific dance style.

        Args:
            style: The dance style name (e.g., 'Polska', 'Vals')
            limit: Maximum number of tracks to return

        Returns:
            Playlist dictionary with metadata and tracks
        """
        tracks = self._get_playlist_tracks([
            TrackDanceStyle.dance_style == style,
            TrackDanceStyle.confidence >= 0.7
        ], limit=limit)

        if not tracks:
            return None

        # Get total count for this style
        total_count = self.db.query(Track).join(
            Track.dance_styles
        ).join(
            Track.playback_links
        ).filter(
            TrackDanceStyle.dance_style == style,
            TrackDanceStyle.confidence >= 0.7,
            PlaybackLink.is_working == True,
            Track.is_flagged == False
        ).distinct().count()

        return {
            "id": style.lower(),
            "name": style,
            "description": f"Låtar att dansa {style.lower()} till",
            "track_count": total_count,
            "tracks": tracks
        }

    def get_all_playlists(self) -> List[Dict[str, Any]]:
        """
        Get style-based playlists.

        Returns:
            List of playlist dictionaries, one per dance style
        """
        # Main dance styles to create playlists for
        main_styles = ['Polska', 'Vals', 'Schottis', 'Hambo', 'Engelska', 'Mazurka']

        playlists = []
        for style in main_styles:
            playlist = self.get_style_playlist(style)
            if playlist:
                playlists.append(playlist)

        return playlists
