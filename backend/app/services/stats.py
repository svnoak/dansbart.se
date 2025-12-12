from sqlalchemy.orm import Session
from sqlalchemy import func, distinct, desc
from app.core.models import Track, TrackDanceStyle, AnalysisSource

class StatsService:
    def __init__(self, db: Session):
        self.db = db

    def get_global_stats(self):
        # 1. Total Tracks (only DONE and FAILED - actual available tracks)
        total_tracks = self.db.query(func.count(Track.id)).filter(
            Track.processing_status.in_(['DONE', 'FAILED'])
        ).scalar()

        # 2. Analyzed Tracks (Have raw data)
        analyzed_count = self.db.query(func.count(distinct(AnalysisSource.track_id))).scalar()

        # 3. Classified Tracks (Have a style) - only from DONE/FAILED tracks
        classified_count = self.db.query(func.count(distinct(TrackDanceStyle.track_id)))\
            .join(Track, TrackDanceStyle.track_id == Track.id)\
            .filter(Track.processing_status.in_(['DONE', 'FAILED']))\
            .scalar()

        # 4. Processing Queue (Total - Analyzed)
        pending_analysis = total_tracks - analyzed_count

        # 5. Classification Queue (Analyzed - Classified)
        # Note: This is an approximation, some tracks might be unclassifiable
        pending_classification = analyzed_count - classified_count

        # Get the most recent analysis completion time for DONE/FAILED tracks
        last_analyzed = self.db.query(AnalysisSource.analyzed_at)\
            .join(Track, AnalysisSource.track_id == Track.id)\
            .filter(Track.processing_status.in_(['DONE', 'FAILED']))\
            .order_by(desc(AnalysisSource.analyzed_at)).first()
        last_added_date = last_analyzed[0] if last_analyzed else None

        return {
            "total_tracks": total_tracks,
            "analyzed": analyzed_count,
            "classified": classified_count,
            "pending_analysis": max(0, pending_analysis),
            "pending_classification": max(0, pending_classification),
            "coverage_percent": int((classified_count / total_tracks * 100)) if total_tracks > 0 else 0,
            "last_added": last_added_date
        }