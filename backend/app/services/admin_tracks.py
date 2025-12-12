from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, case
from app.core.models import (
    Track, PlaybackLink, AnalysisSource, TrackDanceStyle,
    TrackStyleVote, TrackFeelVote, TrackStructureVersion,
    TrackArtist, TrackPlayback, UserInteraction
)
from .admin_query_helpers import build_paginated_response, TRACK_EAGER_LOAD
from .admin_rejections import AdminRejectionService


class AdminTrackService:
    """Service for track-specific admin operations."""

    def __init__(self, db: Session):
        self.db = db
        self.rejection_service = AdminRejectionService(db)

    def get_tracks_paginated(
        self,
        search: str = None,
        status: str = None,
        flagged: bool = None,
        artist_id: str = None,
        album_id: str = None,
        limit: int = 50,
        offset: int = 0
    ) -> dict:
        """
        Get paginated list of tracks with filtering.

        Args:
            search: Search by title
            status: Filter by processing status
            flagged: Filter by flagged status
            artist_id: Filter by artist ID
            album_id: Filter by album ID
            limit: Items per page
            offset: Pagination offset

        Returns:
            Paginated response with track list
        """
        # Build query with appropriate joins
        if artist_id:
            query = self.db.query(Track).join(Track.artist_links).options(
                *TRACK_EAGER_LOAD
            ).filter(TrackArtist.artist_id == artist_id)
        else:
            query = self.db.query(Track).options(*TRACK_EAGER_LOAD)

        # Apply filters
        if search:
            query = query.filter(Track.title.ilike(f"%{search}%"))

        if status:
            query = query.filter(Track.processing_status == status)

        if flagged is not None:
            query = query.filter(Track.is_flagged == flagged)

        if album_id:
            query = query.filter(Track.album_id == album_id)

        total = query.count()
        tracks = query.order_by(Track.created_at.desc()).offset(offset).limit(limit).all()

        # Format results
        items = []
        for track in tracks:
            primary_style = next((s for s in track.dance_styles if s.is_primary), None)
            artist_names = [link.artist.name for link in track.artist_links] if track.artist_links else []

            items.append({
                "id": str(track.id),
                "title": track.title,
                "artists": artist_names,
                "album_title": track.album.title if track.album else None,
                "album_id": str(track.album_id) if track.album_id else None,
                "status": track.processing_status,
                "dance_style": primary_style.dance_style if primary_style else None,
                "confidence": primary_style.confidence if primary_style else None,
                "created_at": track.created_at.isoformat() if track.created_at else None,
                "is_flagged": track.is_flagged,
                "flagged_at": track.flagged_at.isoformat() if track.flagged_at else None,
                "flag_reason": track.flag_reason
            })

        return build_paginated_response(items, total, limit, offset)

    def delete_tracks_with_cascade(self, track_ids: list[str]) -> int:
        """
        Delete tracks and all related records (cascade delete).

        Args:
            track_ids: List of track IDs to delete

        Returns:
            Number of tracks deleted
        """
        if not track_ids:
            return 0

        # Delete related records first (manual cascade)
        self.db.query(TrackArtist).filter(
            TrackArtist.track_id.in_(track_ids)
        ).delete(synchronize_session=False)

        self.db.query(PlaybackLink).filter(
            PlaybackLink.track_id.in_(track_ids)
        ).delete(synchronize_session=False)

        self.db.query(AnalysisSource).filter(
            AnalysisSource.track_id.in_(track_ids)
        ).delete(synchronize_session=False)

        self.db.query(TrackDanceStyle).filter(
            TrackDanceStyle.track_id.in_(track_ids)
        ).delete(synchronize_session=False)

        self.db.query(TrackStyleVote).filter(
            TrackStyleVote.track_id.in_(track_ids)
        ).delete(synchronize_session=False)

        self.db.query(TrackFeelVote).filter(
            TrackFeelVote.track_id.in_(track_ids)
        ).delete(synchronize_session=False)

        self.db.query(TrackStructureVersion).filter(
            TrackStructureVersion.track_id.in_(track_ids)
        ).delete(synchronize_session=False)

        # Try to delete from optional tables
        try:
            self.db.query(TrackPlayback).filter(
                TrackPlayback.track_id.in_(track_ids)
            ).delete(synchronize_session=False)
        except Exception:
            self.db.rollback()

        try:
            self.db.query(UserInteraction).filter(
                UserInteraction.track_id.in_(track_ids)
            ).delete(synchronize_session=False)
        except Exception:
            self.db.rollback()

        # Delete the tracks themselves
        deleted = self.db.query(Track).filter(
            Track.id.in_(track_ids)
        ).delete(synchronize_session=False)

        self.db.flush()
        return deleted

    def get_track_stats(self, entity_type: str, entity_ids: list[str]) -> dict:
        """
        Get track statistics for entities (artists or albums) in a single batch query.

        Args:
            entity_type: 'artist' or 'album'
            entity_ids: List of entity IDs

        Returns:
            Dict mapping entity_id -> {total, done, pending, failed}
        """
        if not entity_ids:
            return {}

        # Build appropriate join based on entity type
        if entity_type == 'artist':
            query = self.db.query(
                TrackArtist.artist_id.label('entity_id'),
                func.count(Track.id).label('total'),
                func.sum(
                    case((Track.processing_status == 'DONE', 1), else_=0)
                ).label('done'),
                func.sum(
                    case((Track.processing_status == 'PENDING', 1), else_=0)
                ).label('pending'),
                func.sum(
                    case((Track.processing_status == 'FAILED', 1), else_=0)
                ).label('failed')
            ).join(Track, TrackArtist.track_id == Track.id).filter(
                TrackArtist.artist_id.in_(entity_ids)
            ).group_by(TrackArtist.artist_id)
        else:  # album
            query = self.db.query(
                Track.album_id.label('entity_id'),
                func.count(Track.id).label('total'),
                func.sum(
                    case((Track.processing_status == 'DONE', 1), else_=0)
                ).label('done'),
                func.sum(
                    case((Track.processing_status == 'PENDING', 1), else_=0)
                ).label('pending'),
                func.sum(
                    case((Track.processing_status == 'FAILED', 1), else_=0)
                ).label('failed')
            ).filter(Track.album_id.in_(entity_ids)).group_by(Track.album_id)

        results = query.all()

        # Convert to dict
        stats_map = {}
        for row in results:
            stats_map[str(row.entity_id)] = {
                'total': int(row.total or 0),
                'done': int(row.done or 0),
                'pending': int(row.pending or 0),
                'failed': int(row.failed or 0)
            }

        # Fill in zeros for entities with no tracks
        for entity_id in entity_ids:
            if str(entity_id) not in stats_map:
                stats_map[str(entity_id)] = {
                    'total': 0,
                    'done': 0,
                    'pending': 0,
                    'failed': 0
                }

        return stats_map

    def reject_track(self, track_id: str, reason: str, dry_run: bool = False) -> dict:
        """
        Reject a track and optionally add to blocklist.

        Args:
            track_id: Track ID to reject
            reason: Reason for rejection
            dry_run: If True, preview without making changes

        Returns:
            Status dict with operation results
        """
        track = self.db.query(Track).filter(Track.id == track_id).first()
        if not track:
            raise ValueError("Track not found")

        # Get Spotify ID from playback links
        spotify_link = next((l for l in track.playback_links if l.platform == 'spotify'), None)
        spotify_id = None
        if spotify_link:
            link = spotify_link.deep_link
            if link.startswith('spotify:track:'):
                spotify_id = link.split(':')[-1]
            elif '/track/' in link:
                spotify_id = link.split('/track/')[-1].split('?')[0]

        track_title = track.title
        artist_name = track.primary_artist.name if track.primary_artist else None

        # Dry run preview
        if dry_run:
            return {
                "status": "dry_run",
                "message": f"DRY RUN: Would reject track '{track_title}'",
                "preview": {
                    "track_id": str(track.id),
                    "track_title": track_title,
                    "artist": artist_name,
                    "album": track.album.title if track.album else None,
                    "status": track.processing_status,
                    "would_blocklist": spotify_id is not None,
                    "spotify_id": spotify_id
                }
            }

        # Add to rejection log if we have a Spotify ID
        if spotify_id:
            self.rejection_service.add_to_blocklist(
                entity_type='track',
                spotify_id=spotify_id,
                name=track_title,
                reason=reason,
                additional_data={'artist': artist_name}
            )

        # Delete the track
        self.db.delete(track)
        self.db.flush()

        return {
            "status": "success",
            "message": f"Track '{track_title}' has been rejected and deleted",
            "blocklisted": spotify_id is not None
        }
