from sqlalchemy.orm import Session
from app.core.models import PlaybackLink, Track, AnalysisSource, TrackDanceStyle, TrackStructureVersion
import yt_dlp

class LinkService:
    def __init__(self, db: Session):
        self.db = db

    def report_broken(self, link_id: str, reason: str) -> bool:
        """
        Flags a link as broken.
        If reason is 'wrong_track', also clears all analysis data since it was
        based on the wrong audio.
        Returns True if successful, False if link not found.
        """
        link = self.db.query(PlaybackLink).filter(PlaybackLink.id == link_id).first()
        
        if not link:
            return False
        
        track_id = link.track_id
        
        # Disable the link so it stops showing up in the app
        link.is_working = False
        
        # If the link was for the wrong track, all analysis is invalid
        if reason == "wrong_track":
            self._clear_track_analysis(track_id)
            print(f"🗑️ Cleared analysis for track {track_id} - wrong YouTube link")
        
        self.db.commit()
        
        # Logging for Docker output
        print(f"🔗 Link {link_id} reported broken. Reason: {reason}")
        
        return True

    def _clear_track_analysis(self, track_id):
        """
        Removes all analysis data for a track when the source audio was wrong.
        This includes: analysis sources, dance styles, structure versions, and
        resets the track's cached analysis fields.
        """
        # 1. Delete analysis sources (the raw ML output)
        self.db.query(AnalysisSource).filter(
            AnalysisSource.track_id == track_id
        ).delete(synchronize_session=False)
        
        # 2. Delete AI-generated dance style classifications (keep user-confirmed ones)
        self.db.query(TrackDanceStyle).filter(
            TrackDanceStyle.track_id == track_id,
            TrackDanceStyle.is_user_confirmed == False
        ).delete(synchronize_session=False)
        
        # 3. Delete AI structure versions (keep user-created ones)
        self.db.query(TrackStructureVersion).filter(
            TrackStructureVersion.track_id == track_id,
            TrackStructureVersion.author_alias == "AI"
        ).delete(synchronize_session=False)
        
        # 4. Reset the track's cached analysis fields
        track = self.db.query(Track).filter(Track.id == track_id).first()
        if track:
            track.bars = None
            track.sections = None
            track.section_labels = None
            track.swing_ratio = None
            track.articulation = None
            track.bounciness = None
            track.processing_status = "PENDING"  # Ready for re-analysis
        
        return True
    
    def add_user_link(self, track_id: str, url: str) -> dict:
        """
        Validates and adds a user-submitted link.
        """
        track = self.db.query(Track).filter(Track.id == track_id).first()
        if not track:
            return {"success": False, "message": "Track not found"}

        # 1. Validate URL Format
        if "youtube.com" not in url and "youtu.be" not in url:
            return {"success": False, "message": "Invalid YouTube URL"}

        # 2. Fetch Metadata (No Download)
        try:
            with yt_dlp.YoutubeDL({'quiet': True}) as ydl:
                info = ydl.extract_info(url, download=False)
                
                # 3. Check Duration (if track has duration)
                if track.duration_ms:
                    yt_duration = info.get('duration', 0)
                    spotify_duration = track.duration_ms / 1000
                    diff = abs(yt_duration - spotify_duration)
                    
                    if diff > 10: # 10s tolerance
                        return {
                            "success": False, 
                            "message": f"Duration mismatch ({int(yt_duration)}s vs {int(spotify_duration)}s). Please check the link."
                        }

                video_id = info.get('id')
        except Exception as e:
            return {"success": False, "message": "Could not validate video"}

        # 4. Save to DB
        # Check if already exists
        exists = self.db.query(PlaybackLink).filter_by(track_id=track.id, deep_link=video_id).first()
        if exists:
            exists.is_working = True # Re-enable if it was disabled
        else:
            new_link = PlaybackLink(
                track_id=track.id,
                platform="youtube",
                deep_link=video_id,
                is_working=True
            )
            self.db.add(new_link)
        
        self.db.commit()
        return {"success": True, "message": "Link added successfully!"}