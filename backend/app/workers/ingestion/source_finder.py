from sqlalchemy.orm import Session
from sqlalchemy import select
from app.core.models import Track, PlaybackLink
from app.workers.audio.fetcher import AudioFetcher

class SourceFinder:
    def __init__(self, db: Session):
        self.db = db
        self.fetcher = AudioFetcher()

    def find_missing_youtube_links(self, limit: int = 50):
        """
        Finds tracks that have no YouTube PlaybackLink and populates them.
        """
        # 1. Get tracks that do NOT have a youtube link
        # (Simplified query logic for clarity)
        tracks = self.db.query(Track).filter(
            ~Track.playback_links.any(PlaybackLink.platform == 'youtube')
        ).limit(limit).all()

        print(f"🔍 Found {len(tracks)} tracks missing YouTube links.")

        for track in tracks:
            # Construct a robust query
            # "Artist - Title" is usually best. 
            # Adding "Audio" helps avoid live versions or fan covers sometimes.
            query = f"{track.artist_name} - {track.title} Audio"
            
            # If we have an ISRC, we can sometimes use it, but title/artist is 
            # often more reliable for YouTube search than ISRC alone.
            
            print(f"   Searching for: {query}")
            video_id = self.fetcher.get_youtube_id(query)

            if video_id:
                print(f"   ✅ Found ID: {video_id}")
                self._save_link(track.id, video_id)
            else:
                print(f"   ❌ No result found.")

    def _save_link(self, track_id, video_id):
        link = PlaybackLink(
            track_id=track_id,
            platform="youtube",
            deep_link=video_id  # Store just the ID!
        )
        self.db.add(link)
        self.db.commit()