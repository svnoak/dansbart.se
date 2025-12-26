"""
Artist Service - Business logic for artist operations
"""
from typing import Dict, List, Tuple
from sqlalchemy.orm import Session
from app.repository.artist import ArtistRepository
from app.repository.album import AlbumRepository
from app.api.schemas import Page
import uuid


class ArtistService:
    """Service for artist-related operations."""

    def __init__(self, db: Session):
        self.db = db
        self.artist_repo = ArtistRepository(db)
        self.album_repo = AlbumRepository(db)

    def get_artists_paginated(
        self,
        search: str = None,
        limit: int = 20,
        offset: int = 0
    ) -> Dict:
        """
        Get paginated list of artists with track counts.

        Args:
            search: Optional search term for artist name
            limit: Number of items per page
            offset: Number of items to skip

        Returns:
            Dict with items, total, limit, offset
        """
        items, total = self.artist_repo.get_artists_with_stats(
            search=search,
            limit=limit,
            offset=offset
        )

        return {
            "items": items,
            "total": total,
            "limit": limit,
            "offset": offset
        }

    def get_artist_by_id(self, artist_id: uuid.UUID) -> Dict:
        """
        Get a single artist by ID with details and albums.

        Args:
            artist_id: UUID of the artist

        Returns:
            Dict with artist details including albums

        Raises:
            ValueError: If artist not found
        """
        artist = self.artist_repo.get_by_id(artist_id)
        if not artist:
            raise ValueError("Artist not found")

        # Get track stats
        stats = self.artist_repo.get_track_stats(artist_id)

        # Get albums by this artist
        albums = self.album_repo.get_by_artist(artist_id)
        album_list = [{
            "id": album.id,
            "title": album.title,
            "release_date": album.release_date
        } for album in albums]

        return {
            "id": artist.id,
            "name": artist.name,
            "is_verified": artist.is_verified,
            "total_tracks": stats['done'],  # Only show playable tracks
            "albums": album_list
        }

    def get_artist_tracks(
        self,
        artist_id: uuid.UUID,
        limit: int = 20,
        offset: int = 0
    ) -> Page:
        """
        Get all playable tracks by a specific artist.

        Args:
            artist_id: UUID of the artist
            limit: Number of tracks per page
            offset: Number of tracks to skip

        Returns:
            Page object with tracks
        """
        from app.core.models import Track, TrackArtist, TrackAlbum, PlaybackLink
        from sqlalchemy.orm import selectinload, joinedload
        from app.services.tracks import TrackService

        track_service = TrackService(self.db)

        # Query tracks by artist with playable links
        track_query = self.db.query(Track).join(
            Track.artist_links
        ).join(
            Track.playback_links
        ).filter(
            TrackArtist.artist_id == artist_id,
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
