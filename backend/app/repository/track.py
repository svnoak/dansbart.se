"""
Track Repository - Optimized queries for track management

Provides:
- Track CRUD operations
- Artist and album relationship handling
- Playback link management
- Dance style management
- Track statistics
"""
import uuid
from typing import Optional, List, Dict, Tuple
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func, case, and_
from app.core.models import Track, PlaybackLink, TrackDanceStyle, Artist, Album, TrackArtist
from .base import BaseRepository


class TrackRepository(BaseRepository[Track]):
    """Repository for Track entity with optimized queries."""

    def __init__(self, db: Session):
        super().__init__(db, Track)

    # ==================== EAGER LOADING CONFIGURATIONS ====================

    @staticmethod
    def get_eager_load_full():
        """Full eager loading for track with all relationships."""
        return [
            selectinload(Track.dance_styles),
            selectinload(Track.artist_links).joinedload(TrackArtist.artist),
            joinedload(Track.album).joinedload(Album.artist),
            selectinload(Track.playback_links),
            selectinload(Track.analysis_sources)
        ]

    @staticmethod
    def get_eager_load_basic():
        """Basic eager loading for track listings."""
        return [
            selectinload(Track.dance_styles),
            selectinload(Track.artist_links).joinedload(TrackArtist.artist),
            joinedload(Track.album)
        ]

    # ==================== LOOKUP OPERATIONS ====================

    def get_by_isrc(self, isrc: str, eager_load: List = None) -> Optional[Track]:
        """Get track by ISRC code."""
        query = self.db.query(Track).filter(Track.isrc == isrc)

        if eager_load:
            query = query.options(*eager_load)

        return query.first()

    # ==================== ARTIST OPERATIONS (Helper Methods) ====================

    def get_or_create_artist(self, name: str, spotify_id: str = None, image_url: str = None) -> Artist:
        """
        Get existing artist or create a new one.
        Tries Spotify ID first, then falls back to name matching.
        """
        # Try finding by Spotify ID first (most accurate)
        if spotify_id:
            artist = self.db.query(Artist).filter(Artist.spotify_id == spotify_id).first()
            if artist:
                return artist

        # Fallback: Find by name (less accurate but necessary if ID is missing)
        if not spotify_id:
            artist = self.db.query(Artist).filter(Artist.name == name).first()
            if artist:
                return artist

        # Create new artist
        new_artist = Artist(name=name, spotify_id=spotify_id, image_url=image_url)
        self.db.add(new_artist)
        self.db.flush()
        return new_artist

    # ==================== ALBUM OPERATIONS (Helper Methods) ====================

    def get_or_create_album(
        self,
        title: str,
        artist_id: uuid.UUID,
        cover_url: str = None,
        release_date: str = None
    ) -> Album:
        """
        Get existing album or create a new one.
        Assumes unique album title per artist.
        """
        album = self.db.query(Album).filter(
            Album.title == title,
            Album.artist_id == artist_id
        ).first()

        if not album:
            album = Album(
                title=title,
                artist_id=artist_id,
                cover_image_url=cover_url,
                release_date=release_date
            )
            self.db.add(album)
            self.db.flush()

        return album

    # ==================== TRACK CREATION ====================

    def create_track(
        self,
        title: str,
        isrc: str,
        duration_ms: int,
        album_data: dict,
        artists_data: list
    ) -> Track:
        """
        Create a new track with album and artist relationships.

        Args:
            title: Track title
            isrc: ISRC code
            duration_ms: Duration in milliseconds
            album_data: {'name': str, 'cover': str, 'date': str, 'artist_name': str}
            artists_data: [{'name': str, 'id': str}, ...]

        Returns:
            Created Track instance
        """
        # 1. Handle Primary Artist (for Album ownership)
        primary_artist_data = artists_data[0]
        primary_artist = self.get_or_create_artist(
            name=primary_artist_data['name'],
            spotify_id=primary_artist_data.get('id')
        )

        # 2. Handle Album
        album = None
        if album_data and album_data.get('name'):
            album = self.get_or_create_album(
                title=album_data['name'],
                artist_id=primary_artist.id,
                cover_url=album_data.get('cover'),
                release_date=album_data.get('date')
            )

        # 3. Create Track
        new_track = Track(
            title=title,
            isrc=isrc,
            duration_ms=duration_ms,
            album_id=album.id if album else None
        )
        self.db.add(new_track)
        self.db.flush()

        # 4. Link Artists (Many-to-Many)
        for i, art_data in enumerate(artists_data):
            artist_obj = self.get_or_create_artist(
                name=art_data['name'],
                spotify_id=art_data.get('id')
            )

            role = "primary" if i == 0 else "featured"

            link = TrackArtist(
                track_id=new_track.id,
                artist_id=artist_obj.id,
                role=role
            )
            self.db.add(link)

        self.db.commit()
        self.db.refresh(new_track)
        return new_track

    # ==================== PLAYBACK LINK MANAGEMENT ====================

    def add_playback_link(self, track_id: uuid.UUID, platform: str, url: str) -> Optional[PlaybackLink]:
        """
        Add a playback link to a track.
        Returns None if link already exists.
        """
        existing = self.db.query(PlaybackLink).filter(
            PlaybackLink.track_id == track_id,
            PlaybackLink.platform == platform,
            PlaybackLink.deep_link == url
        ).first()

        if existing:
            return None

        link = PlaybackLink(track_id=track_id, platform=platform, deep_link=url)
        self.db.add(link)
        self.db.commit()
        return link

    def get_playback_links(self, track_id: uuid.UUID) -> List[PlaybackLink]:
        """Get all playback links for a track."""
        return self.db.query(PlaybackLink).filter(
            PlaybackLink.track_id == track_id
        ).all()

    def delete_playback_links(self, track_id: uuid.UUID) -> int:
        """Delete all playback links for a track. Returns count deleted."""
        count = self.db.query(PlaybackLink).filter(
            PlaybackLink.track_id == track_id
        ).delete()
        self.db.flush()
        return count

    # ==================== DANCE STYLE MANAGEMENT ====================

    def add_dance_style(
        self,
        track_id: uuid.UUID,
        style: str,
        multiplier: float,
        effective_bpm: int
    ) -> TrackDanceStyle:
        """
        Add or update a dance style for a track.
        """
        existing = self.db.query(TrackDanceStyle).filter(
            TrackDanceStyle.track_id == track_id,
            TrackDanceStyle.dance_style == style
        ).first()

        if existing:
            existing.bpm_multiplier = multiplier
            existing.effective_bpm = effective_bpm
            self.db.commit()
            return existing

        new_style = TrackDanceStyle(
            track_id=track_id,
            dance_style=style,
            bpm_multiplier=multiplier,
            effective_bpm=effective_bpm
        )
        self.db.add(new_style)
        self.db.commit()
        return new_style

    def get_dance_styles(self, track_id: uuid.UUID) -> List[TrackDanceStyle]:
        """Get all dance styles for a track."""
        return self.db.query(TrackDanceStyle).filter(
            TrackDanceStyle.track_id == track_id
        ).all()

    # ==================== TRACK STATISTICS ====================

    def get_track_stats_by_entity(
        self,
        entity_type: str,
        entity_ids: List[uuid.UUID]
    ) -> Dict[str, Dict[str, int]]:
        """
        Get track statistics grouped by entity (artist or album).
        Optimized batch query for admin services.

        Args:
            entity_type: 'artist' or 'album'
            entity_ids: List of entity IDs

        Returns:
            Dict mapping entity_id to stats dict
        """
        if not entity_ids:
            return {}

        entity_id_strs = [str(eid) for eid in entity_ids]

        if entity_type == 'artist':
            stats_query = self.db.query(
                TrackArtist.artist_id.label('entity_id'),
                func.count(Track.id).label('total'),
                func.sum(case((Track.processing_status == 'DONE', 1), else_=0)).label('done'),
                func.sum(case((Track.processing_status == 'PENDING', 1), else_=0)).label('pending'),
                func.sum(case((Track.processing_status == 'FAILED', 1), else_=0)).label('failed')
            ).join(Track, TrackArtist.track_id == Track.id).filter(
                TrackArtist.artist_id.in_(entity_ids)
            ).group_by(TrackArtist.artist_id).all()

        elif entity_type == 'album':
            stats_query = self.db.query(
                Track.album_id.label('entity_id'),
                func.count(Track.id).label('total'),
                func.sum(case((Track.processing_status == 'DONE', 1), else_=0)).label('done'),
                func.sum(case((Track.processing_status == 'PENDING', 1), else_=0)).label('pending'),
                func.sum(case((Track.processing_status == 'FAILED', 1), else_=0)).label('failed')
            ).filter(
                Track.album_id.in_(entity_ids)
            ).group_by(Track.album_id).all()

        else:
            raise ValueError(f"Invalid entity_type: {entity_type}")

        stats_map = {}
        for row in stats_query:
            stats_map[str(row.entity_id)] = {
                'total': row.total or 0,
                'done': row.done or 0,
                'pending': row.pending or 0,
                'failed': row.failed or 0
            }

        # Fill in missing entities with zeros
        for entity_id_str in entity_id_strs:
            if entity_id_str not in stats_map:
                stats_map[entity_id_str] = {
                    'total': 0,
                    'done': 0,
                    'pending': 0,
                    'failed': 0
                }

        return stats_map

    # ==================== PAGINATED QUERIES ====================

    def get_tracks_paginated(
        self,
        search: str = None,
        status: str = None,
        artist_id: uuid.UUID = None,
        album_id: uuid.UUID = None,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[Dict], int]:
        """
        Get paginated tracks with filtering.
        Optimized with eager loading.

        Returns:
            Tuple of (track_dicts, total_count)
        """
        query = self.db.query(Track).options(*self.get_eager_load_basic())

        if search:
            query = query.filter(Track.title.ilike(f"%{search}%"))

        if status:
            query = query.filter(Track.processing_status == status)

        if artist_id:
            query = query.join(TrackArtist).filter(TrackArtist.artist_id == artist_id)

        if album_id:
            query = query.filter(Track.album_id == album_id)

        total = query.count()
        tracks = query.order_by(Track.title).offset(offset).limit(limit).all()

        # Format results
        items = []
        for track in tracks:
            items.append({
                "id": str(track.id),
                "title": track.title,
                "isrc": track.isrc,
                "duration_ms": track.duration_ms,
                "processing_status": track.processing_status,
                "album": {
                    "id": str(track.album.id) if track.album else None,
                    "title": track.album.title if track.album else None
                } if track.album else None,
                "artists": [
                    {
                        "id": str(link.artist.id),
                        "name": link.artist.name,
                        "role": link.role
                    }
                    for link in track.artist_links
                ],
                "dance_styles": [
                    {
                        "style": ds.dance_style,
                        "bpm": ds.effective_bpm,
                        "is_primary": ds.is_primary
                    }
                    for ds in track.dance_styles
                ]
            })

        return items, total

    # ==================== CASCADE DELETE OPERATIONS ====================

    def delete_with_cascade(self, track_ids: List[uuid.UUID]) -> Dict[str, int]:
        """
        Delete tracks and all related entities.
        Returns count of deleted items per entity type.
        """
        counts = {}

        # Delete related entities first
        counts['track_artists'] = self.db.query(TrackArtist).filter(
            TrackArtist.track_id.in_(track_ids)
        ).delete(synchronize_session=False)

        counts['playback_links'] = self.db.query(PlaybackLink).filter(
            PlaybackLink.track_id.in_(track_ids)
        ).delete(synchronize_session=False)

        counts['dance_styles'] = self.db.query(TrackDanceStyle).filter(
            TrackDanceStyle.track_id.in_(track_ids)
        ).delete(synchronize_session=False)

        # Import other models for cascade delete
        from app.core.models import (
            AnalysisSource, TrackStyleVote, TrackFeelVote,
            TrackStructureVersion, TrackPlayback, UserInteraction
        )

        counts['analysis_sources'] = self.db.query(AnalysisSource).filter(
            AnalysisSource.track_id.in_(track_ids)
        ).delete(synchronize_session=False)

        counts['style_votes'] = self.db.query(TrackStyleVote).filter(
            TrackStyleVote.track_id.in_(track_ids)
        ).delete(synchronize_session=False)

        counts['feel_votes'] = self.db.query(TrackFeelVote).filter(
            TrackFeelVote.track_id.in_(track_ids)
        ).delete(synchronize_session=False)

        counts['structure_versions'] = self.db.query(TrackStructureVersion).filter(
            TrackStructureVersion.track_id.in_(track_ids)
        ).delete(synchronize_session=False)

        counts['playbacks'] = self.db.query(TrackPlayback).filter(
            TrackPlayback.track_id.in_(track_ids)
        ).delete(synchronize_session=False)

        counts['interactions'] = self.db.query(UserInteraction).filter(
            UserInteraction.track_id.in_(track_ids)
        ).delete(synchronize_session=False)

        # Finally delete tracks
        counts['tracks'] = self.db.query(Track).filter(
            Track.id.in_(track_ids)
        ).delete(synchronize_session=False)

        self.db.flush()

        return counts

    # ==================== STATUS UPDATES ====================

    def update_status(self, track_id: uuid.UUID, status: str) -> Optional[Track]:
        """Update track processing status."""
        track = self.get_by_id(track_id)
        if track:
            track.processing_status = status
            self.db.flush()
        return track

    def bulk_update_status(self, track_ids: List[uuid.UUID], status: str) -> int:
        """Update processing status for multiple tracks."""
        count = self.db.query(Track).filter(
            Track.id.in_(track_ids)
        ).update(
            {Track.processing_status: status},
            synchronize_session=False
        )
        self.db.flush()
        return count
