from sqlalchemy.orm import Session
from app.core.models import Track, PlaybackLink
from app.repository.analysis import AnalysisRepository
from app.workers.audio.fetcher import AudioFetcher
from app.workers.audio.analyzer import AudioAnalyzer
from app.services.classification import ClassificationService 
from app.core.database import SessionLocal
import time

class AnalysisService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AnalysisRepository(db)
        self.fetcher = AudioFetcher()
        self.analyzer = AudioAnalyzer()
        self.classifier_service = ClassificationService(db)

    def analyze_track_by_id(self, track_id: str):
        """
        Background Task Entry Point.
        Manages the lifecycle state: PENDING -> PROCESSING -> DONE / FAILED
        """
        self.repo.db = self.db
        self.classifier_service.db = self.db

        track = self.db.query(Track).filter(Track.id == track_id).first()
        if not track:
            return

        db = SessionLocal()

        # 1. UPDATE STATE: STARTING
        print(f"🔄 Status Update: {track.title} -> PROCESSING")
        track.processing_status = "PROCESSING"
        self.db.commit()

        try:
            # 1. Start Transaction & Mark Processing
            print(f"🔄 Status Update: {track.title} -> PROCESSING")
            track.processing_status = "PROCESSING"

            # 2. RUN LOGIC
            success = self._process_single_track(track)

            # 3. UPDATE FINAL STATUS
            if success:
                track.processing_status = "DONE"
                print(f"✅ Status Update: {track.title} -> DONE")
            else:
                track.processing_status = "FAILED"
                print(f"❌ Status Update: {track.title} -> FAILED")
            
            # FINAL COMMIT: If we reach here without error, commit everything
            self.db.commit()

        except Exception as e:
            # Rollback if any part of the process failed (e.g., File Write, Classification Crash)
            self.db.rollback() 
            print(f"🔥 Critical Failure processing {track.title}: {e}")
            try:
                track.processing_status = "FAILED"
                self.db.commit()
            except: pass
            
        finally:
            # Cleanup temp files regardless of outcome
            self.fetcher.cleanup(str(track.id))

    def _process_single_track(self, track: Track) -> bool:
        print(f"▶️  Processing: {track.title}")
        
        # 1. FETCH AUDIO (Use existing link if available)
        existing_link = next((l for l in track.playback_links if l.platform == 'youtube' and l.is_working), None)
        
        # If we have a stored link, use it. Otherwise search by metadata.
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
            # Save/Update the YouTube link if we found a new one
            if youtube_id:
                self._ensure_youtube_link(track, youtube_id)

            print(f"   [TIME] Starting CPU-intensive analysis...")
            start_time = time.time()

            # 2. ANALYZE (MusiCNN + Madmom)
            context = f"{track.title} {track.artist_name} {track.album_name or ''}"
            data = self.analyzer.analyze_file(file_path, context)

            end_time = time.time()
            print(f"   [TIME] Analysis finished in {end_time - start_time:.2f} seconds.") # <-- Shows duration

            if data:
                # 3. SAVE RAW ANALYSIS
                self.repo.add_analysis(
                    track_id=track.id,
                    source_type="hybrid_ml_v2",
                    data=data
                )

                # ADDING BARS AND SECTIONS TO TRACK
                track.bars = data.get('bars')
                track.sections = data.get('sections')
                track.section_labels = data.get('section_labels')
                self.db.add(track)
                
                # 4. AUTO-CLASSIFY
                # This makes the track visible in the frontend immediately if successful
                print(f"   🧠 Auto-classifying...")
                self.classifier_service.classify_track_immediately(track)
                
                return True
            
            return False

        finally:
            # Cleanup temp files even if analysis crashed
            self.fetcher.cleanup(str(track.id))

    def _ensure_youtube_link(self, track, video_id):
        exists = self.db.query(PlaybackLink).filter_by(track_id=track.id, deep_link=video_id).first()
        if not exists:
            link = PlaybackLink(
                track_id=track.id, 
                platform="youtube", 
                deep_link=video_id,
                is_working=True
            )
            self.db.add(link)