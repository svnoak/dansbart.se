from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.models import AnalysisSource, GenreProfile
import uuid

class AnalysisRepository:
    def __init__(self, db: Session):
        self.db = db

    # --- TRACK ANALYSIS METHODS ---

    def add_analysis(self, track_id: uuid.UUID, source_type: str, data: dict):
        """Saves a new analysis result (e.g., Librosa BPM or Playlist Context)"""
        analysis = AnalysisSource(
            track_id=track_id,
            source_type=source_type,
            raw_data=data
        )
        self.db.add(analysis)
        self.db.commit()
        return analysis

    def get_latest_by_track(self, track_id: uuid.UUID, source_type: str):
        """Retrieves the most recent analysis of a specific type for a track"""
        return self.db.query(AnalysisSource).filter(
            AnalysisSource.track_id == track_id,
            AnalysisSource.source_type == source_type
        ).order_by(AnalysisSource.analyzed_at.desc()).first()

    # --- GROUND TRUTH METHODS (Folkwiki) ---

    def save_genre_profile(self, genre: str, density: float, meters: dict, patterns: dict, count: int):
        """Upsert (Update/Insert) logic for Genre Profiles"""
        profile = self.db.query(GenreProfile).filter(GenreProfile.genre_name == genre).first()
        
        if not profile:
            profile = GenreProfile(genre_name=genre)
            self.db.add(profile)
        
        # Update stats
        profile.avg_note_density = density
        profile.common_meters = meters
        profile.rhythm_patterns = patterns
        profile.sample_size = count
        profile.updated_at = func.now()
        
        self.db.commit()
        return profile
        
    def get_genre_profile(self, genre: str):
        """Retrieves the statistical profile for a genre"""
        return self.db.query(GenreProfile).filter(GenreProfile.genre_name == genre).first()