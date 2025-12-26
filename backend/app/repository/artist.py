"""
Artist Repository - Optimized queries for artist management

Provides:
- Artist CRUD operations
- Isolation detection (optimized with SQL aggregations)
- Track statistics aggregation
- Batch operations for approval/rejection
"""
import uuid
from typing import Optional, List, Dict, Tuple
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func, case, and_, or_
from app.core.models import Artist, Track, TrackArtist, Album, PlaybackLink
from .base import BaseRepository


class ArtistRepository(BaseRepository[Artist]):
    """Repository for Artist entity with optimized queries."""

    def __init__(self, db: Session):
        super().__init__(db, Artist)

    # ==================== EAGER LOADING CONFIGURATIONS ====================

    @staticmethod
    def get_eager_load_full():
        """Full eager loading for artist with all relationships."""
        return [
            selectinload(Artist.track_links).joinedload(TrackArtist.track),
            selectinload(Artist.albums)
        ]

    @staticmethod
    def get_eager_load_basic():
        """Basic eager loading for artist listings."""
        return [
            joinedload(Artist.albums)
        ]

    # ==================== LOOKUP OPERATIONS ====================

    def get_by_spotify_id(self, spotify_id: str, eager_load: List = None) -> Optional[Artist]:
        """Get artist by Spotify ID."""
        query = self.db.query(Artist).filter(Artist.spotify_id == spotify_id)

        if eager_load:
            query = query.options(*eager_load)

        return query.first()

    def get_by_name(self, name: str, eager_load: List = None) -> Optional[Artist]:
        """Get artist by exact name match."""
        query = self.db.query(Artist).filter(Artist.name == name)

        if eager_load:
            query = query.options(*eager_load)

        return query.first()

    def search_by_name(
        self,
        search_term: str,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[Artist], int]:
        """Search artists by name (case-insensitive)."""
        return self.paginate(
            limit=limit,
            offset=offset,
            search=search_term,
            search_fields=['name'],
            order_by=Artist.name
        )

    def get_or_create(
        self,
        name: str,
        spotify_id: str = None,
        image_url: str = None
    ) -> Artist:
        """
        Get existing artist or create a new one.
        Tries Spotify ID first, then falls back to name matching.
        """
        # Try finding by Spotify ID first (most accurate)
        if spotify_id:
            artist = self.get_by_spotify_id(spotify_id)
            if artist:
                return artist

        # Fallback: Find by name
        if not spotify_id:
            artist = self.get_by_name(name)
            if artist:
                return artist

        # Create new artist
        return self.create(name=name, spotify_id=spotify_id, image_url=image_url)

    # ==================== TRACK STATISTICS ====================

    def get_track_stats(self, artist_id: uuid.UUID) -> Dict[str, int]:
        """
        Get track statistics for a single artist.

        Returns:
            Dict with 'total', 'done', 'pending', 'failed' counts
        """
        stats = self.db.query(
            func.count(Track.id).label('total'),
            func.sum(case((Track.processing_status == 'DONE', 1), else_=0)).label('done'),
            func.sum(case((Track.processing_status == 'PENDING', 1), else_=0)).label('pending'),
            func.sum(case((Track.processing_status == 'FAILED', 1), else_=0)).label('failed')
        ).join(TrackArtist).filter(
            TrackArtist.artist_id == artist_id
        ).first()

        return {
            'total': stats.total or 0,
            'done': stats.done or 0,
            'pending': stats.pending or 0,
            'failed': stats.failed or 0
        }

    def get_track_stats_batch(self, artist_ids: List[uuid.UUID]) -> Dict[str, Dict[str, int]]:
        """
        Get track statistics for multiple artists in a single query.
        Optimized for batch operations.

        Returns:
            Dict mapping artist_id to stats dict
        """
        if not artist_ids:
            return {}

        # Convert UUIDs to strings for comparison
        artist_id_strs = [str(aid) for aid in artist_ids]

        stats_query = self.db.query(
            TrackArtist.artist_id.label('artist_id'),
            func.count(Track.id).label('total'),
            func.sum(case((Track.processing_status == 'DONE', 1), else_=0)).label('done'),
            func.sum(case((Track.processing_status == 'PENDING', 1), else_=0)).label('pending'),
            func.sum(case((Track.processing_status == 'FAILED', 1), else_=0)).label('failed')
        ).join(Track, TrackArtist.track_id == Track.id).filter(
            TrackArtist.artist_id.in_(artist_ids)
        ).group_by(TrackArtist.artist_id).all()

        stats_map = {}
        for row in stats_query:
            stats_map[str(row.artist_id)] = {
                'total': row.total or 0,
                'done': row.done or 0,
                'pending': row.pending or 0,
                'failed': row.failed or 0
            }

        # Fill in missing artists with zeros
        for artist_id_str in artist_id_strs:
            if artist_id_str not in stats_map:
                stats_map[artist_id_str] = {
                    'total': 0,
                    'done': 0,
                    'pending': 0,
                    'failed': 0
                }

        return stats_map

    # ==================== ISOLATION DETECTION ====================

    def get_isolation_info(self, artist_id: uuid.UUID) -> Dict:
        """
        Optimized isolation detection using SQL aggregations.
        Determines if an artist shares tracks/albums with others.

        Returns:
            Dict with isolation status and collaboration details
        """
        # Query to find tracks with multiple artists
        collaboration_query = self.db.query(
            Track.id.label('track_id'),
            func.count(TrackArtist.artist_id).label('artist_count')
        ).join(TrackArtist).filter(
            TrackArtist.track_id.in_(
                self.db.query(TrackArtist.track_id).filter(
                    TrackArtist.artist_id == artist_id
                )
            )
        ).group_by(Track.id).subquery()

        # Get tracks where this artist collaborates (artist_count > 1)
        collab_tracks = self.db.query(
            collaboration_query.c.track_id
        ).filter(collaboration_query.c.artist_count > 1).all()

        # Get names of collaborating artists
        shared_with = set()
        shared_album_ids = set()

        if collab_tracks:
            from app.core.models import TrackAlbum
            track_ids = [t.track_id for t in collab_tracks]

            # Get other artists on these tracks
            other_artists = self.db.query(Artist.name).join(TrackArtist).filter(
                TrackArtist.track_id.in_(track_ids),
                TrackArtist.artist_id != artist_id
            ).distinct().all()

            shared_with = {name for (name,) in other_artists}

            # Get album IDs for these tracks
            album_links = self.db.query(TrackAlbum.album_id).filter(
                TrackAlbum.track_id.in_(track_ids)
            ).distinct().all()
            shared_album_ids = {album_id for (album_id,) in album_links}

        # Get total track count for this artist
        total_tracks = self.db.query(Track).join(TrackArtist).filter(
            TrackArtist.artist_id == artist_id
        ).count()

        return {
            "is_isolated": len(shared_with) == 0,
            "shared_with_artists": list(shared_with),
            "shared_tracks": len(collab_tracks),
            "shared_albums": len(shared_album_ids),
            "total_tracks": total_tracks
        }

    # ==================== PAGINATED QUERIES ====================

    def get_artists_with_stats(
        self,
        search: str = None,
        verified_only: bool = False,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[Dict], int]:
        """
        Get paginated artists with track statistics.
        Optimized with batch statistics loading.

        Returns:
            Tuple of (artist_dicts, total_count)
        """
        query = self.db.query(Artist)

        if search:
            query = query.filter(Artist.name.ilike(f"%{search}%"))

        if verified_only:
            query = query.filter(Artist.is_verified == True)

        total = query.count()
        artists = query.order_by(Artist.name).offset(offset).limit(limit).all()

        # Get stats in batch (optimized)
        artist_ids = [a.id for a in artists]
        stats_map = self.get_track_stats_batch(artist_ids)

        # Format results
        items = []
        for artist in artists:
            artist_id_str = str(artist.id)
            stats = stats_map.get(artist_id_str, {'total': 0, 'done': 0, 'pending': 0, 'failed': 0})

            items.append({
                "id": artist_id_str,
                "name": artist.name,
                "spotify_id": artist.spotify_id,
                "image_url": artist.image_url,
                "is_verified": artist.is_verified,
                "total_tracks": stats['total'],
                "done_tracks": stats['done'],
                "pending_tracks": stats['pending'],
                "failed_tracks": stats['failed']
            })

        return items, total

    def get_pending_artists(
        self,
        search: str = None,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[Dict], int]:
        """
        Get artists that have pending tracks.
        Optimized query with JOIN filtering.

        Returns:
            Tuple of (artist_dicts, total_count)
        """
        query = self.db.query(Artist).join(TrackArtist).join(Track).filter(
            Track.processing_status == "PENDING"
        ).distinct()

        if search:
            query = query.filter(Artist.name.ilike(f"%{search}%"))

        total = query.count()
        artists = query.order_by(Artist.name).offset(offset).limit(limit).all()

        # Get stats in batch
        artist_ids = [a.id for a in artists]
        stats_map = self.get_track_stats_batch(artist_ids)

        # Format results
        items = []
        for artist in artists:
            artist_id_str = str(artist.id)
            stats = stats_map.get(artist_id_str, {'total': 0, 'done': 0, 'pending': 0})

            items.append({
                "id": artist_id_str,
                "name": artist.name,
                "spotify_id": artist.spotify_id,
                "image_url": artist.image_url,
                "pending_tracks": stats['pending'],
                "analyzed_tracks": stats['done'],
                "total_tracks": stats['total'],
                "warning": "Analyzed tracks will be kept" if stats['done'] > 0 else None
            })

        return items, total

    # ==================== TRACK OPERATIONS ====================

    def get_pending_tracks(self, artist_id: uuid.UUID) -> List[Track]:
        """Get all pending tracks for an artist."""
        return self.db.query(Track).join(TrackArtist).filter(
            TrackArtist.artist_id == artist_id,
            Track.processing_status == "PENDING"
        ).all()

    def get_analyzed_tracks(self, artist_id: uuid.UUID) -> List[Track]:
        """Get all analyzed (DONE) tracks for an artist."""
        return self.db.query(Track).join(TrackArtist).filter(
            TrackArtist.artist_id == artist_id,
            Track.processing_status == "DONE"
        ).all()

    def count_non_pending_tracks(self, artist_id: uuid.UUID) -> int:
        """Count tracks that are not pending (analyzed or failed)."""
        return self.db.query(Track).join(TrackArtist).filter(
            TrackArtist.artist_id == artist_id,
            Track.processing_status != "PENDING"
        ).count()

    # ==================== BULK OPERATIONS ====================

    def bulk_verify(self, artist_ids: List[uuid.UUID]) -> int:
        """
        Mark multiple artists as verified.
        Returns count of artists updated.
        """
        count = self.db.query(Artist).filter(
            Artist.id.in_(artist_ids)
        ).update(
            {Artist.is_verified: True},
            synchronize_session=False
        )
        self.db.flush()
        return count

    def get_by_ids(self, artist_ids: List[uuid.UUID], eager_load: List = None) -> List[Artist]:
        """Get multiple artists by IDs."""
        query = self.db.query(Artist).filter(Artist.id.in_(artist_ids))

        if eager_load:
            query = query.options(*eager_load)

        return query.all()

    # ==================== VERIFICATION ====================

    def verify_artist(self, artist_id: uuid.UUID) -> Artist:
        """Mark artist as verified."""
        artist = self.get_by_id(artist_id)
        if artist:
            artist.is_verified = True
            self.db.flush()
        return artist

    def unverify_artist(self, artist_id: uuid.UUID) -> Artist:
        """Remove verified status from artist."""
        artist = self.get_by_id(artist_id)
        if artist:
            artist.is_verified = False
            self.db.flush()
        return artist

    def get_verified_artists(
        self,
        limit: int = None,
        offset: int = 0
    ) -> Tuple[List[Artist], int]:
        """Get all verified artists."""
        return self.paginate(
            limit=limit or 100,
            offset=offset,
            filters={'is_verified': True},
            order_by=Artist.name
        )
