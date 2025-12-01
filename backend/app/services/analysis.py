from sqlalchemy.orm import Session
from app.core.models import Track, PlaybackLink
from app.repository.analysis import AnalysisRepository
from app.workers.audio.fetcher import AudioFetcher
from app.workers.audio.analyzer import AudioAnalyzer
from app.services.classification import ClassificationService 

class AnalysisService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AnalysisRepository(db)
        self.fetcher = AudioFetcher()
        self.analyzer = AudioAnalyzer()
        self.classifier_service = ClassificationService(db)

    def analyze_track_by_id(self, track_id: str):
        """Background Task Entry Point"""
        track = self.db.query(Track).filter(Track.id == track_id).first()
        if track:
            self._process_single_track(track)

    def _process_single_track(self, track: Track) -> bool:
        print(f"▶️  Processing: {track.title}")
        
        # 1. FETCH AUDIO (Use existing link if available)
        existing_link = next((l for l in track.playback_links if l.platform == 'youtube' and l.is_working), None)
        query = existing_link.deep_link if existing_link else f"{track.title} {track.artist_name} topic audio"
        
        result = self.fetcher.fetch_track_audio(
            track_id=str(track.id), 
            query=query, 
            expected_duration_ms=track.duration_ms 
        )
        
        if not result:
            return False
            
        file_path = result['file_path']
        youtube_id = result.get('youtube_id')

        try:
            if youtube_id:
                self._ensure_youtube_link(track, youtube_id)

            # 2. ANALYZE (MusiCNN + Madmom)
            context = f"{track.title} {track.artist_name} {track.album_name or ''}"
            data = self.analyzer.analyze_file(file_path, context)

            if data:
                # 3. SAVE RAW ANALYSIS
                self.repo.add_analysis(
                    track_id=track.id,
                    source_type="hybrid_ml_v2",
                    data=data
                )
                
                # 4. CHAIN REACTION: CLASSIFY IMMEDIATELY ⚡️
                # This makes the track visible in the frontend immediately
                print(f"   🧠 Auto-classifying...")
                self.classifier_service.classify_track_immediately(track)
                
                return True
            return False

        finally:
            self.fetcher.cleanup(str(track.id))

    def _ensure_youtube_link(self, track, video_id):
        # (Keep existing logic)
        exists = self.db.query(PlaybackLink).filter_by(track_id=track.id, deep_link=video_id).first()
        if not exists:
            link = PlaybackLink(track_id=track.id, platform="youtube", deep_link=video_id)
            self.db.add(link)
            self.db.commit()