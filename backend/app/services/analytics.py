"""
Analytics service for tracking user interactions and playback events.
Provides methods to record and query usage statistics.
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, case
from app.core.models import TrackPlayback, UserInteraction, Track, VisitorSession

class AnalyticsService:
    """Service for recording and analyzing user interactions."""

    @staticmethod
    def record_playback(
        db: Session,
        track_id: str,
        platform: str,
        session_id: Optional[str] = None,
        duration_seconds: Optional[int] = None,
        completed: bool = False
    ) -> TrackPlayback:
        """
        Record a track playback event.

        Args:
            db: Database session
            track_id: UUID of the track being played
            platform: 'youtube' or 'spotify'
            session_id: Optional session identifier for grouping user behavior
            duration_seconds: How many seconds were actually listened
            completed: Whether the track was played past the threshold (e.g., 30 seconds)

        Returns:
            The created TrackPlayback record
        """
        playback = TrackPlayback(
            track_id=track_id,
            platform=platform,
            session_id=session_id,
            duration_seconds=duration_seconds,
            completed=completed
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

    # ========== VISITOR SESSION TRACKING ==========

    @staticmethod
    def track_visitor_session(
        db: Session,
        session_id: str,
        user_agent: Optional[str] = None,
        is_returning: bool = False
    ) -> VisitorSession:
        """
        Track or update a visitor session.

        Args:
            db: Database session
            session_id: Unique session identifier
            user_agent: Browser user agent string
            is_returning: Whether this is a returning visitor

        Returns:
            The VisitorSession record
        """
        session = db.query(VisitorSession).filter(
            VisitorSession.session_id == session_id
        ).first()

        if session:
            # Update existing session
            session.last_seen = datetime.utcnow()
            session.page_views += 1
        else:
            # Create new session
            session = VisitorSession(
                session_id=session_id,
                user_agent=user_agent,
                is_returning=is_returning
            )
            db.add(session)

        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def get_visitor_stats(db: Session, days: int = 30) -> Dict[str, Any]:
        """
        Get visitor statistics for the last N days.

        Args:
            db: Database session
            days: Number of days to look back

        Returns:
            Dict with total visitors, unique visitors, returning visitors
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        total_visits = db.query(func.count(VisitorSession.id))\
            .filter(VisitorSession.first_seen >= cutoff_date)\
            .scalar() or 0

        unique_visitors = db.query(func.count(func.distinct(VisitorSession.session_id)))\
            .filter(VisitorSession.first_seen >= cutoff_date)\
            .scalar() or 0

        returning_visitors = db.query(func.count(VisitorSession.id))\
            .filter(
                and_(
                    VisitorSession.first_seen >= cutoff_date,
                    VisitorSession.is_returning == True
                )
            ).scalar() or 0

        return {
            "total_visits": total_visits,
            "unique_visitors": unique_visitors,
            "returning_visitors": returning_visitors,
            "new_visitors": unique_visitors - returning_visitors
        }

    @staticmethod
    def get_hourly_visit_pattern(db: Session, days: int = 30) -> List[Dict[str, Any]]:
        """
        Get visit patterns by hour of day.

        Args:
            db: Database session
            days: Number of days to analyze

        Returns:
            List of dicts with hour and visit count
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        results = db.query(
            func.extract('hour', VisitorSession.first_seen).label('hour'),
            func.count(VisitorSession.id).label('count')
        ).filter(
            VisitorSession.first_seen >= cutoff_date
        ).group_by('hour').order_by('hour').all()

        return [{"hour": int(hour), "visits": count} for hour, count in results]

    @staticmethod
    def get_daily_visit_pattern(db: Session, days: int = 30) -> List[Dict[str, Any]]:
        """
        Get visit patterns by date.

        Args:
            db: Database session
            days: Number of days to analyze

        Returns:
            List of dicts with date and visit count
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        results = db.query(
            func.date(VisitorSession.first_seen).label('date'),
            func.count(VisitorSession.id).label('count')
        ).filter(
            VisitorSession.first_seen >= cutoff_date
        ).group_by('date').order_by('date').all()

        return [{"date": str(date), "visits": count} for date, count in results]

    # ========== TRACK PLAYBACK ANALYTICS ==========

    @staticmethod
    def get_most_played_tracks_with_completion(
        db: Session,
        limit: int = 10,
        days: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Get most played tracks with completion rates.

        Args:
            db: Database session
            limit: Number of tracks to return
            days: Optional number of days to look back

        Returns:
            List of dicts with track info, play count, and completion rate
        """
        query = db.query(
            Track,
            func.count(TrackPlayback.id).label('total_plays'),
            func.sum(case((TrackPlayback.completed == True, 1), else_=0)).label('completed_plays')
        ).join(
            TrackPlayback, Track.id == TrackPlayback.track_id
        )

        if days:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            query = query.filter(TrackPlayback.played_at >= cutoff_date)

        results = query.group_by(Track.id).order_by(
            func.count(TrackPlayback.id).desc()
        ).limit(limit).all()

        return [
            {
                "track_id": str(track.id),
                "track_title": track.title,
                "artist": track.primary_artist.name if track.primary_artist else None,
                "total_plays": total_plays,
                "completed_plays": completed_plays,
                "completion_rate": round((completed_plays / total_plays * 100) if total_plays > 0 else 0, 2)
            }
            for track, total_plays, completed_plays in results
        ]

    @staticmethod
    def get_total_listen_time(db: Session, days: Optional[int] = None) -> Dict[str, Any]:
        """
        Get total listen time in seconds and formatted time.

        Args:
            db: Database session
            days: Optional number of days to look back

        Returns:
            Dict with total seconds and formatted time
        """
        query = db.query(func.sum(TrackPlayback.duration_seconds))

        if days:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            query = query.filter(TrackPlayback.played_at >= cutoff_date)

        total_seconds = query.scalar() or 0

        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60

        return {
            "total_seconds": total_seconds,
            "total_minutes": round(total_seconds / 60, 2),
            "total_hours": round(total_seconds / 3600, 2),
            "formatted": f"{hours}h {minutes}m {seconds}s"
        }

    @staticmethod
    def get_platform_usage_stats(db: Session, days: Optional[int] = None) -> Dict[str, Any]:
        """
        Get detailed platform usage statistics.

        Args:
            db: Database session
            days: Optional number of days to look back

        Returns:
            Dict with platform stats including listen time
        """
        query = db.query(
            TrackPlayback.platform,
            func.count(TrackPlayback.id).label('count'),
            func.sum(TrackPlayback.duration_seconds).label('total_duration')
        )

        if days:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            query = query.filter(TrackPlayback.played_at >= cutoff_date)

        results = query.group_by(TrackPlayback.platform).all()

        total_plays = sum(count for _, count, _ in results)

        return {
            platform: {
                'plays': count,
                'percentage': round((count / total_plays * 100) if total_plays > 0 else 0, 2),
                'total_duration_seconds': total_duration or 0,
                'total_duration_minutes': round((total_duration or 0) / 60, 2)
            }
            for platform, count, total_duration in results
        }

    # ========== ABANDONMENT ANALYTICS ==========

    @staticmethod
    def get_nudge_abandonment_rate(db: Session, days: Optional[int] = None) -> Dict[str, Any]:
        """
        Calculate nudge abandonment rate (shown but not completed).

        Args:
            db: Database session
            days: Optional number of days to look back

        Returns:
            Dict with shown, completed, and abandonment rate
        """
        query_shown = db.query(func.count(UserInteraction.id)).filter(
            UserInteraction.event_type == 'nudge_shown'
        )
        query_completed = db.query(func.count(UserInteraction.id)).filter(
            or_(
                UserInteraction.event_type == 'nudge_completed',
                UserInteraction.event_type == 'nudge_feedback_submitted'
            )
        )

        if days:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            query_shown = query_shown.filter(UserInteraction.created_at >= cutoff_date)
            query_completed = query_completed.filter(UserInteraction.created_at >= cutoff_date)

        shown_count = query_shown.scalar() or 0
        completed_count = query_completed.scalar() or 0
        abandoned_count = shown_count - completed_count

        return {
            "nudges_shown": shown_count,
            "nudges_completed": completed_count,
            "nudges_abandoned": abandoned_count,
            "abandonment_rate": round((abandoned_count / shown_count * 100) if shown_count > 0 else 0, 2),
            "completion_rate": round((completed_count / shown_count * 100) if shown_count > 0 else 0, 2)
        }

    @staticmethod
    def get_modal_abandonment_rate(db: Session, days: Optional[int] = None) -> Dict[str, Any]:
        """
        Calculate modal abandonment rate (opened but not submitted).

        Args:
            db: Database session
            days: Optional number of days to look back

        Returns:
            Dict with opened, submitted, and abandonment rate
        """
        query_opened = db.query(func.count(UserInteraction.id)).filter(
            UserInteraction.event_type.like('modal_%_opened')
        )
        query_submitted = db.query(func.count(UserInteraction.id)).filter(
            UserInteraction.event_type.like('modal_%_submitted')
        )

        if days:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            query_opened = query_opened.filter(UserInteraction.created_at >= cutoff_date)
            query_submitted = query_submitted.filter(UserInteraction.created_at >= cutoff_date)

        opened_count = query_opened.scalar() or 0
        submitted_count = query_submitted.scalar() or 0
        abandoned_count = opened_count - submitted_count

        return {
            "modals_opened": opened_count,
            "modals_submitted": submitted_count,
            "modals_abandoned": abandoned_count,
            "abandonment_rate": round((abandoned_count / opened_count * 100) if opened_count > 0 else 0, 2),
            "completion_rate": round((submitted_count / opened_count * 100) if opened_count > 0 else 0, 2)
        }

    # ========== REPORT ANALYTICS ==========

    @staticmethod
    def get_report_stats(db: Session, days: Optional[int] = None) -> Dict[str, Any]:
        """
        Get statistics on all types of reports.

        Args:
            db: Database session
            days: Optional number of days to look back

        Returns:
            Dict with report counts by type
        """
        # Track flags (non-folk music)
        query_track_flags = db.query(func.count(Track.id)).filter(Track.is_flagged == True)

        # Link reports
        query_link_reports = db.query(func.count(UserInteraction.id)).filter(
            or_(
                UserInteraction.event_type == 'link_reported_broken',
                UserInteraction.event_type == 'link_reported_wrong_track'
            )
        )

        # Structure version reports
        query_structure_reports = db.query(func.count(UserInteraction.id)).filter(
            UserInteraction.event_type == 'structure_reported'
        )

        if days:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            query_track_flags = query_track_flags.filter(Track.flagged_at >= cutoff_date)
            query_link_reports = query_link_reports.filter(UserInteraction.created_at >= cutoff_date)
            query_structure_reports = query_structure_reports.filter(UserInteraction.created_at >= cutoff_date)

        # Get breakdown by report reason
        link_report_breakdown = db.query(
            UserInteraction.event_type,
            func.count(UserInteraction.id).label('count')
        ).filter(
            or_(
                UserInteraction.event_type == 'link_reported_broken',
                UserInteraction.event_type == 'link_reported_wrong_track'
            )
        )

        if days:
            link_report_breakdown = link_report_breakdown.filter(
                UserInteraction.created_at >= cutoff_date
            )

        link_breakdown = link_report_breakdown.group_by(UserInteraction.event_type).all()

        return {
            "total_reports": (
                query_track_flags.scalar() or 0) +
                (query_link_reports.scalar() or 0) +
                (query_structure_reports.scalar() or 0
            ),
            "track_flags_non_folk": query_track_flags.scalar() or 0,
            "broken_link_reports": sum(count for event_type, count in link_breakdown if 'broken' in event_type),
            "wrong_track_reports": sum(count for event_type, count in link_breakdown if 'wrong' in event_type),
            "structure_spam_reports": query_structure_reports.scalar() or 0
        }

    # ========== DISCOVERY PAGE ANALYTICS ==========

    @staticmethod
    def get_discovery_stats(db: Session, days: Optional[int] = None) -> Dict[str, Any]:
        """
        Get analytics for the discovery page feature.

        Args:
            db: Database session
            days: Optional number of days to look back

        Returns:
            Dict with discovery page engagement metrics
        """
        query = db.query(UserInteraction)

        if days:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            query = query.filter(UserInteraction.created_at >= cutoff_date)

        # Count page views
        page_views = query.filter(
            UserInteraction.event_type == 'discovery_page_view'
        ).count()

        # Count style clicks
        style_clicks = query.filter(
            UserInteraction.event_type == 'discovery_style_click'
        ).count()

        # Count navigations to search
        to_search = query.filter(
            UserInteraction.event_type == 'discovery_to_search'
        ).count()

        # Count track plays from discovery
        track_plays = query.filter(
            UserInteraction.event_type == 'discovery_track_play'
        ).count()

        # Get most clicked styles
        style_click_data = db.query(
            UserInteraction.event_data['style'].astext.label('style'),
            func.count(UserInteraction.id).label('clicks')
        ).filter(
            UserInteraction.event_type == 'discovery_style_click'
        )

        if days:
            style_click_data = style_click_data.filter(
                UserInteraction.created_at >= cutoff_date
            )

        most_clicked_styles = style_click_data.group_by(
            UserInteraction.event_data['style'].astext
        ).order_by(
            func.count(UserInteraction.id).desc()
        ).limit(5).all()

        # Get section play breakdown
        section_plays = db.query(
            UserInteraction.event_data['section'].astext.label('section'),
            func.count(UserInteraction.id).label('plays')
        ).filter(
            UserInteraction.event_type == 'discovery_track_play'
        )

        if days:
            section_plays = section_plays.filter(
                UserInteraction.created_at >= cutoff_date
            )

        section_breakdown = section_plays.group_by(
            UserInteraction.event_data['section'].astext
        ).all()

        # Calculate conversion rate (page views to search)
        conversion_rate = round((to_search / page_views * 100) if page_views > 0 else 0, 2)

        # Calculate engagement rate (page views to any interaction)
        total_interactions = style_clicks + to_search + track_plays
        engagement_rate = round((total_interactions / page_views * 100) if page_views > 0 else 0, 2)

        return {
            "page_views": page_views,
            "style_clicks": style_clicks,
            "navigations_to_search": to_search,
            "track_plays": track_plays,
            "conversion_rate": conversion_rate,
            "engagement_rate": engagement_rate,
            "most_clicked_styles": [
                {"style": style, "clicks": clicks}
                for style, clicks in most_clicked_styles
            ],
            "section_breakdown": [
                {"section": section or "unknown", "plays": plays}
                for section, plays in section_breakdown
            ]
        }
