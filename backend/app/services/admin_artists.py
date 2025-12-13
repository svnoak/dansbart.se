from sqlalchemy.orm import Session
from sqlalchemy import func, case
from app.core.models import Artist, Track, TrackArtist, PlaybackLink, Album
from app.repository.artist import ArtistRepository
from app.repository.track import TrackRepository
from app.repository.rejection import RejectionRepository
from .admin_query_helpers import build_paginated_response
from .admin_rejections import AdminRejectionService
from .admin_tracks import AdminTrackService
import uuid


class AdminArtistService:
    """Service for artist-specific admin operations (using repositories)."""

    def __init__(self, db: Session):
        self.db = db
        # Keep old services for backwards compatibility during migration
        self.rejection_service = AdminRejectionService(db)
        self.track_service = AdminTrackService(db)
        # New repositories
        self.artist_repo = ArtistRepository(db)
        self.track_repo = TrackRepository(db)
        self.rejection_repo = RejectionRepository(db)

    def get_artist_isolation_info(self, artist_id: str) -> dict:
        """
        Optimized check if an artist is isolated or shares content.
        Now delegated to ArtistRepository for better organization.

        Args:
            artist_id: Artist ID to check

        Returns:
            Dict with isolation info
        """
        import uuid
        return self.artist_repo.get_isolation_info(uuid.UUID(artist_id))

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

    def get_collaboration_network(self, artist_id: str) -> dict:
        """
        Get detailed collaboration network for an artist.
        Returns all collaborating artists and albums for rejection workflow.

        Args:
            artist_id: Artist ID to analyze

        Returns:
            Dict with artists and albums in the collaboration network
        """
        artist = self.db.query(Artist).filter(Artist.id == artist_id).first()
        if not artist:
            raise ValueError("Artist not found")

        # Get all tracks by this artist
        artist_tracks = self.db.query(Track).join(TrackArtist).filter(
            TrackArtist.artist_id == artist_id
        ).all()

        # Find collaborating artists
        collab_artists = {}
        collab_albums = {}

        for track in artist_tracks:
            # Check if track has multiple artists
            track_artist_links = self.db.query(TrackArtist).filter(
                TrackArtist.track_id == track.id
            ).all()

            if len(track_artist_links) > 1:
                # This is a collaboration
                for link in track_artist_links:
                    artist_obj = link.artist
                    artist_key = str(artist_obj.id)

                    # Add collaborating artist (excluding the main artist)
                    if artist_key not in collab_artists:
                        collab_artists[artist_key] = {
                            "id": artist_key,
                            "name": artist_obj.name,
                            "image_url": artist_obj.image_url,
                            "track_count": 0,
                            "shared_track_count": 0
                        }

                    # Count tracks for this artist
                    total_artist_tracks = self.db.query(Track).join(TrackArtist).filter(
                        TrackArtist.artist_id == artist_obj.id
                    ).count()

                    collab_artists[artist_key]["track_count"] = total_artist_tracks

                    # Count shared tracks
                    if artist_key != artist_id:
                        collab_artists[artist_key]["shared_track_count"] += 1

            # Add album if it's a collaboration
            if track.album and len(track_artist_links) > 1:
                album_key = str(track.album.id)
                if album_key not in collab_albums:
                    # Get all artists on this album
                    album_artists = self.db.query(Artist).join(TrackArtist).join(Track).filter(
                        Track.album_id == track.album.id
                    ).distinct().all()

                    collab_albums[album_key] = {
                        "id": album_key,
                        "title": track.album.title,
                        "cover_image_url": track.album.cover_image_url,
                        "artist_name": track.album.artist.name if track.album.artist else "Unknown",
                        "artists": [a.name for a in album_artists],
                        "track_count": self.db.query(Track).filter(
                            Track.album_id == track.album.id
                        ).count()
                    }

        # Remove the main artist from the collaboration list
        if artist_id in collab_artists:
            del collab_artists[artist_id]

        return {
            "artists": list(collab_artists.values()),
            "albums": list(collab_albums.values())
        }

    def reject_network(self, artist_ids: list[str], album_ids: list[str], reason: str) -> dict:
        """
        Reject a network of artists and albums together.
        This is used for the enhanced rejection modal workflow.

        Args:
            artist_ids: List of artist IDs to reject
            album_ids: List of album IDs to reject
            reason: Reason for rejection

        Returns:
            Status dict with operation results
        """
        rejected_artists = 0
        rejected_albums = 0
        deleted_tracks = 0
        errors = []

        # Reject artists
        for artist_id_str in artist_ids:
            try:
                artist_uuid = uuid.UUID(artist_id_str)
                artist = self.db.query(Artist).filter(Artist.id == artist_uuid).first()

                if not artist:
                    errors.append(f"Artist {artist_id_str} not found")
                    continue

                # Add to blocklist
                if artist.spotify_id:
                    self.rejection_service.add_to_blocklist(
                        entity_type='artist',
                        spotify_id=artist.spotify_id,
                        name=artist.name,
                        reason=reason
                    )

                # Get all tracks for this artist
                artist_tracks = self.db.query(Track).join(TrackArtist).filter(
                    TrackArtist.artist_id == artist_uuid
                ).all()

                # Delete all tracks
                for track in artist_tracks:
                    # Delete playback links
                    self.db.query(PlaybackLink).filter(
                        PlaybackLink.track_id == track.id
                    ).delete()

                    self.db.delete(track)
                    deleted_tracks += 1

                # Delete artist
                self.db.delete(artist)
                rejected_artists += 1

            except Exception as e:
                errors.append(f"Error rejecting artist {artist_id_str}: {str(e)}")

        # Reject albums
        for album_id_str in album_ids:
            try:
                album_uuid = uuid.UUID(album_id_str)
                album = self.db.query(Album).filter(Album.id == album_uuid).first()

                if not album:
                    errors.append(f"Album {album_id_str} not found")
                    continue

                # Get all tracks in this album
                album_tracks = self.db.query(Track).filter(
                    Track.album_id == album_uuid
                ).all()

                # Delete all tracks in the album
                for track in album_tracks:
                    # Delete playback links
                    self.db.query(PlaybackLink).filter(
                        PlaybackLink.track_id == track.id
                    ).delete()

                    self.db.delete(track)
                    deleted_tracks += 1

                # Add album to blocklist if it has spotify_id
                if album.spotify_id:
                    self.rejection_service.add_to_blocklist(
                        entity_type='album',
                        spotify_id=album.spotify_id,
                        name=album.title,
                        reason=reason
                    )

                # Delete album
                self.db.delete(album)
                rejected_albums += 1

            except Exception as e:
                errors.append(f"Error rejecting album {album_id_str}: {str(e)}")

        self.db.flush()

        message = f"Rejected {rejected_artists} artist(s) and {rejected_albums} album(s). Deleted {deleted_tracks} track(s)."
        if errors:
            message += f" {len(errors)} error(s) occurred."

        return {
            "status": "success" if len(errors) == 0 else "partial_success",
            "message": message,
            "rejected_artists": rejected_artists,
            "rejected_albums": rejected_albums,
            "deleted_tracks": deleted_tracks,
            "errors": errors
        }
