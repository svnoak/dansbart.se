"""
Duplicate Track Merger Service

Merges duplicate tracks with the same ISRC into a single canonical track
with multiple album links via the track_albums junction table.
"""

from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.models import (
    Track, TrackAlbum, TrackArtist, PlaybackLink, TrackDanceStyle,
    AnalysisSource, TrackStyleVote, TrackFeelVote, TrackStructureVersion,
    TrackPlayback, UserInteraction
)
import uuid
from typing import List, Dict, Optional


class DuplicateMergerService:
    """Service to merge duplicate tracks with the same ISRC."""

    def __init__(self, db: Session):
        self.db = db

    def find_mergeable_duplicates(self, limit: int = 100) -> List[Dict]:
        """
        Find groups of tracks with the same ISRC that can be merged.

        Returns:
            List of dicts with ISRC, track count, and sample track IDs
        """
        duplicates = self.db.query(
            Track.isrc,
            func.count(Track.id).label('track_count'),
            func.array_agg(Track.id).label('track_ids')
        ).filter(
            Track.isrc != None,
            ~Track.isrc.like('FALLBACK-%')
        ).group_by(
            Track.isrc
        ).having(
            func.count(Track.id) > 1
        ).order_by(
            func.count(Track.id).desc()
        ).limit(limit).all()

        return [
            {
                'isrc': dup.isrc,
                'track_count': dup.track_count,
                'track_ids': [str(tid) for tid in dup.track_ids]
            }
            for dup in duplicates
        ]

    def get_duplicate_analysis(self, isrc: str) -> Dict:
        """
        Analyze duplicates for a specific ISRC.

        Returns detailed information about what would be merged.
        """
        tracks = self.db.query(Track).filter(Track.isrc == isrc).all()

        if len(tracks) <= 1:
            return {
                'isrc': isrc,
                'mergeable': False,
                'reason': 'No duplicates found'
            }

        # Analyze albums
        all_album_ids = set()
        track_details = []

        for track in tracks:
            album_ids = [link.album_id for link in track.album_links]
            all_album_ids.update(album_ids)

            track_details.append({
                'track_id': str(track.id),
                'title': track.title,
                'album_count': len(album_ids),
                'album_ids': [str(aid) for aid in album_ids],
                'has_analysis': track.processing_status == 'DONE',
                'playback_links_count': len(track.playback_links),
                'created_at': track.created_at.isoformat() if track.created_at else None
            })

        # Determine canonical track (prefer analyzed, then oldest)
        analyzed_tracks = [t for t in tracks if t.processing_status == 'DONE']
        if analyzed_tracks:
            canonical = min(analyzed_tracks, key=lambda t: t.created_at)
        else:
            canonical = min(tracks, key=lambda t: t.created_at)

        return {
            'isrc': isrc,
            'mergeable': True,
            'track_count': len(tracks),
            'unique_albums': len(all_album_ids),
            'canonical_track_id': str(canonical.id),
            'canonical_track_title': canonical.title,
            'tracks': track_details
        }

    def merge_duplicates_by_isrc(self, isrc: str, dry_run: bool = False) -> Dict:
        """
        Merge all tracks with the same ISRC into a single canonical track.

        Strategy:
        1. Identify canonical track (prefer analyzed, then oldest)
        2. Migrate all album links to canonical track
        3. Migrate all playback links to canonical track (deduplicate)
        4. Migrate user interactions/votes to canonical track
        5. Delete duplicate tracks

        Args:
            isrc: The ISRC to merge duplicates for
            dry_run: If True, preview without making changes

        Returns:
            Dict with merge results
        """
        tracks = self.db.query(Track).filter(Track.isrc == isrc).all()

        if len(tracks) <= 1:
            return {
                'status': 'no_action',
                'message': f'No duplicates found for ISRC {isrc}',
                'merged_count': 0
            }

        # 1. Determine canonical track
        analyzed_tracks = [t for t in tracks if t.processing_status == 'DONE']
        if analyzed_tracks:
            canonical = min(analyzed_tracks, key=lambda t: t.created_at)
        else:
            canonical = min(tracks, key=lambda t: t.created_at)

        duplicates = [t for t in tracks if t.id != canonical.id]

        # Capture data we'll need for the response before deleting
        duplicate_count = len(duplicates)
        duplicate_ids_for_response = [str(t.id) for t in duplicates]
        canonical_id_str = str(canonical.id)
        canonical_title = canonical.title

        if dry_run:
            album_count = sum(len(t.album_links) for t in duplicates)
            return {
                'status': 'dry_run',
                'message': f'Would merge {len(duplicates)} duplicate tracks into canonical track',
                'canonical_track_id': canonical_id_str,
                'canonical_track_title': canonical_title,
                'duplicate_track_ids': duplicate_ids_for_response,
                'album_links_to_migrate': album_count,
                'playback_links_to_migrate': sum(len(t.playback_links) for t in duplicates)
            }

        # 2. Migrate album links
        migrated_albums = 0
        for duplicate in duplicates:
            for album_link in duplicate.album_links:
                # Check if canonical already has this album link
                existing = self.db.query(TrackAlbum).filter(
                    TrackAlbum.track_id == canonical.id,
                    TrackAlbum.album_id == album_link.album_id
                ).first()

                if not existing:
                    # Create new link for canonical track
                    self.db.add(TrackAlbum(
                        track_id=canonical.id,
                        album_id=album_link.album_id
                    ))
                    migrated_albums += 1

        # 3. Migrate playback links (deduplicate by platform + deep_link)
        migrated_playback = 0
        for duplicate in duplicates:
            for playback in duplicate.playback_links:
                existing = self.db.query(PlaybackLink).filter(
                    PlaybackLink.track_id == canonical.id,
                    PlaybackLink.platform == playback.platform,
                    PlaybackLink.deep_link == playback.deep_link
                ).first()

                if not existing:
                    # Create a new playback link for canonical track instead of updating
                    self.db.add(PlaybackLink(
                        track_id=canonical.id,
                        platform=playback.platform,
                        deep_link=playback.deep_link,
                        is_working=playback.is_working
                    ))
                    migrated_playback += 1

        # 4. Migrate user interactions (votes, playbacks, etc.)
        # For votes and interactions, we keep the duplicate ones since they're user-specific
        for duplicate in duplicates:
            # Update foreign keys to point to canonical track
            self.db.query(TrackStyleVote).filter(
                TrackStyleVote.track_id == duplicate.id
            ).update({'track_id': canonical.id}, synchronize_session=False)

            self.db.query(TrackFeelVote).filter(
                TrackFeelVote.track_id == duplicate.id
            ).update({'track_id': canonical.id}, synchronize_session=False)

            self.db.query(TrackPlayback).filter(
                TrackPlayback.track_id == duplicate.id
            ).update({'track_id': canonical.id}, synchronize_session=False)

            self.db.query(UserInteraction).filter(
                UserInteraction.track_id == duplicate.id
            ).update({'track_id': canonical.id}, synchronize_session=False)

        # 5. Delete duplicate tracks (cascade will handle remaining relationships)
        duplicate_ids = [t.id for t in duplicates]

        # Delete remaining child records
        self.db.query(TrackArtist).filter(
            TrackArtist.track_id.in_(duplicate_ids)
        ).delete(synchronize_session=False)

        self.db.query(TrackAlbum).filter(
            TrackAlbum.track_id.in_(duplicate_ids)
        ).delete(synchronize_session=False)

        self.db.query(PlaybackLink).filter(
            PlaybackLink.track_id.in_(duplicate_ids)
        ).delete(synchronize_session=False)

        self.db.query(TrackDanceStyle).filter(
            TrackDanceStyle.track_id.in_(duplicate_ids)
        ).delete(synchronize_session=False)

        self.db.query(AnalysisSource).filter(
            AnalysisSource.track_id.in_(duplicate_ids)
        ).delete(synchronize_session=False)

        self.db.query(TrackStructureVersion).filter(
            TrackStructureVersion.track_id.in_(duplicate_ids)
        ).delete(synchronize_session=False)

        self.db.flush()

        # Delete the duplicate tracks themselves
        self.db.query(Track).filter(
            Track.id.in_(duplicate_ids)
        ).delete(synchronize_session=False)

        self.db.flush()

        # Commit the transaction
        self.db.commit()

        return {
            'status': 'success',
            'message': f'Merged {duplicate_count} duplicate tracks into canonical track',
            'canonical_track_id': canonical_id_str,
            'canonical_track_title': canonical_title,
            'merged_track_ids': duplicate_ids_for_response,
            'migrated_albums': migrated_albums,
            'migrated_playback_links': migrated_playback,
            'deleted_tracks': duplicate_count
        }

    def merge_all_duplicates(self, dry_run: bool = False, limit: int = None) -> Dict:
        """
        Merge all duplicate tracks in the database.

        Args:
            dry_run: If True, preview without making changes
            limit: Maximum number of ISRC groups to process

        Returns:
            Dict with overall merge statistics
        """
        duplicates = self.find_mergeable_duplicates(limit=limit or 10000)

        if not duplicates:
            return {
                'status': 'no_duplicates',
                'message': 'No duplicate tracks found',
                'processed': 0
            }

        if dry_run:
            total_tracks = sum(d['track_count'] for d in duplicates)
            return {
                'status': 'dry_run',
                'message': f'Would process {len(duplicates)} ISRC groups',
                'isrc_groups': len(duplicates),
                'total_duplicate_tracks': total_tracks,
                'sample_isrcs': [d['isrc'] for d in duplicates[:10]]
            }

        # Process each ISRC group
        results = []
        total_merged = 0
        total_albums_migrated = 0

        for dup in duplicates:
            try:
                # Each merge_duplicates_by_isrc commits individually
                result = self.merge_duplicates_by_isrc(dup['isrc'], dry_run=False)
                results.append(result)

                if result['status'] == 'success':
                    total_merged += result['deleted_tracks']
                    total_albums_migrated += result['migrated_albums']

            except Exception as e:
                results.append({
                    'status': 'error',
                    'isrc': dup['isrc'],
                    'error': str(e)
                })
                # Individual merge already rolled back if needed

        return {
            'status': 'completed',
            'message': f'Processed {len(duplicates)} ISRC groups',
            'isrc_groups_processed': len(duplicates),
            'total_tracks_merged': total_merged,
            'total_albums_migrated': total_albums_migrated,
            'results': results
        }
