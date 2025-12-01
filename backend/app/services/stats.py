from sqlalchemy.orm import Session
from sqlalchemy import func, distinct, desc
from app.core.models import Track, TrackDanceStyle, AnalysisSource

class StatsService:
    def __init__(self, db: Session):
        self.db = db

    def get_global_stats(self):
        # 1. Total Tracks
        total_tracks = self.db.query(func.count(Track.id)).scalar()

        # 2. Analyzed Tracks (Have raw data)
        analyzed_count = self.db.query(func.count(distinct(AnalysisSource.track_id))).scalar()

        # 3. Classified Tracks (Have a style)
        classified_count = self.db.query(func.count(distinct(TrackDanceStyle.track_id))).scalar()

        # 4. Processing Queue (Total - Analyzed)
        pending_analysis = total_tracks - analyzed_count
        
        # 5. Classification Queue (Analyzed - Classified)
        # Note: This is an approximation, some tracks might be unclassifiable
        pending_classification = analyzed_count - classified_count

        last_track = self.db.query(Track.created_at).order_by(desc(Track.created_at)).first()
        last_added_date = last_track[0] if last_track else None

        return {
            "total_tracks": total_tracks,
            "analyzed": analyzed_count,
            "classified": classified_count,
            "pending_analysis": max(0, pending_analysis),
            "pending_classification": max(0, pending_classification),
            "coverage_percent": int((classified_count / total_tracks * 100)) if total_tracks > 0 else 0,
            "last_added": last_added_date
        }