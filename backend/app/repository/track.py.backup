import uuid
from sqlalchemy.orm import Session
from app.core.models import Track, PlaybackLink, TrackDanceStyle, Artist, Album, TrackArtist

class TrackRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_isrc(self, isrc: str) -> Track | None:
        return self.db.query(Track).filter(Track.isrc == isrc).first()

    # --- HELPER: GET OR CREATE ARTIST ---
    def get_or_create_artist(self, name: str, spotify_id: str = None, image_url: str = None) -> Artist:
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

        # Create new
        new_artist = Artist(name=name, spotify_id=spotify_id, image_url=image_url)
        self.db.add(new_artist)
        self.db.flush() # Flush to get ID without committing transaction yet
        return new_artist

    # --- HELPER: GET OR CREATE ALBUM ---
    def get_or_create_album(self, title: str, artist_id: uuid.UUID, cover_url: str = None, release_date: str = None) -> Album:
        # We assume unique album title PER ARTIST
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

    def get_by_isrc(self, isrc: str) -> Track | None:
        return self.db.query(Track).filter(Track.isrc == isrc).first()

    # --- MAIN CREATE FUNCTION ---
    def create_track(self, title: str, isrc: str, duration_ms: int, 
                     album_data: dict, artists_data: list) -> Track:
        """
        album_data: {'name': str, 'cover': str, 'date': str, 'artist_name': str}
        artists_data: [{'name': str, 'id': str}, ...]
        """
        
        # 1. Handle Primary Artist (for Album ownership)
        # We usually assume the first artist in the list is the "Album Artist"
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
        self.db.flush() # Get ID

        # 4. Link Artists (Many-to-Many)
        for i, art_data in enumerate(artists_data):
            # Get specific artist object
            artist_obj = self.get_or_create_artist(
                name=art_data['name'], 
                spotify_id=art_data.get('id')
            )
            
            # Determine role (First is primary, others are featured)
            role = "primary" if i == 0 else "featured"
            
            # Create Link
            link = TrackArtist(
                track_id=new_track.id,
                artist_id=artist_obj.id,
                role=role
            )
            self.db.add(link)

        self.db.commit()
        self.db.refresh(new_track)
        return new_track

    def add_playback_link(self, track_id: uuid.UUID, platform: str, url: str):
        existing = self.db.query(PlaybackLink).filter(
            PlaybackLink.track_id == track_id,
            PlaybackLink.platform == platform,
            PlaybackLink.deep_link == url
        ).first()

        if not existing:
            link = PlaybackLink(track_id=track_id, platform=platform, deep_link=url)
            self.db.add(link)
            self.db.commit()
        else:
            pass

    def add_dance_style(self, track_id: uuid.UUID, style: str, multiplier: float, effective_bpm: int):
        """Tags a track with a dance style and tempo"""
        existing = self.db.query(TrackDanceStyle).filter(
            TrackDanceStyle.track_id == track_id,
            TrackDanceStyle.dance_style == style
        ).first()

        if existing:
            existing.bpm_multiplier = multiplier
            existing.effective_bpm = effective_bpm
        else:
            new_style = TrackDanceStyle(
                track_id=track_id,
                dance_style=style,
                bpm_multiplier=multiplier,
                effective_bpm=effective_bpm
            )
            self.db.add(new_style)
        
        self.db.commit()