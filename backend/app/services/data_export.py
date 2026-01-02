"""
Data Export Service

Exports Dansbart's proprietary analysis data and human feedback for public use.
This includes neckenml-analyzer outputs and user-contributed ground truth data.
"""

from sqlalchemy.orm import Session, selectinload, joinedload
from sqlalchemy import func
from app.core.models import (
    Track, TrackDanceStyle, TrackStyleVote, TrackFeelVote,
    TrackStructureVersion, DanceMovementFeedback, AnalysisSource,
    Artist, TrackArtist
)
from typing import List, Dict, Any, Generator
from datetime import datetime
import json


class DataExportService:
    """
    Service for exporting Dansbart's analysis data for public consumption.

    Exports include:
    - Audio analysis features (from neckenml-analyzer)
    - Dance style classifications with confidence scores
    - Human feedback and corrections
    - Track structure annotations
    - Genre classifications

    Excludes proprietary platform data:
    - Spotify/YouTube IDs and URLs
    - Album artwork URLs
    - Raw API responses from third parties
    """

    def __init__(self, db: Session):
        self.db = db

    def export_all_tracks(self, limit: int = None, offset: int = 0) -> Generator[str, None, None]:
        """
        Streams track data as a JSON string, chunk by chunk.
        Uses manual batching (pagination) to prevent OOM and avoid yield_per conflicts.
        """
        total_count = self.db.query(Track).count()

        header = {
            "metadata": self._get_export_metadata(total_count, limit, offset),
            "license": self._get_license_info(),
            "schema_version": "1.0.0",
            "tracks": [] 
        }
        json_header = json.dumps(header)
        yield json_header[:-2]  # Remove the closing "]}"

        base_query = self.db.query(Track).order_by(Track.id).options(
            selectinload(Track.artist_links).joinedload(TrackArtist.artist),
            selectinload(Track.dance_styles),
            selectinload(Track.analysis_sources)
        )

        batch_size = 1000
        current_offset = offset
        tracks_yielded = 0
        first_track = True

        while True:
            fetch_limit = batch_size
            
            if limit is not None:
                remaining = limit - tracks_yielded
                if remaining <= 0:
                    break
                fetch_limit = min(batch_size, remaining)

            batch = base_query.limit(fetch_limit).offset(current_offset).all()

            if not batch:
                break

            for track in batch:
                if not first_track:
                    yield ","
                else:
                    first_track = False
                
                track_data = self._format_track_export(track)
                yield json.dumps(track_data)

            tracks_yielded += len(batch)
            current_offset += len(batch)
            
            self.db.expire_all() 

        yield "]}"

    def export_feedback_data(self) -> Dict[str, Any]:
        """
        Export aggregated human feedback and ground truth data.

        Returns:
            Dictionary with style votes, feel votes, and dance movement feedback
        """
        return {
            "metadata": {
                "export_date": datetime.utcnow().isoformat(),
                "description": "Human feedback and ground truth data from Dansbart users"
            },
            "license": self._get_license_info(),
            "schema_version": "1.0.0",
            "style_votes": self._export_style_votes(),
            "feel_votes": self._export_feel_votes(),
            "dance_movement_consensus": self._export_dance_movement_feedback(),
            "structure_annotations": self._export_structure_versions()
        }

    def _format_track_export(self, track: Track) -> Dict[str, Any]:
        """Format a single track for export."""

        # Get primary artist name (no IDs, just the name for reference)
        artist_names = [
            link.artist.name for link in track.artist_links
            if link.role == 'primary'
        ] or [track.artist_links[0].artist.name] if track.artist_links else []

        # Get dance styles
        dance_styles = []
        for ds in track.dance_styles:
            dance_styles.append({
                "dance_style": ds.dance_style,
                "sub_style": ds.sub_style,
                "is_primary": ds.is_primary,
                "confidence": ds.confidence,
                "tempo_category": ds.tempo_category,
                "bpm_multiplier": ds.bpm_multiplier,
                "effective_bpm": ds.effective_bpm,
                "confirmation_count": ds.confirmation_count,
                "is_user_confirmed": ds.is_user_confirmed
            })

        # Get analysis metadata
        analysis_sources = []
        for source in track.analysis_sources:
            # Include our analysis data but remove any proprietary raw data
            analysis_sources.append({
                "source_type": source.source_type,
                "confidence_score": source.confidence_score,
                "analyzed_at": source.analyzed_at.isoformat() if source.analyzed_at else None,
                # Note: raw_data excluded as it may contain proprietary platform data
            })

        return {
            # Reference metadata (public identifiers only)
            "isrc": track.isrc,
            "title": track.title,
            "artist_names": artist_names,
            "duration_ms": track.duration_ms,
            "created_at": track.created_at.isoformat() if track.created_at else None,

            # Audio analysis features (proprietary to Dansbart/neckenml-analyzer)
            "audio_features": {
                "has_vocals": track.has_vocals,
                "swing_ratio": track.swing_ratio,
                "articulation": track.articulation,
                "bounciness": track.bounciness,
                "loudness": track.loudness,
                "punchiness": track.punchiness,
                "voice_probability": track.voice_probability,
                "polska_score": track.polska_score,
                "hambo_score": track.hambo_score,
                "bpm_stability": track.bpm_stability,
            },

            # Analysis metadata
            "analysis_version": track.analysis_version,
            "embedding": [float(x) for x in track.embedding] if track.embedding is not None else None,

            # Classification results
            "music_genre": track.music_genre,
            "genre_confidence": track.genre_confidence,
            "dance_styles": dance_styles,

            # Track structure
            "structure": {
                "bars": track.bars,
                "sections": track.sections,
                "section_labels": track.section_labels,
            },

            # Quality flags
            "is_flagged": track.is_flagged,
            "flag_reason": track.flag_reason if track.is_flagged else None,

            # Analysis sources metadata
            "analysis_sources": analysis_sources,
        }

    def _export_style_votes(self) -> List[Dict[str, Any]]:
        """Export aggregated style correction votes."""
        votes = self.db.query(TrackStyleVote).options(
            joinedload(TrackStyleVote.track)
        ).all()

        return [{
            "track_isrc": vote.track.isrc if vote.track else None,
            "suggested_style": vote.suggested_style,
            "tempo_correction": vote.tempo_correction,
            "created_at": vote.created_at.isoformat() if vote.created_at else None,
            # voter_id excluded for privacy
        } for vote in votes]

    def _export_feel_votes(self) -> List[Dict[str, Any]]:
        """Export movement feel tags."""
        votes = self.db.query(TrackFeelVote).options(
            joinedload(TrackFeelVote.track)
        ).all()

        return [{
            "track_isrc": vote.track.isrc if vote.track else None,
            "feel_tag": vote.feel_tag,
            "created_at": vote.created_at.isoformat() if vote.created_at else None,
        } for vote in votes]

    def _export_dance_movement_feedback(self) -> List[Dict[str, Any]]:
        """Export consensus data on dance style characteristics."""
        feedback = self.db.query(DanceMovementFeedback).all()

        return [{
            "dance_style": f.dance_style,
            "movement_tag": f.movement_tag,
            "score": f.score,
            "occurrences": f.occurrences,
        } for f in feedback]

    def _export_structure_versions(self) -> List[Dict[str, Any]]:
        """Export user-contributed structure annotations."""
        versions = self.db.query(TrackStructureVersion).options(
            joinedload(TrackStructureVersion.track)
        ).filter(
            TrackStructureVersion.is_hidden == False
        ).all()

        return [{
            "track_isrc": v.track.isrc if v.track else None,
            "description": v.description,
            "structure_data": v.structure_data,
            "vote_count": v.vote_count,
            "is_active": v.is_active,
            "created_at": v.created_at.isoformat() if v.created_at else None,
            "author_alias": v.author_alias,
        } for v in versions]

    def _get_export_metadata(self, total_count: int, limit: int = None, offset: int = 0) -> Dict[str, Any]:
        """Generate metadata for the export."""
        return {
            "export_date": datetime.utcnow().isoformat(),
            "description": "Dansbart.se music analysis dataset - Audio features, classifications, and human feedback",
            "total_tracks_available": total_count,
            "tracks_in_export": limit if limit else total_count,
            "offset": offset,
            "source": "https://dansbart.se",
            "analysis_engine": "neckenml-analyzer",
        }

    def _get_license_info(self) -> Dict[str, str]:
        """Get licensing and attribution information."""
        return {
            "license": "CC BY 4.0",
            "license_url": "https://creativecommons.org/licenses/by/4.0/",
            "attribution": "Dansbart.se - Swedish Folk Dance Music Analysis Dataset",
            "attribution_url": "https://dansbart.se",
            "notice": "This dataset includes audio analysis generated by neckenml-analyzer and human-validated ground truth data. If you use this data, please cite Dansbart.se and consider contributing your improvements back to the community.",
            "data_includes": [
                "Audio analysis features from neckenml-analyzer",
                "Dance style classifications with confidence scores",
                "Human feedback and corrections",
                "Track structure annotations",
                "Genre classifications",
                "Public metadata (ISRC, title, artist name, duration)"
            ]
        }

    def get_export_stats(self) -> Dict[str, Any]:
        """Get statistics about the exportable dataset."""
        return {
            "total_tracks": self.db.query(Track).count(),
            "tracks_with_analysis": self.db.query(Track).filter(
                Track.analysis_version != None
            ).count(),
            "tracks_with_embeddings": self.db.query(Track).filter(
                Track.embedding != None
            ).count(),
            "total_style_votes": self.db.query(TrackStyleVote).count(),
            "total_feel_votes": self.db.query(TrackFeelVote).count(),
            "total_structure_versions": self.db.query(TrackStructureVersion).filter(
                TrackStructureVersion.is_hidden == False
            ).count(),
            "dance_styles_count": self.db.query(
                func.count(func.distinct(TrackDanceStyle.dance_style))
            ).scalar(),
            "tracks_with_user_confirmations": self.db.query(Track).join(
                Track.dance_styles
            ).filter(
                TrackDanceStyle.is_user_confirmed == True
            ).count(),
        }
