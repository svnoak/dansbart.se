from sqlalchemy.orm import Session
from sqlalchemy import func, case
from app.core.models import Artist, Track, TrackArtist, PlaybackLink
from .admin_query_helpers import build_paginated_response
from .admin_rejections import AdminRejectionService
from .admin_tracks import AdminTrackService


class AdminArtistService:
    """Service for artist-specific admin operations."""

    def __init__(self, db: Session):
        self.db = db
        self.rejection_service = AdminRejectionService(db)
        self.track_service = AdminTrackService(db)

    def get_artist_isolation_info(self, artist_id: str) -> dict:
        """
        Optimized check if an artist is isolated or shares content.
        Uses SQL aggregation instead of loading all tracks into memory.

        Args:
            artist_id: Artist ID to check

        Returns:
            Dict with isolation info
        """
        # Query to find tracks with multiple artists
        collaboration_query = self.db.query(
            Track.id.label('track_id'),
            Track.album_id,
            func.count(TrackArtist.artist_id).label('artist_count')
        ).join(TrackArtist).filter(
            TrackArtist.track_id.in_(
                self.db.query(TrackArtist.track_id).filter(
                    TrackArtist.artist_id == artist_id
                )
            )
        ).group_by(Track.id, Track.album_id).subquery()

        # Get tracks where this artist collaborates (artist_count > 1)
        collab_tracks = self.db.query(
            collaboration_query.c.track_id,
            collaboration_query.c.album_id
        ).filter(collaboration_query.c.artist_count > 1).all()

        # Get names of collaborating artists
        shared_with = set()
        shared_album_ids = set()

        if collab_tracks:
            track_ids = [t.track_id for t in collab_tracks]

            # Get other artists on these tracks
            other_artists = self.db.query(Artist.name).join(TrackArtist).filter(
                TrackArtist.track_id.in_(track_ids),
                TrackArtist.artist_id != artist_id
            ).distinct().all()

            shared_with = {name for (name,) in other_artists}
            shared_album_ids = {t.album_id for t in collab_tracks if t.album_id}

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

    def get_artists_paginated(
        self,
        search: str = None,
        isolated: str = None,
        limit: int = 50,
        offset: int = 0
    ) -> dict:
        """
        Get paginated list of artists with filtering.

        Args:
            search: Search by name
            isolated: Filter by isolation status ('true' or 'false')
            limit: Items per page
            offset: Pagination offset

        Returns:
            Paginated response with artist list
        """
        query = self.db.query(Artist)

        if search:
            query = query.filter(Artist.name.ilike(f"%{search}%"))

        # If filtering by isolation, we need to process all artists
        if isolated is not None:
            filter_isolated = isolated.lower() == 'true'
            all_artists = query.order_by(Artist.name).all()

            # Filter by isolation status
            filtered_artists = []
            for artist in all_artists:
                # Hide verified artists when showing isolated list
                if filter_isolated and artist.is_verified:
                    continue

                isolation_info = self.get_artist_isolation_info(str(artist.id))
                if isolation_info["is_isolated"] == filter_isolated:
                    filtered_artists.append(artist)

            total = len(filtered_artists)
            artists = filtered_artists[offset:offset + limit]
        else:
            # Optimize when no isolation filter
            total = query.count()
            artists = query.order_by(Artist.name).offset(offset).limit(limit).all()

        # Get track stats in batch
        artist_ids = [str(a.id) for a in artists]
        stats_map = self.track_service.get_track_stats('artist', artist_ids)

        # Format results
        items = []
        for artist in artists:
            artist_id_str = str(artist.id)
            stats = stats_map.get(artist_id_str, {'total': 0, 'done': 0, 'pending': 0})
            isolation_info = self.get_artist_isolation_info(artist_id_str)

            items.append({
                "id": artist_id_str,
                "name": artist.name,
                "spotify_id": artist.spotify_id,
                "image_url": artist.image_url,
                "total_tracks": stats['total'],
                "done_tracks": stats['done'],
                "pending_tracks": stats['pending'],
                "is_isolated": isolation_info["is_isolated"],
                "is_verified": artist.is_verified,
                "shared_with_artists": isolation_info["shared_with_artists"],
                "shared_tracks": isolation_info["shared_tracks"],
                "shared_albums": isolation_info["shared_albums"]
            })

        return build_paginated_response(items, total, limit, offset)

    def get_pending_artists(
        self,
        search: str = None,
        limit: int = 50,
        offset: int = 0
    ) -> dict:
        """
        Get artists with pending tracks.

        Args:
            search: Search by name
            limit: Items per page
            offset: Pagination offset

        Returns:
            Paginated response with pending artist list
        """
        query = self.db.query(Artist).join(TrackArtist).join(Track).filter(
            Track.processing_status == "PENDING"
        ).distinct()

        if search:
            query = query.filter(Artist.name.ilike(f"%{search}%"))

        total = query.count()
        artists = query.order_by(Artist.name).offset(offset).limit(limit).all()

        # Get track stats
        artist_ids = [str(a.id) for a in artists]
        stats_map = self.track_service.get_track_stats('artist', artist_ids)

        # Format results
        items = []
        for artist in artists:
            artist_id_str = str(artist.id)
            stats = stats_map.get(artist_id_str, {'total': 0, 'done': 0, 'pending': 0})
            isolation_info = self.get_artist_isolation_info(artist_id_str)

            items.append({
                "id": artist_id_str,
                "name": artist.name,
                "spotify_id": artist.spotify_id,
                "image_url": artist.image_url,
                "pending_tracks": stats['pending'],
                "analyzed_tracks": stats['done'],
                "total_tracks": stats['total'],
                "warning": "Analyzed tracks will be kept" if stats['done'] > 0 else None,
                "is_isolated": isolation_info["is_isolated"],
                "shared_with_artists": isolation_info["shared_with_artists"],
                "shared_tracks": isolation_info["shared_tracks"],
                "shared_albums": isolation_info["shared_albums"]
            })

        return build_paginated_response(items, total, limit, offset)

    def reject_artist(
        self,
        artist_id: str,
        reason: str,
        dry_run: bool = False
    ) -> dict:
        """
        Reject an artist and delete pending tracks.

        Args:
            artist_id: Artist ID to reject
            reason: Reason for rejection
            dry_run: If True, preview without making changes

        Returns:
            Status dict with operation results
        """
        artist = self.db.query(Artist).filter(Artist.id == artist_id).first()
        if not artist:
            raise ValueError("Artist not found")

        artist_name = artist.name
        spotify_id = artist.spotify_id

        # Get isolation info
        isolation_info = self.get_artist_isolation_info(artist_id)

        # Get pending and analyzed tracks
        pending_tracks = self.db.query(Track).join(TrackArtist).filter(
            TrackArtist.artist_id == artist_id,
            Track.processing_status == "PENDING"
        ).all()

        analyzed_tracks = self.db.query(Track).join(TrackArtist).filter(
            TrackArtist.artist_id == artist_id,
            Track.processing_status == "DONE"
        ).all()

        remaining_tracks_count = self.db.query(Track).join(TrackArtist).filter(
            TrackArtist.artist_id == artist_id,
            Track.processing_status != "PENDING"
        ).count()

        # Dry run preview
        if dry_run:
            return {
                "status": "dry_run",
                "message": f"DRY RUN: Would reject artist '{artist_name}'",
                "preview": {
                    "artist_name": artist_name,
                    "spotify_id": spotify_id,
                    "would_delete_pending_tracks": len(pending_tracks),
                    "would_keep_analyzed_tracks": len(analyzed_tracks),
                    "would_delete_artist": remaining_tracks_count == 0,
                    "would_blocklist": spotify_id is not None,
                    "isolation_info": isolation_info,
                    "sample_pending_tracks": [
                        {
                            "title": t.title,
                            "album": t.album.title if t.album else None
                        } for t in pending_tracks[:10]
                    ],
                    "sample_kept_tracks": [
                        {
                            "title": t.title,
                            "album": t.album.title if t.album else None
                        } for t in analyzed_tracks[:10]
                    ] if analyzed_tracks else []
                }
            }

        # Add to rejection log
        if spotify_id:
            self.rejection_service.add_to_blocklist(
                entity_type='artist',
                spotify_id=spotify_id,
                name=artist_name,
                reason=reason
            )

        # Delete pending tracks
        for track in pending_tracks:
            self.db.query(PlaybackLink).filter(
                PlaybackLink.track_id == track.id
            ).delete()
            self.db.delete(track)

        # Delete artist if no remaining tracks
        if remaining_tracks_count == 0:
            self.db.delete(artist)

        self.db.flush()

        return {
            "status": "success",
            "message": f"Artist '{artist_name}' rejected. Deleted {len(pending_tracks)} pending tracks.",
            "artist_deleted": remaining_tracks_count == 0,
            "kept_tracks": len(analyzed_tracks),
            "blocklisted": spotify_id is not None,
            "isolation_info": isolation_info
        }

    def approve_artist(self, artist_id: str) -> dict:
        """
        Approve an artist by queuing pending tracks for analysis.

        Args:
            artist_id: Artist ID to approve

        Returns:
            Status dict with operation results
        """
        artist = self.db.query(Artist).filter(Artist.id == artist_id).first()
        if not artist:
            raise ValueError("Artist not found")

        # Get pending tracks
        pending_tracks = self.db.query(Track).join(TrackArtist).filter(
            TrackArtist.artist_id == artist_id,
            Track.processing_status == "PENDING"
        ).all()

        if not pending_tracks:
            return {
                "status": "success",
                "message": f"No pending tracks found for {artist.name}",
                "tracks_queued": 0
            }

        # Queue tracks for analysis
        from app.workers.tasks import analyze_track_task
        for track in pending_tracks:
            analyze_track_task.delay(str(track.id))

        return {
            "status": "success",
            "message": f"Queued {len(pending_tracks)} tracks for analysis for {artist.name}",
            "tracks_queued": len(pending_tracks)
        }

    def bulk_approve_artists(self, artist_ids: list[str]) -> dict:
        """
        Approve multiple artists at once.

        Args:
            artist_ids: List of artist IDs

        Returns:
            Status dict with operation results
        """
        success_count = 0
        total_tracks_queued = 0
        errors = 0

        artists = self.db.query(Artist).filter(Artist.id.in_(artist_ids)).all()

        from app.workers.tasks import analyze_track_task

        for artist in artists:
            try:
                # Mark as verified
                artist.is_verified = True

                # Queue pending tracks
                pending_tracks = self.db.query(Track).join(TrackArtist).filter(
                    TrackArtist.artist_id == artist.id,
                    Track.processing_status == "PENDING"
                ).all()

                for track in pending_tracks:
                    analyze_track_task.delay(str(track.id))

                total_tracks_queued += len(pending_tracks)
                success_count += 1

            except Exception as e:
                print(f"Error approving {artist.id}: {e}")
                errors += 1

        self.db.flush()

        return {
            "status": "success",
            "message": f"Verified {success_count} artists. Queued {total_tracks_queued} tracks.",
            "artists_approved": success_count,
            "tracks_queued": total_tracks_queued,
            "errors": errors
        }

    def bulk_reject_artists(self, artist_ids: list[str], reason: str) -> dict:
        """
        Reject multiple artists at once.

        Args:
            artist_ids: List of artist IDs
            reason: Reason for rejection

        Returns:
            Status dict with operation results
        """
        success_count = 0
        errors = 0

        artists = self.db.query(Artist).filter(Artist.id.in_(artist_ids)).all()

        for artist in artists:
            try:
                # Add to blocklist
                if artist.spotify_id:
                    self.rejection_service.add_to_blocklist(
                        entity_type='artist',
                        spotify_id=artist.spotify_id,
                        name=artist.name,
                        reason=reason
                    )

                # Delete pending tracks
                pending_tracks = self.db.query(Track).join(TrackArtist).filter(
                    TrackArtist.artist_id == artist.id,
                    Track.processing_status == "PENDING"
                ).all()

                for track in pending_tracks:
                    self.db.query(PlaybackLink).filter(
                        PlaybackLink.track_id == track.id
                    ).delete()
                    self.db.delete(track)

                # Delete artist if no tracks left
                remaining_tracks = self.db.query(Track).join(TrackArtist).filter(
                    TrackArtist.artist_id == artist.id,
                    Track.processing_status != "PENDING"
                ).count()

                if remaining_tracks == 0:
                    self.db.delete(artist)

                success_count += 1

            except Exception as e:
                print(f"Error rejecting {artist.id}: {e}")
                errors += 1

        self.db.flush()

        return {
            "status": "success",
            "message": f"Rejected {success_count} artists. {errors} failed.",
            "artists_rejected": success_count,
            "errors": errors
        }
