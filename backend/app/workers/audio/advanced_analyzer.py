
import librosa
import numpy as np
import madmom
import essentia.standard as es
from app.repository.analysis import AnalysisRepository
from app.core.models import Track
from.fetcher import AudioFetcher

class AdvancedAudioAnalyzer:
    def __init__(self, db_session):
        self.db = db_session
        self.repo = AnalysisRepository(db_session)
        self.fetcher = AudioFetcher()
        
        # Initialize ML Models (Load once to save overhead)
        self.proc_beat = madmom.features.beats.RNNDownBeatProcessor()
        # Assume 3/4 and 4/4 are most common options for finding the '1'
        self.proc_decode = madmom.features.beats.DBNDownBeatTrackingProcessor(beats_per_bar=[1, 2], fps=100)

    def process_track(self, track: Track):
        # 1. Fetch
        query = f"{track.title} {track.artist_name} audio"
        file_path = self.fetcher.fetch_track_audio(str(track.id), query)
        
        if not file_path:
            print(f"Skipping {track.title}: Audio not found")
            return

        try:
            # 2. Analyze
            analysis_data = self._analyze_file(file_path)
            
            # 3. Save
            self.repo.add_analysis(
                track_id=track.id,
                source_type="hybrid_ml_v1",
                data=analysis_data
            )
            print(f"✅ Analyzed {track.title}: {analysis_data['meter']} @ {analysis_data['tempo_bpm']:.1f} BPM")

        except Exception as e:
            print(f"❌ Error analyzing {track.title}: {e}")
        finally:
            # 4. Cleanup
            self.fetcher.cleanup(str(track.id))

    def _analyze_file(self, file_path):
        """Core hybrid analysis logic"""
        
        # --- A. Madmom (Rhythm & Meter) ---
        # act = activations (probabilities of beat/downbeat at every frame)
        act = self.proc_beat(file_path) 
        # beat_info columns: [time, beat_number]
        beat_info = self.proc_decode(act) 
        
        # Calculate Asymmetry (The "Polska" Detector)
        asymmetry_score, meter, avg_ratios = self._calculate_rhythm_metrics(beat_info)
        
        # Calculate Raw BPM from Madmom beats
        if len(beat_info) > 1:
            intervals = np.diff(beat_info[:, 0])
            raw_bpm = 60.0 / np.median(intervals)
        else:
            raw_bpm = 0

        # --- B. Essentia (Style & Timbre) ---
        # Load audio for Essentia
        loader = es.MonoLoader(filename=file_path, sampleRate=44100)
        audio = loader()
        
        # Danceability (DFA - Detrended Fluctuation Analysis)
        # High DFA (>1.0) often implies steady pop/schottis. Low DFA often implies Polska/Asymmetry.
        danceability, _ = es.Danceability()(audio)
        
        # Energy/Intensity
        energy = es.Energy()(audio)

        return {
            "tempo_bpm": float(raw_bpm),
            "meter": meter,
            "asymmetry_score": float(asymmetry_score), # 0.0 = perfect evenness, >0.05 = lilt
            "beat_ratios": avg_ratios, # e.g., [0.28, 0.38, 0.33]
            "danceability": float(danceability),
            "energy": float(energy)
        }

    def _calculate_rhythm_metrics(self, beat_info):
        """
        Determines if beats are uneven (Polska) or even (Vals).
        """
        beat_nums = beat_info[:, 1] # The 1, 2, 3, 1, 2... sequence
        times = beat_info[:, 0]
        
        # Guess Meter
        max_beat = int(np.max(beat_nums)) if len(beat_nums) > 0 else 0
        meter = f"{max_beat}/4"
        
        asymmetry_score = 0.0
        avg_ratios =

        if max_beat == 3:
            # Calculate duration of Beat 1, Beat 2, Beat 3
            triplets =
            for i in range(len(beat_nums) - 3):
                if beat_nums[i] == 1 and beat_nums[i+1] == 2 and beat_nums[i+2] == 3:
                    d1 = times[i+1] - times[i]
                    d2 = times[i+2] - times[i+1]
                    d3 = times[i+3] - times[i+2]
                    total = d1 + d2 + d3
                    if total > 0:
                        triplets.append([d1/total, d2/total, d3/total])
            
            if triplets:
                avg_ratios = np.mean(triplets, axis=0).tolist()
                # Calculate deviation from perfect [0.33, 0.33, 0.33]
                # High deviation = Asymmetric Polska. Low deviation = Vals/Hambo.
                asymmetry_score = np.sum(np.abs(np.array(avg_ratios) - 0.333))
        
        return asymmetry_score, meter, avg_ratios