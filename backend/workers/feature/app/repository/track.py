"""
Track Repository - Database operations for track management.

Simplified version for the feature worker, handling:
- Track CRUD for ingestion
- Artist/Album management
- Playback link management
"""
import uuid
from typing import Optional
from sqlalchemy.orm import Session
from app.core.models import (
    Track, Artist, Album, TrackArtist, TrackAlbum, PlaybackLink
)


class TrackRepository:
    """Repository for Track entity operations."""

    def __init__(self, db: Session):
        self.db = db

    def get_by_isrc(self, isrc: str) -> Optional[Track]:
        """Get a track by its ISRC."""
        return self.db.query(Track).filter(Track.isrc == isrc).first()

    def get_or_create_artist(
        self, name: str, spotify_id: str = None, image_url: str = None
    ) -> Artist:
        """Get an existing artist or create a new one."""
        # First try by Spotify ID if provided
        if spotify_id:
            artist = self.db.query(Artist).filter(
                Artist.spotify_id == spotify_id
            ).first()
            if artist:
                return artist

        # Fall back to name lookup if no Spotify ID
        if not spotify_id:
            artist = self.db.query(Artist).filter(Artist.name == name).first()
            if artist:
                return artist

        # Create new artist
        new_artist = Artist(name=name, spotify_id=spotify_id, image_url=image_url)
        self.db.add(new_artist)
        self.db.flush()
        return new_artist

    def create_track(
        self,
        title: str,
        isrc: str,
        duration_ms: int,
        album_data: dict,
        artists_data: list
    ) -> Track:
        """Create a new track with relationships."""
        # 1. Primary Artist
        primary_data = artists_data[0]
        primary_artist = self.get_or_create_artist(
            primary_data['name'], primary_data.get('id')
        )

        # 2. Album
        album = None
        if album_data and album_data.get('name'):
            # Try to find album by spotify_id first
            existing_album = None
            if album_data.get('spotify_id'):
                existing_album = self.db.query(Album).filter(
                    Album.spotify_id == album_data['spotify_id']
                ).first()

            # Fall back to title + artist lookup
            if not existing_album:
                existing_album = self.db.query(Album).filter(
                    Album.title == album_data['name'],
                    Album.artist_id == primary_artist.id
                ).first()

            if not existing_album:
                album = Album(
                    title=album_data['name'],
                    artist_id=primary_artist.id,
                    cover_image_url=album_data.get('cover'),
                    release_date=album_data.get('date'),
                    spotify_id=album_data.get('spotify_id')
                )
                self.db.add(album)
                self.db.flush()
                print(f"   [TrackRepo] Created album: '{album_data['name']}'")
            else:
                album = existing_album
                # Update spotify_id if album exists but doesn't have one
                if not album.spotify_id and album_data.get('spotify_id'):
                    album.spotify_id = album_data.get('spotify_id')
                    self.db.flush()

        # 3. Track
        new_track = Track(title=title, isrc=isrc, duration_ms=duration_ms)
        self.db.add(new_track)
        self.db.flush()

        # 4. Album Link
        if album:
            self.db.add(TrackAlbum(track_id=new_track.id, album_id=album.id))

        # 5. Artist Links
        for i, art_data in enumerate(artists_data):
            artist_obj = self.get_or_create_artist(
                art_data['name'], art_data.get('id')
            )
            role = "primary" if i == 0 else "featured"
            self.db.add(TrackArtist(
                track_id=new_track.id,
                artist_id=artist_obj.id,
                role=role
            ))

        self.db.commit()
        self.db.refresh(new_track)
        return new_track

    def add_playback_link(
        self, track_id: uuid.UUID, platform: str, url: str
    ) -> Optional[PlaybackLink]:
        """Add a playback link to a track (if not already exists)."""
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
