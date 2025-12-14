"""
Track Repository - Optimized queries for track management

Provides:
- Track CRUD operations
- Complex Search/Filtering for the feed
- Relationship handling
"""
import uuid
from typing import Optional, List, Dict, Tuple
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func, case, and_, or_
from app.core.models import Track, PlaybackLink, TrackDanceStyle, Artist, Album, TrackArtist, AnalysisSource, TrackStyleVote, TrackFeelVote, TrackStructureVersion, TrackPlayback, UserInteraction
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

    # ==================== PUBLIC FEED SEARCH ====================

    def search_playable_tracks(
        self,
        # Style Filters
        exact_style: str = None,          # Priority 1: Specific Sub-style (Strict match)
        allowed_styles: List[str] = None, # Priority 2: Main Category (List of allowed variants)
        style_confirmed: bool = False,
        
        # Audio Filters
        min_bpm: int = None,
        max_bpm: int = None,
        min_duration_ms: int = None,
        max_duration_ms: int = None,
        vocals: str = None, # 'instrumental' or 'vocals'
        
        # Meta Filters
        search: str = None,
        source: str = None,
        
        # Pagination
        limit: int = 20,
        offset: int = 0
    ) -> Tuple[List[Track], int]:
        """
        Complex search for public feed tracks.
        Handles hierarchy logic, joins, and eager loading.
        """
        
        # 1. Base Query with Joins (Outer join to ensure we get tracks even if style is weird)
        query = self.db.query(Track).outerjoin(Track.dance_styles)
        
        # Base Filtering
        query = query.filter(Track.processing_status.in_(['DONE', 'FAILED']))
        query = query.filter(Track.is_flagged == False)

        # 2. Apply Style Filters (Strict Hierarchy)
        if exact_style:
            # User wants a specific Sub-Style (e.g. "Reinländer")
            # We check both columns just to be safe, but primarily 'sub_style'
            query = query.filter(
                or_(
                    TrackDanceStyle.sub_style == exact_style,
                    TrackDanceStyle.dance_style == exact_style
                )
            )
            
        elif allowed_styles:
            # Case B: User selected a Category (e.g. "Polska")
            # We match ANY style that belongs to this family
            query = query.filter(TrackDanceStyle.dance_style.in_(allowed_styles))
            
        # Common Confidence Filter (Applied to whatever style logic above was used)
        if style_confirmed:
            query = query.filter(TrackDanceStyle.confidence >= 0.98)

        # 3. Apply Audio Filters
        if min_bpm:
            query = query.filter(TrackDanceStyle.effective_bpm >= min_bpm)
        if max_bpm:
            query = query.filter(TrackDanceStyle.effective_bpm <= max_bpm)
            
        if min_duration_ms:
            query = query.filter(Track.duration_ms >= min_duration_ms)
        if max_duration_ms:
            query = query.filter(Track.duration_ms <= max_duration_ms)

        if vocals == 'instrumental':
            query = query.filter(Track.has_vocals == False)
        elif vocals == 'vocals':
            query = query.filter(Track.has_vocals == True)

        # 4. Apply Text/Meta Search
        if search:
            # Search Title OR Artist Name OR Album Title
            query = query.join(Track.artist_links).join(TrackArtist.artist).outerjoin(Track.album).filter(
                or_(
                    Track.title.ilike(f"%{search}%"),
                    Artist.name.ilike(f"%{search}%"),
                    Album.title.ilike(f"%{search}%")
                )
            )

        if source:
            query = query.join(Track.playback_links).filter(
                PlaybackLink.platform == source,
                PlaybackLink.is_working == True
            )

        # 5. Eager Loading & Execution
        # Use full eager load to avoid N+1 queries during formatting
        query = query.options(*self.get_eager_load_full()).distinct()
        
        # Count total (before pagination)
        # Note: count() on distinct query can be tricky, but this is usually sufficient for pagination
        total = query.count()
        
        # Fetch Page
        items = query.offset(offset).limit(limit).all()
        
        return items, total

    # ==================== CRUD & HELPERS ====================

    def get_by_isrc(self, isrc: str, eager_load: List = None) -> Optional[Track]:
        query = self.db.query(Track).filter(Track.isrc == isrc)
        if eager_load:
            query = query.options(*eager_load)
        return query.first()

    def add_playback_link(self, track_id: uuid.UUID, platform: str, url: str) -> Optional[PlaybackLink]:
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

    def get_or_create_artist(self, name: str, spotify_id: str = None, image_url: str = None) -> Artist:
        if spotify_id:
            artist = self.db.query(Artist).filter(Artist.spotify_id == spotify_id).first()
            if artist: return artist

        if not spotify_id:
            artist = self.db.query(Artist).filter(Artist.name == name).first()
            if artist: return artist

        new_artist = Artist(name=name, spotify_id=spotify_id, image_url=image_url)
        self.db.add(new_artist)
        self.db.flush()
        return new_artist

    def create_track(self, title: str, isrc: str, duration_ms: int, album_data: dict, artists_data: list) -> Track:
        # 1. Primary Artist
        primary_data = artists_data[0]
        primary_artist = self.get_or_create_artist(primary_data['name'], primary_data.get('id'))

        # 2. Album
        album = None
        if album_data and album_data.get('name'):
            existing_album = self.db.query(Album).filter(
                Album.title == album_data['name'],
                Album.artist_id == primary_artist.id
            ).first()
            if not existing_album:
                album = Album(title=album_data['name'], artist_id=primary_artist.id, cover_image_url=album_data.get('cover'), release_date=album_data.get('date'))
                self.db.add(album)
                self.db.flush()
            else:
                album = existing_album

        # 3. Track
        new_track = Track(title=title, isrc=isrc, duration_ms=duration_ms, album_id=album.id if album else None)
        self.db.add(new_track)
        self.db.flush()

        # 4. Links
        for i, art_data in enumerate(artists_data):
            artist_obj = self.get_or_create_artist(art_data['name'], art_data.get('id'))
            role = "primary" if i == 0 else "featured"
            self.db.add(TrackArtist(track_id=new_track.id, artist_id=artist_obj.id, role=role))

        self.db.commit()
        self.db.refresh(new_track)
        return new_track

    def delete_with_cascade(self, track_ids: List[uuid.UUID]) -> Dict[str, int]:
        counts = {}
        # Delete children first
        counts['track_artists'] = self.db.query(TrackArtist).filter(TrackArtist.track_id.in_(track_ids)).delete(synchronize_session=False)
        counts['playback_links'] = self.db.query(PlaybackLink).filter(PlaybackLink.track_id.in_(track_ids)).delete(synchronize_session=False)
        counts['dance_styles'] = self.db.query(TrackDanceStyle).filter(TrackDanceStyle.track_id.in_(track_ids)).delete(synchronize_session=False)
        counts['analysis_sources'] = self.db.query(AnalysisSource).filter(AnalysisSource.track_id.in_(track_ids)).delete(synchronize_session=False)
        counts['style_votes'] = self.db.query(TrackStyleVote).filter(TrackStyleVote.track_id.in_(track_ids)).delete(synchronize_session=False)
        counts['feel_votes'] = self.db.query(TrackFeelVote).filter(TrackFeelVote.track_id.in_(track_ids)).delete(synchronize_session=False)
        counts['structure_versions'] = self.db.query(TrackStructureVersion).filter(TrackStructureVersion.track_id.in_(track_ids)).delete(synchronize_session=False)
        counts['playbacks'] = self.db.query(TrackPlayback).filter(TrackPlayback.track_id.in_(track_ids)).delete(synchronize_session=False)
        counts['interactions'] = self.db.query(UserInteraction).filter(UserInteraction.track_id.in_(track_ids)).delete(synchronize_session=False)
        
        # Delete Parent
        counts['tracks'] = self.db.query(Track).filter(Track.id.in_(track_ids)).delete(synchronize_session=False)
        
        self.db.flush()
        return counts