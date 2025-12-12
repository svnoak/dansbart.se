"""
Admin Artist Service - Refactored to use Repository Pattern

This is the refactored version using ArtistRepository, TrackRepository, and RejectionRepository.
Benefits:
- Centralized query logic in repositories
- Improved query optimization through batch operations
- Better separation of concerns
- Easier to test and maintain
"""
from sqlalchemy.orm import Session
from app.repository.artist import ArtistRepository
from app.repository.track import TrackRepository
from app.repository.rejection import RejectionRepository
from app.core.models import Track, PlaybackLink
from .admin_query_helpers import build_paginated_response


class AdminArtistService:
    """Service for artist-specific admin operations (using repositories)."""

    def __init__(self, db: Session):
        self.db = db
        self.artist_repo = ArtistRepository(db)
        self.track_repo = TrackRepository(db)
        self.rejection_repo = RejectionRepository(db)

    def get_artist_isolation_info(self, artist_id: str) -> dict:
        """
        Get isolation info for an artist.
        Delegates to ArtistRepository's optimized implementation.
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

        NOTE: The 'isolated' filter is kept for backwards compatibility
        but requires in-memory filtering (expensive operation).
        Consider using separate endpoints for isolated vs all artists.
        """
        import uuid

        # If filtering by isolation, we need special handling
        if isolated is not None:
            filter_isolated = isolated.lower() == 'true'

            # Get all artists first (with search if provided)
            if search:
                all_artists, _ = self.artist_repo.search_by_name(search, limit=10000, offset=0)
            else:
                all_artists, _ = self.artist_repo.paginate(limit=10000, offset=0, order_by=self.artist_repo.model.name)

            # Filter by isolation status in memory
            filtered_artists = []
            for artist in all_artists:
                # Hide verified artists when showing isolated list
                if filter_isolated and artist.is_verified:
                    continue

                isolation_info = self.artist_repo.get_isolation_info(artist.id)
                if isolation_info["is_isolated"] == filter_isolated:
                    filtered_artists.append(artist)

            total = len(filtered_artists)
            artists = filtered_artists[offset:offset + limit]

            # Convert to UUIDs for batch operations
            artist_uuids = [artist.id for artist in artists]

        else:
            # Optimized path without isolation filtering
            artists_dicts, total = self.artist_repo.get_artists_with_stats(
                search=search,
                limit=limit,
                offset=offset
            )

            # Get isolation info for each artist
            for artist_dict in artists_dicts:
                isolation_info = self.artist_repo.get_isolation_info(uuid.UUID(artist_dict['id']))
                artist_dict.update({
                    "is_isolated": isolation_info["is_isolated"],
                    "shared_with_artists": isolation_info["shared_with_artists"],
                    "shared_tracks": isolation_info["shared_tracks"],
                    "shared_albums": isolation_info["shared_albums"]
                })

            return build_paginated_response(artists_dicts, total, limit, offset)

        # Build response for isolation-filtered results
        artist_uuids = [artist.id for artist in artists]
        stats_map = self.artist_repo.get_track_stats_batch(artist_uuids)

        items = []
        for artist in artists:
            artist_id_str = str(artist.id)
            stats = stats_map.get(artist_id_str, {'total': 0, 'done': 0, 'pending': 0})
            isolation_info = self.artist_repo.get_isolation_info(artist.id)

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
        Uses optimized repository method.
        """
        import uuid

        artists_dicts, total = self.artist_repo.get_pending_artists(
            search=search,
            limit=limit,
            offset=offset
        )

        # Add isolation info
        for artist_dict in artists_dicts:
            isolation_info = self.artist_repo.get_isolation_info(uuid.UUID(artist_dict['id']))
            artist_dict.update({
                "is_isolated": isolation_info["is_isolated"],
                "shared_with_artists": isolation_info["shared_with_artists"],
                "shared_tracks": isolation_info["shared_tracks"],
                "shared_albums": isolation_info["shared_albums"]
            })

        return build_paginated_response(artists_dicts, total, limit, offset)

    def reject_artist(
        self,
        artist_id: str,
        reason: str,
        dry_run: bool = False
    ) -> dict:
        """
        Reject an artist and delete pending tracks.
        Uses repositories for cleaner separation.
        """
        import uuid

        artist_uuid = uuid.UUID(artist_id)
        artist = self.artist_repo.get_by_id(artist_uuid)

        if not artist:
            raise ValueError("Artist not found")

        artist_name = artist.name
        spotify_id = artist.spotify_id

        # Get isolation info
        isolation_info = self.artist_repo.get_isolation_info(artist_uuid)

        # Get pending and analyzed tracks
        pending_tracks = self.artist_repo.get_pending_tracks(artist_uuid)
        analyzed_tracks = self.artist_repo.get_analyzed_tracks(artist_uuid)
        remaining_tracks_count = self.artist_repo.count_non_pending_tracks(artist_uuid)

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
            self.rejection_repo.add_to_blocklist(
                entity_type='artist',
                spotify_id=spotify_id,
                name=artist_name,
                reason=reason
            )

        # Delete pending tracks (with cascade)
        pending_track_ids = [t.id for t in pending_tracks]
        if pending_track_ids:
            self.track_repo.delete_with_cascade(pending_track_ids)

        # Delete artist if no remaining tracks
        if remaining_tracks_count == 0:
            self.artist_repo.delete(artist)

        self.artist_repo.commit()

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
        """
        import uuid

        artist_uuid = uuid.UUID(artist_id)
        artist = self.artist_repo.get_by_id(artist_uuid)

        if not artist:
            raise ValueError("Artist not found")

        # Get pending tracks
        pending_tracks = self.artist_repo.get_pending_tracks(artist_uuid)

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
        Uses repository for optimized bulk operations.
        """
        import uuid

        artist_uuids = [uuid.UUID(aid) for aid in artist_ids]
        artists = self.artist_repo.get_by_ids(artist_uuids)

        success_count = 0
        total_tracks_queued = 0
        errors = 0

        from app.workers.tasks import analyze_track_task

        for artist in artists:
            try:
                # Mark as verified using repository
                self.artist_repo.verify_artist(artist.id)

                # Queue pending tracks
                pending_tracks = self.artist_repo.get_pending_tracks(artist.id)

                for track in pending_tracks:
                    analyze_track_task.delay(str(track.id))

                total_tracks_queued += len(pending_tracks)
                success_count += 1

            except Exception as e:
                print(f"Error approving {artist.id}: {e}")
                errors += 1

        self.artist_repo.commit()

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
        Uses repositories for cleaner separation.
        """
        import uuid

        artist_uuids = [uuid.UUID(aid) for aid in artist_ids]
        artists = self.artist_repo.get_by_ids(artist_uuids)

        success_count = 0
        errors = 0

        for artist in artists:
            try:
                # Add to blocklist
                if artist.spotify_id:
                    self.rejection_repo.add_to_blocklist(
                        entity_type='artist',
                        spotify_id=artist.spotify_id,
                        name=artist.name,
                        reason=reason
                    )

                # Delete pending tracks
                pending_tracks = self.artist_repo.get_pending_tracks(artist.id)
                pending_track_ids = [t.id for t in pending_tracks]

                if pending_track_ids:
                    self.track_repo.delete_with_cascade(pending_track_ids)

                # Delete artist if no tracks left
                remaining_tracks = self.artist_repo.count_non_pending_tracks(artist.id)

                if remaining_tracks == 0:
                    self.artist_repo.delete(artist)

                success_count += 1

            except Exception as e:
                print(f"Error rejecting {artist.id}: {e}")
                errors += 1

        self.artist_repo.commit()

        return {
            "status": "success",
            "message": f"Rejected {success_count} artists. {errors} failed.",
            "artists_rejected": success_count,
            "errors": errors
        }
