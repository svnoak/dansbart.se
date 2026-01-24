"""
Admin-only analytics endpoints.
Requires Authentik authentication with admin group membership.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.user_models import User
from app.api.auth.dependencies import get_admin_user
from app.services.analytics import AnalyticsService

router = APIRouter()

# ========== ANALYTICS ENDPOINTS (ADMIN-ONLY) ==========

@router.get("/dashboard")
def get_analytics_dashboard(
    days: int = Query(30, description="Number of days to analyze"),
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive analytics dashboard data (admin-only).
    """
    return {
        "visitors": AnalyticsService.get_visitor_stats(db, days=days),
        "most_played_tracks": AnalyticsService.get_most_played_tracks_with_completion(db, limit=10, days=days),
        "listen_time": AnalyticsService.get_total_listen_time(db, days=days),
        "platform_stats": AnalyticsService.get_platform_usage_stats(db, days=days),
        "nudge_abandonment": AnalyticsService.get_nudge_abandonment_rate(db, days=days),
        "modal_abandonment": AnalyticsService.get_modal_abandonment_rate(db, days=days),
        "reports": AnalyticsService.get_report_stats(db, days=days),
        "discovery": AnalyticsService.get_discovery_stats(db, days=days)
    }

@router.get("/visitors")
def get_visitor_analytics(
    days: int = Query(30, description="Number of days to look back"),
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get visitor statistics (admin-only).
    """
    return AnalyticsService.get_visitor_stats(db, days=days)

@router.get("/visits/hourly")
def get_hourly_visits(
    days: int = Query(30, description="Number of days to analyze"),
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get visit patterns by hour of day (admin-only).
    """
    return AnalyticsService.get_hourly_visit_pattern(db, days=days)

@router.get("/visits/daily")
def get_daily_visits(
    days: int = Query(30, description="Number of days to analyze"),
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get visit patterns by date (admin-only).
    """
    return AnalyticsService.get_daily_visit_pattern(db, days=days)

@router.get("/tracks/most-played")
def get_most_played_tracks(
    limit: int = Query(10, description="Number of tracks to return"),
    days: int = Query(None, description="Optional number of days to look back"),
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get most played tracks with completion rates (admin-only).
    """
    return AnalyticsService.get_most_played_tracks_with_completion(db, limit=limit, days=days)

@router.get("/listen-time")
def get_total_listen_time(
    days: int = Query(None, description="Optional number of days to look back"),
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get total listen time across all tracks (admin-only).
    """
    return AnalyticsService.get_total_listen_time(db, days=days)

@router.get("/platform-stats")
def get_platform_stats(
    days: int = Query(None, description="Optional number of days to look back"),
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed platform usage statistics (admin-only).
    """
    return AnalyticsService.get_platform_usage_stats(db, days=days)

@router.get("/abandonment/nudges")
def get_nudge_abandonment(
    days: int = Query(None, description="Optional number of days to look back"),
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get nudge abandonment analytics (admin-only).
    """
    return AnalyticsService.get_nudge_abandonment_rate(db, days=days)

@router.get("/abandonment/modals")
def get_modal_abandonment(
    days: int = Query(None, description="Optional number of days to look back"),
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get modal abandonment analytics (admin-only).
    """
    return AnalyticsService.get_modal_abandonment_rate(db, days=days)

@router.get("/reports")
def get_report_analytics(
    days: int = Query(None, description="Optional number of days to look back"),
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get statistics on all types of reports (admin-only).
    """
    return AnalyticsService.get_report_stats(db, days=days)

@router.get("/discovery")
def get_discovery_analytics(
    days: int = Query(30, description="Number of days to look back"),
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get analytics for the discovery page feature (admin-only).
    Includes page views, style clicks, conversions, and engagement metrics.
    """
    return AnalyticsService.get_discovery_stats(db, days=days)
