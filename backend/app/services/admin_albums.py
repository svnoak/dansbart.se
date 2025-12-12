from sqlalchemy.orm import Session
from app.core.models import Album, Track, TrackArtist, Artist, PlaybackLink
from .admin_query_helpers import build_paginated_response, ALBUM_EAGER_LOAD
from .admin_tracks import AdminTrackService


class AdminAlbumService:
    """Service for album-specific admin operations."""

    def __init__(self, db: Session):
        self.db = db
        self.track_service = AdminTrackService(db)

    def get_albums_paginated(
        self,
        search: str = None,
        artist_id: str = None,
        limit: int = 50,
        offset: int = 0
    ) -> dict:
        """
        Get paginated list of albums with track counts.

        Args:
            search: Search by title
            artist_id: Filter by artist ID
            limit: Items per page
            offset: Pagination offset

        Returns:
            Paginated response with album list
        """
        query = self.db.query(Album).options(*ALBUM_EAGER_LOAD)

        if search:
            query = query.filter(Album.title.ilike(f"%{search}%"))

        if artist_id:
            query = query.filter(Album.artist_id == artist_id)

        total = query.count()
        albums = query.order_by(Album.title).offset(offset).limit(limit).all()

        # Get track stats in batch
        album_ids = [str(a.id) for a in albums]
        stats_map = self.track_service.get_track_stats('album', album_ids)

        # Format results
        items = []
        for album in albums:
            album_id_str = str(album.id)
            stats = stats_map.get(album_id_str, {'total': 0, 'done': 0, 'pending': 0})

            # Get all unique artists on this album
            album_artists = self.db.query(Artist).join(TrackArtist).join(Track).filter(
                Track.album_id == album.id
            ).distinct().all()
            artist_names = [a.name for a in album_artists]

            items.append({
                "id": album_id_str,
                "title": album.title,
                "artist_name": album.artist.name if album.artist else None,
                "artist_id": str(album.artist_id) if album.artist_id else None,
                "all_artists": artist_names,
                "cover_image_url": album.cover_image_url,
                "release_date": album.release_date,
                "total_tracks": stats['total'],
                "done_tracks": stats['done'],
                "pending_tracks": stats['pending']
            })

        return build_paginated_response(items, total, limit, offset)

    def get_pending_albums(
        self,
        artist_id: str = None,
        limit: int = 50,
        offset: int = 0
    ) -> dict:
        """
        Get albums with pending tracks.

        Args:
            artist_id: Optional filter by artist ID
            limit: Items per page
            offset: Pagination offset

        Returns:
            Paginated response with pending album list
        """
        query = self.db.query(Album).join(Track).filter(
            Track.processing_status == "PENDING"
        ).distinct().options(*ALBUM_EAGER_LOAD)

        if artist_id:
            query = query.filter(Album.artist_id == artist_id)

        total = query.count()
        albums = query.order_by(Album.title).offset(offset).limit(limit).all()

        # Get track stats
        album_ids = [str(a.id) for a in albums]
        stats_map = self.track_service.get_track_stats('album', album_ids)

        # Format results
        items = []
        for album in albums:
            album_id_str = str(album.id)
            stats = stats_map.get(album_id_str, {'total': 0, 'done': 0, 'pending': 0})

            # Get all unique artists on this album
            album_artists = self.db.query(Artist).join(TrackArtist).join(Track).filter(
                Track.album_id == album.id
            ).distinct().all()
            artist_names = [a.name for a in album_artists]

            items.append({
                "id": album_id_str,
                "title": album.title,
                "artist_name": album.artist.name if album.artist else None,
                "artist_id": str(album.artist_id) if album.artist_id else None,
                "all_artists": artist_names,
                "cover_image_url": album.cover_image_url,
                "release_date": album.release_date,
                "pending_tracks": stats['pending'],
                "done_tracks": stats['done'],
                "total_tracks": stats['total']
            })

        return build_paginated_response(items, total, limit, offset)

    def reject_album(
        self,
        album_id: str,
        reason: str,
        dry_run: bool = False
    ) -> dict:
        """
        Reject an album and delete pending tracks.

        Args:
            album_id: Album ID to reject
            reason: Reason for rejection
            dry_run: If True, preview without making changes

        Returns:
            Status dict with operation results
        """
        album = self.db.query(Album).options(*ALBUM_EAGER_LOAD).filter(
            Album.id == album_id
        ).first()

        if not album:
            raise ValueError("Album not found")

        album_title = album.title
        album_artist = album.artist.name if album.artist else "Unknown"

        # Get all unique artists on this album
        album_artists = self.db.query(Artist).join(TrackArtist).join(Track).filter(
            Track.album_id == album_id
        ).distinct().all()
        artist_names = [a.name for a in album_artists]

        # Get pending and kept tracks
        pending_tracks = self.db.query(Track).filter(
            Track.album_id == album_id,
            Track.processing_status == "PENDING"
        ).all()

        kept_tracks = self.db.query(Track).filter(
            Track.album_id == album_id,
            Track.processing_status != "PENDING"
        ).all()

        remaining_tracks_count = len(kept_tracks)

        # Dry run preview
        if dry_run:
            return {
                "status": "dry_run",
                "message": f"DRY RUN: Would reject album '{album_title}'",
                "preview": {
                    "album_title": album_title,
                    "album_artist": album_artist,
                    "all_artists_on_album": artist_names,
                    "would_delete_pending_tracks": len(pending_tracks),
                    "would_keep_tracks": len(kept_tracks),
                    "would_delete_album": remaining_tracks_count == 0,
                    "sample_pending_tracks": [
                        {
                            "title": t.title,
                            "artists": [link.artist.name for link in t.artist_links]
                        } for t in pending_tracks[:10]
                    ],
                    "sample_kept_tracks": [
                        {
                            "title": t.title,
                            "status": t.processing_status,
                            "artists": [link.artist.name for link in t.artist_links]
                        } for t in kept_tracks[:10]
                    ] if kept_tracks else []
                }
            }

        # Delete pending tracks
        for track in pending_tracks:
            self.db.query(PlaybackLink).filter(
                PlaybackLink.track_id == track.id
            ).delete()
            self.db.delete(track)

        # Delete album if no remaining tracks
        if remaining_tracks_count == 0:
            self.db.delete(album)

        self.db.flush()

        return {
            "status": "success",
            "message": f"Album '{album_title}' rejected. Deleted {len(pending_tracks)} pending tracks.",
            "album_deleted": remaining_tracks_count == 0,
            "kept_tracks": len(kept_tracks),
            "blocklisted": False  # Album blocklisting not implemented
        }
