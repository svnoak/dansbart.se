"""
Analysis Repository - Optimized queries for analysis data management

Provides:
- Analysis source CRUD operations
- Genre profile management
- Latest analysis retrieval
"""
import uuid
from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.core.models import AnalysisSource, GenreProfile
from .base import BaseRepository


class AnalysisRepository(BaseRepository[AnalysisSource]):
    """Repository for AnalysisSource entity with optimized queries."""

    def __init__(self, db: Session):
        super().__init__(db, AnalysisSource)

    # ==================== ANALYSIS SOURCE OPERATIONS ====================

    def add_analysis(
        self,
        track_id: uuid.UUID,
        source_type: str,
        raw_data: dict,
        confidence_score: float = 1.0
    ) -> AnalysisSource:
        """
        Add a new analysis source for a track.

        Args:
            track_id: Track UUID
            source_type: Type of analysis (e.g., 'spotify', 'essentia')
            raw_data: Raw analysis data as dict
            confidence_score: Confidence score (0.0 - 1.0)

        Returns:
            Created AnalysisSource instance
        """
        analysis = self.create(
            track_id=track_id,
            source_type=source_type,
            raw_data=raw_data,
            confidence_score=confidence_score
        )
        return analysis

    def get_latest_by_track(
        self,
        track_id: uuid.UUID,
        source_type: str = None
    ) -> Optional[AnalysisSource]:
        """
        Get the most recent analysis for a track.
        Optionally filter by source type.

        Args:
            track_id: Track UUID
            source_type: Optional source type filter

        Returns:
            Latest AnalysisSource or None
        """
        query = self.db.query(AnalysisSource).filter(
            AnalysisSource.track_id == track_id
        )

        if source_type:
            query = query.filter(AnalysisSource.source_type == source_type)

        return query.order_by(desc(AnalysisSource.analyzed_at)).first()

    def get_all_by_track(
        self,
        track_id: uuid.UUID,
        source_type: str = None
    ) -> List[AnalysisSource]:
        """
        Get all analyses for a track.
        Optionally filter by source type.

        Args:
            track_id: Track UUID
            source_type: Optional source type filter

        Returns:
            List of AnalysisSource entries
        """
        filters = {'track_id': track_id}
        if source_type:
            filters['source_type'] = source_type

        return self.find_all(
            filters=filters,
            order_by=desc(AnalysisSource.analyzed_at)
        )

    def delete_by_track(self, track_id: uuid.UUID) -> int:
        """
        Delete all analysis sources for a track.

        Args:
            track_id: Track UUID

        Returns:
            Count of deleted entries
        """
        count = self.db.query(AnalysisSource).filter(
            AnalysisSource.track_id == track_id
        ).delete(synchronize_session=False)

        self.db.flush()
        return count

    # ==================== GENRE PROFILE OPERATIONS ====================

    def save_genre_profile(
        self,
        genre_name: str,
        avg_note_density: float,
        common_meters: dict,
        rhythm_patterns: dict,
        sample_size: int
    ) -> GenreProfile:
        """
        Create or update a genre profile.

        Args:
            genre_name: Name of the genre
            avg_note_density: Average note density
            common_meters: Dict of common time signatures
            rhythm_patterns: Dict of rhythm pattern data
            sample_size: Number of tracks in sample

        Returns:
            Created or updated GenreProfile
        """
        # Check if profile exists
        existing = self.db.query(GenreProfile).filter(
            GenreProfile.genre_name == genre_name
        ).first()

        if existing:
            # Update existing profile
            existing.avg_note_density = avg_note_density
            existing.common_meters = common_meters
            existing.rhythm_patterns = rhythm_patterns
            existing.sample_size = sample_size
            self.db.flush()
            return existing

        # Create new profile
        profile = GenreProfile(
            genre_name=genre_name,
            avg_note_density=avg_note_density,
            common_meters=common_meters,
            rhythm_patterns=rhythm_patterns,
            sample_size=sample_size
        )
        self.db.add(profile)
        self.db.flush()
        return profile

    def get_genre_profile(self, genre_name: str) -> Optional[GenreProfile]:
        """
        Get a genre profile by name.

        Args:
            genre_name: Name of the genre

        Returns:
            GenreProfile or None
        """
        return self.db.query(GenreProfile).filter(
            GenreProfile.genre_name == genre_name
        ).first()

    def get_all_genre_profiles(self) -> List[GenreProfile]:
        """
        Get all genre profiles.

        Returns:
            List of GenreProfile entries
        """
        return self.db.query(GenreProfile).order_by(
            GenreProfile.genre_name
        ).all()

    def delete_genre_profile(self, genre_name: str) -> bool:
        """
        Delete a genre profile by name.

        Args:
            genre_name: Name of the genre

        Returns:
            True if deleted, False if not found
        """
        profile = self.get_genre_profile(genre_name)
        if profile:
            self.db.delete(profile)
            self.db.flush()
            return True
        return False

    # ==================== BATCH OPERATIONS ====================

    def get_tracks_with_analysis(
        self,
        source_type: str = None,
        limit: int = 100
    ) -> List[uuid.UUID]:
        """
        Get track IDs that have analysis data.
        Optionally filter by source type.

        Args:
            source_type: Optional source type filter
            limit: Max number of track IDs to return

        Returns:
            List of track UUIDs
        """
        query = self.db.query(AnalysisSource.track_id).distinct()

        if source_type:
            query = query.filter(AnalysisSource.source_type == source_type)

        results = query.limit(limit).all()
        return [track_id for (track_id,) in results]

    def count_by_source_type(self) -> Dict[str, int]:
        """
        Get count of analyses grouped by source type.

        Returns:
            Dict mapping source_type to count
        """
        results = self.db.query(
            AnalysisSource.source_type,
            self.db.func.count(AnalysisSource.id)
        ).group_by(AnalysisSource.source_type).all()

        return {source_type: count for source_type, count in results}
