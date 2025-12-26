from sqlalchemy.orm import Session
from sqlalchemy.exc import ProgrammingError
from app.core.models import (
    Track, Album, Artist, ArtistCrawlLog, RejectionLog,
    TrackArtist
)
from .admin_tracks import AdminTrackService
import redis
from app.core.config import settings


class AdminDataCleaningService:
    """Service for dangerous bulk cleanup operations."""

    def __init__(self, db: Session):
        self.db = db
        self.track_service = AdminTrackService(db)

    def flush_redis_cache(self) -> bool:
        """
        Flush all Redis cache data.

        Returns:
            True if successful, False otherwise
        """
        try:
            r = redis.from_url(settings.REDIS_URL)
            r.flushdb()
            print("Redis flushed.")
            return True
        except Exception as e:
            print(f"Warning: Could not flush Redis: {e}")
            return False

    def delete_orphan_albums(self) -> int:
        """
        Delete albums that have no associated tracks.

        Returns:
            Number of albums deleted
        """
        # Find all album IDs that ARE currently used by a track
        from app.core.models import TrackAlbum
        active_album_ids = self.db.query(TrackAlbum.album_id).distinct()

        # Delete albums NOT in that list
        deleted = self.db.query(Album).filter(
            Album.id.notin_(active_album_ids)
        ).delete(synchronize_session=False)

        self.db.flush()
        print(f"Deleted {deleted} orphan albums.")
        return deleted

    def delete_orphan_artists(self) -> int:
        """
        Delete artists that have no associated tracks.

        Returns:
            Number of artists deleted
        """
        # Find all artist IDs that ARE currently linked to a track
        active_artist_ids = self.db.query(TrackArtist.artist_id).distinct()

        # Delete artists NOT in that list
        deleted = self.db.query(Artist).filter(
            Artist.id.notin_(active_artist_ids)
        ).delete(synchronize_session=False)

        self.db.flush()
        print(f"Deleted {deleted} orphan artists.")
        return deleted

    def reset_crawl_data(self) -> dict:
        """
        DANGER: Nuclear option.
        1. Flushes Redis cache
        2. Deletes ALL ArtistCrawlLogs & RejectionLogs
        3. Deletes ALL tracks with status 'PENDING' (and children)
        4. Deletes Orphan Albums (0 tracks)
        5. Deletes Orphan Artists (0 tracks)

        Returns:
            Dict with deletion statistics
        """
        try:
            # Step 1: Clear Redis
            self.flush_redis_cache()

            # Step 2: Clear Logs
            self.db.query(ArtistCrawlLog).delete()
            self.db.query(RejectionLog).delete()

            # Step 3: Delete Pending Tracks
            pending_tracks = self.db.query(Track).filter(
                Track.processing_status == "PENDING"
            ).all()
            pending_track_ids = [str(t.id) for t in pending_tracks]

            if pending_track_ids:
                print(f"Deleting {len(pending_track_ids)} pending tracks...")
                self.track_service.delete_tracks_with_cascade(pending_track_ids)
                self.db.commit()

            # Step 4: Delete Orphan Albums
            deleted_albums = self.delete_orphan_albums()
            self.db.commit()

            # Step 5: Delete Orphan Artists
            deleted_artists = self.delete_orphan_artists()
            self.db.commit()

            return {
                "status": "success",
                "message": f"Scrub complete. Deleted {len(pending_track_ids)} pending tracks, {deleted_albums} orphan albums, and {deleted_artists} orphan artists.",
                "pending_tracks_deleted": len(pending_track_ids),
                "albums_deleted": deleted_albums,
                "artists_deleted": deleted_artists
            }

        except Exception as e:
            self.db.rollback()
            print(f"Error resetting data: {e}")
            raise
