"""
Album Service - Business logic for album operations
"""
from typing import Dict, List, Tuple
from sqlalchemy.orm import Session
from app.repository.album import AlbumRepository
from app.api.schemas import Page
import uuid


class AlbumService:
    """Service for album-related operations."""

    def __init__(self, db: Session):
        self.db = db
        self.album_repo = AlbumRepository(db)

    def get_albums_paginated(
        self,
        search: str = None,
        artist_id: uuid.UUID = None,
        limit: int = 20,
        offset: int = 0
    ) -> Dict:
        """
        Get paginated list of albums with track counts.

        Args:
            search: Optional search term for album title
            artist_id: Optional filter by artist UUID
            limit: Number of items per page
            offset: Number of items to skip

        Returns:
            Dict with items, total, limit, offset
        """
        items, total = self.album_repo.get_albums_with_stats(
            search=search,
            artist_id=artist_id,
            limit=limit,
            offset=offset
        )

        return {
            "items": items,
            "total": total,
            "limit": limit,
            "offset": offset
        }

    def get_album_by_id(self, album_id: uuid.UUID) -> Dict:
        """
        Get a single album by ID with details and track list.

        Args:
            album_id: UUID of the album

        Returns:
            Dict with album details including all contributing artists

        Raises:
            ValueError: If album not found
        """
        album = self.album_repo.get_by_id(
            album_id,
            eager_load=self.album_repo.get_eager_load_basic()
        )
        if not album:
            raise ValueError("Album not found")

        # Get track stats
        stats = self.album_repo.get_track_stats(album_id)

        # Get all contributing artists
        all_artists = self.album_repo.get_all_artists_on_album(album_id)
        artist_list = [{
            "id": artist.id,
            "name": artist.name
        } for artist in all_artists]

        return {
            "id": album.id,
            "title": album.title,
            "artist_id": album.artist_id if album.artist_id else None,
            "artist_name": album.artist.name if album.artist else None,
            "all_artists": artist_list,
            "release_date": album.release_date,
            "total_tracks": stats['done']  # Only show playable tracks
        }

    def get_album_tracks(
        self,
        album_id: uuid.UUID,
        limit: int = 20,
        offset: int = 0
    ) -> Page:
        """
        Get all playable tracks from a specific album.

        Args:
            album_id: UUID of the album
            limit: Number of tracks per page
            offset: Number of tracks to skip

        Returns:
            Page object with tracks
        """
        from app.core.models import Track, TrackArtist, TrackAlbum, PlaybackLink
        from sqlalchemy.orm import selectinload, joinedload
        from app.services.tracks import TrackService

        track_service = TrackService(self.db)

        # Query tracks by album with playable links
        track_query = self.db.query(Track).join(
            TrackAlbum, Track.id == TrackAlbum.track_id
        ).join(
            Track.playback_links
        ).filter(
            TrackAlbum.album_id == album_id,
            PlaybackLink.is_working == True,
            Track.is_flagged == False
        ).options(
            selectinload(Track.dance_styles),
            selectinload(Track.artist_links).joinedload(TrackArtist.artist),
            selectinload(Track.album_links).joinedload(TrackAlbum.album),
            selectinload(Track.playback_links)
        ).distinct()

        total = track_query.count()
        track_models = track_query.order_by(Track.created_at.desc()).offset(offset).limit(limit).all()

        # Format tracks using TrackService
        tracks = []
        for track_model in track_models:
            formatted = track_service.get_track_by_id(str(track_model.id))
            if formatted:
                tracks.append(formatted)

        return {
            "items": tracks,
            "total": total,
            "limit": limit,
            "offset": offset
        }
