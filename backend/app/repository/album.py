"""
Album Repository - Optimized queries for album management

Provides:
- Album CRUD operations
- Track statistics aggregation
- Album artist aggregation
- Orphan detection
"""
import uuid
from typing import Optional, List, Dict, Tuple
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func, case
from app.core.models import Album, Artist, Track, TrackArtist, TrackAlbum
from .base import BaseRepository


class AlbumRepository(BaseRepository[Album]):
    """Repository for Album entity with optimized queries."""

    def __init__(self, db: Session):
        super().__init__(db, Album)

    # ==================== EAGER LOADING CONFIGURATIONS ====================

    @staticmethod
    def get_eager_load_full():
        """Full eager loading for album with all relationships."""
        return [
            joinedload(Album.artist),
            selectinload(Album.track_links).joinedload(TrackAlbum.track).joinedload(Track.artist_links).joinedload(TrackArtist.artist)
        ]

    @staticmethod
    def get_eager_load_basic():
        """Basic eager loading for album listings."""
        return [
            joinedload(Album.artist)
        ]

    # ==================== LOOKUP OPERATIONS ====================

    def get_by_title_and_artist(
        self,
        title: str,
        artist_id: uuid.UUID,
        eager_load: List = None
    ) -> Optional[Album]:
        """Get album by title and artist ID."""
        query = self.db.query(Album).filter(
            Album.title == title,
            Album.artist_id == artist_id
        )

        if eager_load:
            query = query.options(*eager_load)

        return query.first()

    def get_or_create(
        self,
        title: str,
        artist_id: uuid.UUID,
        cover_url: str = None,
        release_date: str = None
    ) -> Album:
        """
        Get existing album or create a new one.
        Assumes unique album title per artist.
        """
        album = self.get_by_title_and_artist(title, artist_id)

        if not album:
            album = self.create(
                title=title,
                artist_id=artist_id,
                cover_image_url=cover_url,
                release_date=release_date
            )

        return album

    def get_by_artist(
        self,
        artist_id: uuid.UUID,
        eager_load: List = None
    ) -> List[Album]:
        """Get all albums by an artist."""
        query = self.db.query(Album).filter(Album.artist_id == artist_id)

        if eager_load:
            query = query.options(*eager_load)

        return query.order_by(Album.title).all()

    # ==================== TRACK STATISTICS ====================

    def get_track_stats(self, album_id: uuid.UUID) -> Dict[str, int]:
        """
        Get track statistics for a single album.

        Returns:
            Dict with 'total', 'done', 'pending', 'failed' counts
        """
        stats = self.db.query(
            func.count(Track.id).label('total'),
            func.sum(case((Track.processing_status == 'DONE', 1), else_=0)).label('done'),
            func.sum(case((Track.processing_status == 'PENDING', 1), else_=0)).label('pending'),
            func.sum(case((Track.processing_status == 'FAILED', 1), else_=0)).label('failed')
        ).join(TrackAlbum, Track.id == TrackAlbum.track_id).filter(
            TrackAlbum.album_id == album_id
        ).first()

        return {
            'total': stats.total or 0,
            'done': stats.done or 0,
            'pending': stats.pending or 0,
            'failed': stats.failed or 0
        }

    def get_track_stats_batch(self, album_ids: List[uuid.UUID]) -> Dict[str, Dict[str, int]]:
        """
        Get track statistics for multiple albums in a single query.
        Optimized for batch operations.

        Returns:
            Dict mapping album_id to stats dict
        """
        if not album_ids:
            return {}

        # Convert UUIDs to strings for comparison
        album_id_strs = [str(aid) for aid in album_ids]

        stats_query = self.db.query(
            TrackAlbum.album_id.label('album_id'),
            func.count(Track.id).label('total'),
            func.sum(case((Track.processing_status == 'DONE', 1), else_=0)).label('done'),
            func.sum(case((Track.processing_status == 'PENDING', 1), else_=0)).label('pending'),
            func.sum(case((Track.processing_status == 'FAILED', 1), else_=0)).label('failed')
        ).join(Track, TrackAlbum.track_id == Track.id).filter(
            TrackAlbum.album_id.in_(album_ids)
        ).group_by(TrackAlbum.album_id).all()

        stats_map = {}
        for row in stats_query:
            stats_map[str(row.album_id)] = {
                'total': row.total or 0,
                'done': row.done or 0,
                'pending': row.pending or 0,
                'failed': row.failed or 0
            }

        # Fill in missing albums with zeros
        for album_id_str in album_id_strs:
            if album_id_str not in stats_map:
                stats_map[album_id_str] = {
                    'total': 0,
                    'done': 0,
                    'pending': 0,
                    'failed': 0
                }

        return stats_map

    # ==================== ALBUM ARTISTS (All contributing artists) ====================

    def get_all_artists_on_album(self, album_id: uuid.UUID) -> List[Artist]:
        """
        Get all unique artists who have tracks on this album.
        Includes collaborating artists, not just the album's primary artist.
        """
        return self.db.query(Artist).join(TrackArtist).join(Track).join(
            TrackAlbum, Track.id == TrackAlbum.track_id
        ).filter(
            TrackAlbum.album_id == album_id
        ).distinct().all()

    def get_all_artists_on_albums_batch(
        self,
        album_ids: List[uuid.UUID]
    ) -> Dict[str, List[str]]:
        """
        Get all artists for multiple albums in a single query.
        Optimized for batch operations.

        Returns:
            Dict mapping album_id to list of artist names
        """
        if not album_ids:
            return {}

        # Query all artists for all albums at once
        results = self.db.query(
            TrackAlbum.album_id,
            Artist.name
        ).join(Track, TrackAlbum.track_id == Track.id).join(
            TrackArtist, Track.id == TrackArtist.track_id
        ).join(
            Artist, TrackArtist.artist_id == Artist.id
        ).filter(
            TrackAlbum.album_id.in_(album_ids)
        ).distinct().all()

        # Group by album_id
        artists_map = {}
        for album_id, artist_name in results:
            album_id_str = str(album_id)
            if album_id_str not in artists_map:
                artists_map[album_id_str] = []
            artists_map[album_id_str].append(artist_name)

        # Fill in missing albums
        for album_id in album_ids:
            album_id_str = str(album_id)
            if album_id_str not in artists_map:
                artists_map[album_id_str] = []

        return artists_map

    # ==================== PAGINATED QUERIES ====================

    def get_albums_with_stats(
        self,
        search: str = None,
        artist_id: uuid.UUID = None,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[Dict], int]:
        """
        Get paginated albums with track statistics and all contributing artists.
        Optimized with batch statistics loading.

        Returns:
            Tuple of (album_dicts, total_count)
        """
        query = self.db.query(Album).options(*self.get_eager_load_basic())

        if search:
            query = query.filter(Album.title.ilike(f"%{search}%"))

        if artist_id:
            query = query.filter(Album.artist_id == artist_id)

        total = query.count()
        albums = query.order_by(Album.title).offset(offset).limit(limit).all()

        # Get stats and artists in batch (optimized)
        album_ids = [a.id for a in albums]
        stats_map = self.get_track_stats_batch(album_ids)
        artists_map = self.get_all_artists_on_albums_batch(album_ids)

        # Format results
        items = []
        for album in albums:
            album_id_str = str(album.id)
            stats = stats_map.get(album_id_str, {'total': 0, 'done': 0, 'pending': 0, 'failed': 0})
            all_artists = artists_map.get(album_id_str, [])

            items.append({
                "id": album_id_str,
                "title": album.title,
                "artist_name": album.artist.name if album.artist else None,
                "artist_id": str(album.artist_id) if album.artist_id else None,
                "all_artists": all_artists,
                "cover_image_url": album.cover_image_url,
                "release_date": album.release_date,
                "total_tracks": stats['total'],
                "done_tracks": stats['done'],
                "pending_tracks": stats['pending'],
                "failed_tracks": stats['failed']
            })

        return items, total

    def get_pending_albums(
        self,
        artist_id: uuid.UUID = None,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[Dict], int]:
        """
        Get albums that have pending tracks.
        Optimized query with JOIN filtering.

        Returns:
            Tuple of (album_dicts, total_count)
        """
        query = self.db.query(Album).join(
            TrackAlbum, Album.id == TrackAlbum.album_id
        ).join(Track, TrackAlbum.track_id == Track.id).filter(
            Track.processing_status == "PENDING"
        ).distinct().options(*self.get_eager_load_basic())

        if artist_id:
            query = query.filter(Album.artist_id == artist_id)

        total = query.count()
        albums = query.order_by(Album.title).offset(offset).limit(limit).all()

        # Get stats and artists in batch
        album_ids = [a.id for a in albums]
        stats_map = self.get_track_stats_batch(album_ids)
        artists_map = self.get_all_artists_on_albums_batch(album_ids)

        # Format results
        items = []
        for album in albums:
            album_id_str = str(album.id)
            stats = stats_map.get(album_id_str, {'total': 0, 'done': 0, 'pending': 0})
            all_artists = artists_map.get(album_id_str, [])

            items.append({
                "id": album_id_str,
                "title": album.title,
                "artist_name": album.artist.name if album.artist else None,
                "artist_id": str(album.artist_id) if album.artist_id else None,
                "all_artists": all_artists,
                "cover_image_url": album.cover_image_url,
                "release_date": album.release_date,
                "pending_tracks": stats['pending'],
                "done_tracks": stats['done'],
                "total_tracks": stats['total']
            })

        return items, total

    # ==================== TRACK OPERATIONS ====================

    def get_pending_tracks(self, album_id: uuid.UUID) -> List[Track]:
        """Get all pending tracks for an album."""
        return self.db.query(Track).join(
            TrackAlbum, Track.id == TrackAlbum.track_id
        ).filter(
            TrackAlbum.album_id == album_id,
            Track.processing_status == "PENDING"
        ).all()

    def get_kept_tracks(self, album_id: uuid.UUID) -> List[Track]:
        """Get all non-pending tracks for an album (analyzed or failed)."""
        return self.db.query(Track).join(
            TrackAlbum, Track.id == TrackAlbum.track_id
        ).filter(
            TrackAlbum.album_id == album_id,
            Track.processing_status != "PENDING"
        ).all()

    def count_tracks(self, album_id: uuid.UUID) -> int:
        """Count total tracks on an album."""
        return self.db.query(Track).join(
            TrackAlbum, Track.id == TrackAlbum.track_id
        ).filter(TrackAlbum.album_id == album_id).count()

    # ==================== ORPHAN DETECTION ====================

    def find_orphan_albums(self, limit: int = 100) -> List[Album]:
        """
        Find albums with no tracks.
        These are candidates for cleanup.
        """
        # Subquery to get album IDs that have tracks
        albums_with_tracks = self.db.query(TrackAlbum.album_id).distinct().subquery()

        # Get albums NOT in that list
        orphan_albums = self.db.query(Album).filter(
            Album.id.notin_(albums_with_tracks)
        ).limit(limit).all()

        return orphan_albums

    def delete_orphan_albums(self, dry_run: bool = False) -> Dict:
        """
        Delete albums with no tracks.

        Args:
            dry_run: If True, preview without deleting

        Returns:
            Dict with operation results
        """
        orphan_albums = self.find_orphan_albums(limit=10000)

        if dry_run:
            return {
                "status": "dry_run",
                "message": f"Would delete {len(orphan_albums)} orphan albums",
                "preview": [
                    {
                        "id": str(album.id),
                        "title": album.title,
                        "artist": album.artist.name if album.artist else None
                    }
                    for album in orphan_albums[:20]
                ]
            }

        # Delete orphan albums
        deleted_count = 0
        for album in orphan_albums:
            self.db.delete(album)
            deleted_count += 1

        self.db.flush()

        return {
            "status": "success",
            "message": f"Deleted {deleted_count} orphan albums",
            "deleted_count": deleted_count
        }

    # ==================== BULK OPERATIONS ====================

    def get_by_ids(self, album_ids: List[uuid.UUID], eager_load: List = None) -> List[Album]:
        """Get multiple albums by IDs."""
        query = self.db.query(Album).filter(Album.id.in_(album_ids))

        if eager_load:
            query = query.options(*eager_load)

        return query.all()
