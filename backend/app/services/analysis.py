from sqlalchemy.orm import Session, joinedload, selectinload
from app.core.models import Track, PlaybackLink, TrackStructureVersion, TrackArtist, TrackAlbum
from app.repository.analysis import AnalysisRepository
from app.workers.audio.fetcher import AudioFetcher
from neckenml import AudioAnalyzer
from app.services.classification import ClassificationService
from app.core.database import SessionLocal
import time
import os
import gc
import psutil

class AnalysisService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AnalysisRepository(db)
        self.fetcher = AudioFetcher()  # No db parameter needed

        self.classifier_service = ClassificationService(db)

    def _log_memory_usage(self, stage: str):
        """Log current memory usage for debugging"""
        process = psutil.Process()
        mem_info = process.memory_info()
        mem_mb = mem_info.rss / 1024 / 1024
        print(f"   [MEMORY] {stage}: {mem_mb:.1f} MB")
        return mem_mb

    def analyze_track_by_id(self, track_id: str):
        """
        Background Task Entry Point.
        Manages the lifecycle state: PENDING -> PROCESSING -> DONE / FAILED
        """
        self._log_memory_usage("Start of task")

        self.repo.db = self.db
        self.classifier_service.db = self.db

        track = self.db.query(Track).options(
            joinedload(Track.playback_links),
            selectinload(Track.album_links).joinedload(TrackAlbum.album),
            joinedload(Track.artist_links).joinedload(TrackArtist.artist)
        ).filter(Track.id == track_id).first()
        if not track:
            return

        # 1. UPDATE STATE: STARTING
        print(f"🔄 Status Update: {track.title} -> PROCESSING")
        track.processing_status = "PROCESSING"
        self.db.commit()

        try:
            # 1. Start Transaction & Mark Processing
            print(f"🔄 Status Update: {track.title} -> PROCESSING")

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
            # 1. Cleanup Files
            self.fetcher.cleanup(str(track.id))

            # 2. Clear SQLAlchemy Identity Map
            self.db.expire_all()

            # 3. Python GC (Releases Python Wrappers)
            self._log_memory_usage("Before GC")
            gc.collect()
            self._log_memory_usage("After GC")

    def _process_single_track(self, track: Track) -> bool:
        print(f"▶️  Processing: {track.title}")
        
        # 1. FETCH AUDIO (Use existing link if available)
        existing_link = next((l for l in track.playback_links if l.platform == 'youtube' and l.is_working), None)

        artist_name = ""
        primary_link = next((l for l in track.artist_links if l.role == 'primary'), None)
        if primary_link:
            artist_name = primary_link.artist.name
        elif track.artist_links:
            artist_name = track.artist_links[0].artist.name

        album_name = track.album.title if track.album else ""
        
        # If we have a stored link, use it directly (skip search).
        # Otherwise search by metadata.
        if existing_link:
            # Direct download - user provided this link, trust it
            print(f"   📎 Using existing YouTube link: {existing_link.deep_link}")
            result = self.fetcher.fetch_track_audio(
                track_id=str(track.id), 
                query="",
                expected_duration_ms=track.duration_ms,
                track_title=track.title,
                artist_name=artist_name,
                direct_video_id=existing_link.deep_link
            )
        else:
            # Search YouTube for the best match
            query = f"{artist_name} - {track.title}"
            print(f"   🔍 Searching YouTube for: {query}")
            result = self.fetcher.fetch_track_audio(
                track_id=str(track.id), 
                query=query, 
                expected_duration_ms=track.duration_ms,
                track_title=track.title,
                artist_name=artist_name
            )
        
        if not result:
            # No audio available - try to infer style from track title
            print(f"   ⚠️ No audio found, attempting title-based classification...")
            return self._classify_from_title(track)
            
        file_path = result['file_path']
        youtube_id = result.get('youtube_id')

        print(f"   [MEMORY] Initializing ML Model...")
        # Use neckenml-analyzer (without audio_source since we fetch manually with YouTube fetcher)
        model_dir = os.getenv('neckenml_MODEL_DIR', '/app/app/workers/audio/models')

        with AudioAnalyzer(audio_source=None, model_dir=model_dir) as analyzer:
            # Save/Update the YouTube link if we found a new one
            if youtube_id:
                self._ensure_youtube_link(track, youtube_id)

            print(f"   [TIME] Starting CPU-intensive analysis...")
            self._log_memory_usage("Before analysis")
            start_time = time.time()

            # 2. ANALYZE (MusiCNN + Madmom) with ARTIFACT PERSISTENCE
            context = f"{track.title} {artist_name} {album_name}"

            result = analyzer.analyze_file(file_path, context, return_artifacts=True)

            end_time = time.time()
            self._log_memory_usage("After analysis")
            print(f"   [TIME] Analysis finished in {end_time - start_time:.2f} seconds.")

            if result:
                # Extract features and artifacts
                data = result["features"]           # Derived features
                artifacts = result["raw_artifacts"]  # Raw Madmom/MusiCNN/etc outputs

                # 3. SAVE RAW ARTIFACTS (enables fast re-analysis!)
                self.repo.add_analysis(
                    track_id=track.id,
                    source_type="neckenml_analyzer",  # New source type
                    raw_data=artifacts  # Store artifacts, not features!
                )

                # --- Basic Audio Stats ---
                track.tempo_bpm = data.get('tempo_bpm')
                track.duration_ms = result.get('actual_duration_ms', 0)
                track.loudness = data.get('loudness_lufs') 
                track.is_instrumental = data.get('is_likely_instrumental', False)

                # --- Advanced Features ---
                track.swing_ratio = data.get('swing_ratio')
                track.articulation = data.get('articulation')
                track.bounciness = data.get('bounciness')
                track.punchiness = data.get('punchiness')
                
                # --- Specialized Scores ---
                track.polska_score = data.get('polska_score')
                track.hambo_score = data.get('hambo_score')
                track.voice_probability = data.get('voice_probability')
                
                # --- Structural Data ---
                track.bars = data.get('bars')
                track.sections = data.get('sections')
                track.section_labels = data.get('section_labels')
                track.embedding = data.get('embedding')

                ai_version = TrackStructureVersion(
                    track_id=track.id,
                    description="Original AI Analysis",
                    author_alias="AI",
                    structure_data={
                        "bars": data.get('bars'),
                        "sections": data.get('sections'),
                        "labels": data.get('section_labels')
                    },
                    is_active=True, 
                    vote_count=0,
                    is_hidden=False
                )
                self.db.add(ai_version)
                self.db.add(track)
                
                # 4. AUTO-CLASSIFY
                # This makes the track visible in the frontend immediately if successful
                print(f"   🧠 Auto-classifying...")
                self.classifier_service.classify_track_immediately(track, analysis_data=data)

                # Clear large objects from memory immediately after use
                del result
                del data
                del artifacts
                gc.collect()
                self._log_memory_usage("After cleanup")

                return True

            return False

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

    def _classify_from_title(self, track: Track) -> bool:
        """
        Fallback classification when no audio is available.
        Attempts to infer dance style from the track title.
        Returns True if a style was found, False otherwise.
        """
        title_lower = track.title.lower()
        
        # Map of keywords to dance styles (order matters - more specific first)
        style_keywords = {
            "slängpolska": "Slängpolska",
            "slangpolska": "Slängpolska", 
            "polska": "Polska",
            "schottis": "Schottis",
            "vals": "Vals",
            "waltz": "Vals",
            "hambo": "Hambo",
            "polka": "Polka",
            "mazurka": "Mazurka",
            "snoa": "Snoa",
            "gånglåt": "Gånglåt",
            "ganglåt": "Gånglåt",
            "ganglat": "Gånglåt",
            "marsch": "Gånglåt",
            "engelska": "Engelska",
        }
        
        detected_style = None
        for keyword, style in style_keywords.items():
            if keyword in title_lower:
                detected_style = style
                break
        
        if not detected_style:
            print(f"   ❌ Could not infer style from title: {track.title}")
            return False
        
        print(f"   📝 Inferred style from title: {detected_style}")
        
        # Create a TrackDanceStyle with low confidence (since it's just from title)
        from app.core.models import TrackDanceStyle
        
        # Check if style already exists
        existing = self.db.query(TrackDanceStyle).filter(
            TrackDanceStyle.track_id == track.id,
            TrackDanceStyle.dance_style == detected_style
        ).first()
        
        if not existing:
            style_row = TrackDanceStyle(
                track_id=track.id,
                dance_style=detected_style,
                is_primary=True,
                confidence=0.5,  # Low confidence - title-based only
                effective_bpm=0,  # Unknown without audio
                tempo_category=None,
                bpm_multiplier=1.0,
                is_user_confirmed=False,
                confirmation_count=0
            )
            self.db.add(style_row)
        else:
            # Update existing to be primary if it wasn't
            existing.is_primary = True
            if existing.confidence < 0.5:
                existing.confidence = 0.5
        
        self.db.commit()
        return True