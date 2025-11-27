from sqlalchemy.orm import Session
from app.core.models import Track, PlaybackLink
from app.repository.analysis import AnalysisRepository
from app.workers.audio.fetcher import AudioFetcher
from backend.app.workers.audio.analyzer import AudioAnalyzer

class AnalysisService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AnalysisRepository(db)
        self.fetcher = AudioFetcher()
        self.analyzer = AudioAnalyzer() # Instantiated once

    def process_library(self, limit: int = 5, force: bool = False):
        print(f"🔍 Scanning for {limit} tracks...")
        
        tracks = self.db.query(Track).limit(limit).all()
        
        count = 0
        for track in tracks:
            if not force and self.repo.get_latest_by_track(track.id, "hybrid_ml_v2"):
                continue
                
            if self._process_single_track(track):
                count += 1
                if count >= limit: break
                
        print(f"🏁 Processed {count} tracks.")

    def _process_single_track(self, track: Track) -> bool:
        print(f"▶️  Processing: {track.title}")
        
        query = f"{track.title} {track.artist_name} audio"
        result = self.fetcher.fetch_track_audio(str(track.id), query)
        
        if not result:
            return False
            
        file_path = result['file_path']
        youtube_id = result.get('youtube_id')

        try:
            if youtube_id:
                self._ensure_youtube_link(track, youtube_id)

            context = f"{track.title} {track.artist_name} {track.album_name or ''}"
            data = self.analyzer.analyze_file(file_path, context)

            if data:
                self.repo.add_analysis(
                    track_id=track.id,
                    source_type="hybrid_ml_v2",
                    data=data
                )
                print(f"   ✅ Saved analysis. Meter: {data['meter']}")
                return True
            else:
                return False

        finally:
            self.fetcher.cleanup(str(track.id))

    def _ensure_youtube_link(self, track, video_id):
        """Idempotently saves the YouTube link"""
        exists = self.db.query(PlaybackLink).filter_by(
            track_id=track.id, 
            platform="youtube"
        ).first()
        
        if not exists:
            print(f"   🔗 Found new source: YouTube ({video_id})")
            link = PlaybackLink(
                track_id=track.id,
                platform="youtube",
                deep_link=video_id
            )
            self.db.add(link)
            self.db.commit()