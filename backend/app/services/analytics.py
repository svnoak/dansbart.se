"""
Analytics service for tracking user interactions and playback events.
Provides methods to record and query usage statistics.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.models import TrackPlayback, UserInteraction, Track

class AnalyticsService:
    """Service for recording and analyzing user interactions."""

    @staticmethod
    def record_playback(
        db: Session,
        track_id: str,
        platform: str,
        session_id: Optional[str] = None
    ) -> TrackPlayback:
        """
        Record a track playback event.

        Args:
            db: Database session
            track_id: UUID of the track being played
            platform: 'youtube' or 'spotify'
            session_id: Optional session identifier for grouping user behavior

        Returns:
            The created TrackPlayback record
        """
        playback = TrackPlayback(
            track_id=track_id,
            platform=platform,
            session_id=session_id
        )
        db.add(playback)
        db.commit()
        db.refresh(playback)
        return playback

    @staticmethod
    def record_interaction(
        db: Session,
        event_type: str,
        track_id: Optional[str] = None,
        event_data: Optional[dict] = None,
        session_id: Optional[str] = None
    ) -> UserInteraction:
        """
        Record a user interaction event.

        Args:
            db: Database session
            event_type: Type of event (e.g., 'nudge_shown', 'modal_opened')
            track_id: Optional UUID of related track
            event_data: Optional additional context as JSON
            session_id: Optional session identifier

        Returns:
            The created UserInteraction record
        """
        interaction = UserInteraction(
            event_type=event_type,
            track_id=track_id,
            event_data=event_data,
            session_id=session_id
        )
        db.add(interaction)
        db.commit()
        db.refresh(interaction)
        return interaction

    @staticmethod
    def get_track_play_count(db: Session, track_id: str) -> int:
        """Get total play count for a track."""
        return db.query(func.count(TrackPlayback.id))\
            .filter(TrackPlayback.track_id == track_id)\
            .scalar() or 0

    @staticmethod
    def get_platform_preference(db: Session, track_id: str) -> dict:
        """
        Get platform preference breakdown for a track.

        Returns:
            Dict with 'youtube' and 'spotify' play counts
        """
        results = db.query(
            TrackPlayback.platform,
            func.count(TrackPlayback.id).label('count')
        ).filter(
            TrackPlayback.track_id == track_id
        ).group_by(TrackPlayback.platform).all()

        return {platform: count for platform, count in results}

    @staticmethod
    def get_most_played_tracks(db: Session, limit: int = 10):
        """
        Get the most played tracks.

        Returns:
            List of (track, play_count) tuples
        """
        results = db.query(
            Track,
            func.count(TrackPlayback.id).label('play_count')
        ).join(
            TrackPlayback, Track.id == TrackPlayback.track_id
        ).group_by(
            Track.id
        ).order_by(
            func.count(TrackPlayback.id).desc()
        ).limit(limit).all()

        return results

    @staticmethod
    def get_global_platform_preference(db: Session) -> dict:
        """
        Get global platform preference across all tracks.

        Returns:
            Dict with 'youtube' and 'spotify' play counts and percentages
        """
        results = db.query(
            TrackPlayback.platform,
            func.count(TrackPlayback.id).label('count')
        ).group_by(TrackPlayback.platform).all()

        total = sum(count for _, count in results)

        return {
            platform: {
                'count': count,
                'percentage': round((count / total * 100) if total > 0 else 0, 2)
            }
            for platform, count in results
        }

    @staticmethod
    def get_interaction_funnel(db: Session, event_types: list[str]) -> dict:
        """
        Get funnel conversion for a sequence of events.

        Args:
            event_types: List of event types in funnel order

        Returns:
            Dict with event counts and conversion rates
        """
        results = {}
        for event_type in event_types:
            count = db.query(func.count(UserInteraction.id))\
                .filter(UserInteraction.event_type == event_type)\
                .scalar() or 0
            results[event_type] = count

        return results
