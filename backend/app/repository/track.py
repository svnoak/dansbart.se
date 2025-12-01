import uuid
from sqlalchemy.orm import Session
from app.core.models import Track, PlaybackLink, TrackDanceStyle

class TrackRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_isrc(self, isrc: str) -> Track | None:
        return self.db.query(Track).filter(Track.isrc == isrc).first()

    def create_track(self, title: str, artist: str, isrc: str, album: str = None, duration_ms: int = None) -> Track:
        new_track = Track(
            title=title,
            artist_name=artist,
            isrc=isrc,
            album_name=album,
            duration_ms=duration_ms
        )
        self.db.add(new_track)
        self.db.commit()
        self.db.refresh(new_track)
        return new_track

    def update_album(self, track: Track, album_name: str):
        """Updates the album name for an existing track"""
        track.album_name = album_name
        self.db.add(track) # Ensure it's attached to session
        self.db.commit()
        self.db.refresh(track)

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