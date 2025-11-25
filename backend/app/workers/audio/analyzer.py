import os
import glob
import librosa
import numpy as np
import yt_dlp
import scipy.stats
from sqlalchemy.orm import Session
from app.repository.track import TrackRepository
from app.repository.analysis import AnalysisRepository
from app.core.models import Track

# Temporary folder for MP3s
TEMP_DIR = "./temp_audio"
os.makedirs(TEMP_DIR, exist_ok=True)

class AudioAnalyzer:
    def __init__(self, db: Session):
        self.db = db
        self.track_repo = TrackRepository(db)
        self.analysis_repo = AnalysisRepository(db)

    def analyze_pending_tracks(self, limit=5, force=False):
        """Finds tracks that haven't been analyzed yet and processes them"""
        print(f"🔍 Looking for up to {limit} tracks to analyze...")
        
        # In a real app, you'd filter for tracks where AnalysisSource is missing.
        # For now, we just grab all tracks to test the loop.
        tracks = self.db.query(Track).limit(limit).all() 
        
        for track in tracks:
            # Check if already analyzed to save time
            existing = self.analysis_repo.get_latest_by_track(track.id, "librosa_v1")
            if existing and not force:
                print(f"⏭️  Skipping {track.title} (Already analyzed)")
                continue

            print(f"🔬 Analyzing: {track.title}...")
            try:
                self._process_track(track)
            except Exception as e:
                print(f"❌ Failed on {track.title}: {e}")

    def _process_track(self, track):
        # A. Find & Download Audio
        search_query = f"{track.title} {track.artist_name} audio"
        file_path = self._download_audio(search_query, str(track.id))
        
        if not file_path:
            print(f"⚠️  Could not download audio for {track.title}")
            return

        # B. Analyze with Librosa
        try:
            results = self._analyze_audio(file_path)
            
            # C. Save to DB
            self.analysis_repo.add_analysis(
                track_id=track.id,
                source_type="librosa_v1",
                data=results
            )
            print(f"✅ Saved Analysis: BPM={results['bpm']:.1f}")
            
        finally:
            # D. Cleanup (CRITICAL: Always delete the file)
            if os.path.exists(file_path):
                os.remove(file_path)

    def _download_audio(self, query, track_id):
        # yt-dlp options to get a small audio file fast
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': f'{TEMP_DIR}/{track_id}.%(ext)s',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '128', # Low quality is fine for BPM
            }],
            'quiet': True,
            'noplaylist': True
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                ydl.extract_info(f"ytsearch1:{query}", download=True)
                # Find the file (extension might vary)
                files = glob.glob(f"{TEMP_DIR}/{track_id}.mp3")
                return files[0] if files else None
            except Exception as e:
                print(f"Download Error: {e}")
                return None

    def _analyze_audio(self, file_path):
        # 1. Load Audio
        y, sr = librosa.load(file_path, offset=10, duration=45)
        
        # 2. Onset Envelope (Normalized 0 to 1)
        # This makes the volume independent of the recording level
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        onset_env = librosa.util.normalize(onset_env) 
        
        # 3. Detect BPM
        tempo, beat_frames = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
        if isinstance(tempo, np.ndarray):
            tempo = tempo[0]

        # 4. Calculate Pulse Clarity (The "Stomp Factor")
        # We look at the "contrast" of the onset envelope.
        # High variance = distinct hits (Schottis). Low variance = smooth (Polska/Vals).
        pulse_clarity = onset_env.var() # Variance is a robust proxy for clarity on normalized data

        return {
            "bpm": float(tempo),
            "pulse_clarity": float(pulse_clarity),
            "duration_analyzed": 45
        }