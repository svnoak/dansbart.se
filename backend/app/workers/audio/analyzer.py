import librosa
import numpy as np
import madmom
import madmom.features.downbeats
import essentia.standard as es
import traceback
import os

# ==========================================
# 1. SHARED CONFIGURATION & CONSTANTS
# ==========================================

# Maps metadata keywords to forced Meter (Beats per Bar)
METER_HINTS = {
    # Ternary (3/4)
    "hambo": 3, "hamburska": 3, 
    "polska": 3, "pols": 3, "springlek": 3, "bondpolska": 3,
    "slängpolska": 3, "släng": 3,
    "vals": 3, "waltz": 3, "walz": 3, "hoppvals": 3,
    "mazurka": 3, "masurka": 3,
    
    # Binary (2/4 or 4/4)
    # We allow both 2 and 4 to let the beat tracker find the natural pulse,
    # but we will normalize this in the classifier.
    "schottis": [2, 4], "reinländer": [2, 4], "tyskpolka": [2, 4],
    "engelska": [2, 4], "reel": [2, 4], "anglais": [2, 4],
    "snoa": [2, 4], "gånglåt": [2, 4], "marsch": [2, 4],
    "polka": [2, 4], "galopp": [2, 4], "polkett": [2, 4],
}

# ==========================================
# 2. ANALYZER (Feature Extraction)
# ==========================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 1. The Backbone (Audio -> Embeddings)
MODEL_BACKBONE = os.path.join(BASE_DIR, "models", "msd-musicnn-1.pb")
# 2. The Head (Embeddings -> Voice/Inst Probability)
MODEL_VOICE = os.path.join(BASE_DIR, "models", "voice_instrumental-msd-musicnn-1.pb")

class AudioAnalyzer:
    def __init__(self):
        print("🧠 Loading Analysis Models...")
        self.proc_beat = madmom.features.downbeats.RNNDownBeatProcessor()
        
        try:
            # --- LOADER 1: The Backbone (MusiCNN) ---
            # Extracts high-level features (embeddings) from raw audio
            self.tf_embeddings = es.TensorflowPredictMusiCNN(
                graphFilename=MODEL_BACKBONE,
                output="model/dense/BiasAdd" # The standard embedding layer node
            )

            # --- LOADER 2: The Classifier (Voice vs Instrumental) ---
            self.tf_voice_classifier = es.TensorflowPredict(
                graphFilename=MODEL_VOICE,
                inputs=["model/Placeholder"],
                outputs=["model/Softmax"] 
            )
            print("   ✅ Voice detection pipeline loaded.")
        except Exception as e:
            print(f"   ⚠️ Voice model failed to load: {e}")
            self.tf_embeddings = None
            self.tf_voice_classifier = None

    def analyze_file(self, file_path: str, metadata_context: str = "") -> dict:
        """
        Main entry point. Analyzes audio and returns a flat dictionary of metrics.
        """
        try:
            # --- 1. CONFIGURATION ---
            beats_hint = self._get_meter_hint(metadata_context)
            
            # --- 2. RHYTHM ANALYSIS (Madmom) ---
            act = self.proc_beat(file_path)
            
            transition_lambda = 20 if beats_hint == 3 else 100
            allowed_beats = beats_hint if beats_hint else [2, 3, 4]
            
            proc_decode = madmom.features.downbeats.DBNDownBeatTrackingProcessor(
                beats_per_bar=allowed_beats, 
                fps=100,
                transition_lambda=transition_lambda
            )
            beat_info = proc_decode(act) 

            # --- 3. TIMING ANALYSIS (Librosa) ---
            y, sr = librosa.load(file_path, sr=22050, duration=30)
            onsets = librosa.onset.onset_detect(y=y, sr=sr, units='time', backtrack=True)

            asym, meter, ratios = self._calculate_rhythm_metrics(beat_info, onsets)
            swing = self._calculate_swing_ratio(beat_info, onsets)
            
            raw_bpm = 0.0
            if len(beat_info) > 1:
                intervals = np.diff(beat_info[:, 0])
                if len(intervals) > 0:
                    raw_bpm = 60.0 / np.median(intervals)

            # --- 4. SIGNAL ANALYSIS (Essentia) ---
            loader_std = es.MonoLoader(filename=file_path, sampleRate=44100)
            audio_std = loader_std()

            danceability_out = es.Danceability()(audio_std)
            energy_out = es.Energy()(audio_std)
            onset_rate_out = es.OnsetRate()(audio_std)

            # --- 5. VOICE DETECTION ---
            vocal_data = self._analyze_vocal_presence(audio_std)

            # --- 5. RETURN ---
            return {
                "tempo_bpm": self._to_float(raw_bpm),
                "meter": meter,
                "asymmetry_score": self._to_float(asym),
                "swing_ratio": self._to_float(swing),
                "danceability": self._to_float(danceability_out),
                "energy": self._to_float(energy_out),
                "onset_rate": self._to_float(onset_rate_out),
                "melody_confidence": vocal_data['confidence'],
                "is_likely_instrumental": vocal_data['is_instrumental']
            }

        except Exception as e:
            print(f"❌ Analysis Error for {file_path}: {e}")
            traceback.print_exc()
            return None
        
    def _to_float(self, value):
        """
        Robustly converts inputs to a single float.
        Handles: Scalars, NumPy 0-d arrays, Lists, Tuples (takes first index).
        """
        try:
            # Case 1: Tuple/List (Essentia often returns (value, probability))
            if isinstance(value, (list, tuple)):
                if len(value) > 0:
                    return float(value[0])
                return 0.0
            
            # Case 2: NumPy Array
            if hasattr(value, 'item'):
                return float(value.item())
                
            # Case 3: Standard Number
            return float(value)
        except Exception:
            return 0.0

    def _get_meter_hint(self, text: str):
        text = text.lower()
        for keyword, beats in METER_HINTS.items():
            if keyword in text: return beats
        return None

    def _analyze_file(self, file_path, beats_hint=None):
        # --- A. Madmom (Rhythm & Meter) ---
        act = self.proc_beat(file_path) 
        
        allowed_beats = beats_hint if beats_hint else [2,3,4]
        
        # Keep the dynamic stiffness
        if beats_hint == 3:
            transition_lambda = 20 
        else:
            transition_lambda = 100
        
        proc_decode = madmom.features.downbeats.DBNDownBeatTrackingProcessor(
            beats_per_bar=allowed_beats, 
            fps=100,
            transition_lambda=transition_lambda
        )
        
        beat_info = proc_decode(act) 
        
        # --- B. Load Onsets with BACKTRACKING ---
        # Backtrack=True moves the timestamp to the START of the sound, not the peak volume.
        # This improves timing accuracy significantly.
        y, sr = librosa.load(file_path, sr=22050, duration=30)
        onsets = librosa.onset.onset_detect(y=y, sr=sr, units='time', backtrack=True)

        # --- C. Custom Metrics ---
        asymmetry_score, meter, avg_beat_ratios = self._calculate_rhythm_metrics(beat_info, onsets)
        swing_ratio = self._calculate_swing_ratio(beat_info, onsets)

        if len(beat_info) > 1:
            intervals = np.diff(beat_info[:, 0])
            raw_bpm = 60.0 / np.median(intervals)
        else:
            raw_bpm = 0

        # --- D. Essentia ---
        loader = es.MonoLoader(filename=file_path, sampleRate=44100)
        audio = loader()
        
        danceability_res = es.Danceability()(audio)
        danceability = danceability_res[0] if isinstance(danceability_res, tuple) else danceability_res
        
        energy = es.Energy()(audio)
        onset_res = es.OnsetRate()(audio)
        onset_rate = onset_res[0] if isinstance(onset_res, tuple) else onset_res

        return {
            "tempo_bpm": self._safe_float(raw_bpm),
            "meter": meter,
            "asymmetry_score": self._safe_float(asymmetry_score),
            "beat_ratios": avg_beat_ratios, 
            "swing_ratio": self._safe_float(swing_ratio),
            "danceability": self._safe_float(danceability),
            "energy": self._safe_float(energy),
            "onset_rate": self._safe_float(onset_rate)
        }

    def _safe_float(self, value):
        try:
            if hasattr(value, 'item'): return float(value.item())
            if isinstance(value, (list, tuple, np.ndarray)):
                if len(value) == 1: return float(value[0])
                if len(value) == 0: return 0.0
                return float(np.mean(value))
            return float(value)
        except Exception:
            return 0.0

    def _calculate_rhythm_metrics(self, beat_info, onsets):
        """
        Calculates asymmetry. 
        Attempt 3: Wide Window (0.25s) with Debugging.
        """
        if len(beat_info) == 0:
            return 0.0, "0/4", []

        beat_nums = beat_info[:, 1]
        grid_times = beat_info[:, 0]
        
        # --- 1. SNAP LOGIC (Widened to 0.25s) ---
        real_times = []
        for t in grid_times:
            # Widen window to 250ms (0.25s) to catch loose beats
            nearby = [o for o in onsets if abs(o - t) < 0.25]
            if nearby:
                closest = min(nearby, key=lambda x: abs(x - t))
                real_times.append(closest)
            else:
                real_times.append(None)
        
        max_beat = int(np.max(beat_nums)) if len(beat_nums) > 0 else 0
        meter = f"{max_beat}/4"
        
        asymmetry_score = 0.0
        avg_ratios = []

        # --- 2. CALCULATE RATIOS ---
        if max_beat == 3 and len(real_times) > 3:
            triplets = []
            limit = min(len(beat_nums), len(real_times))
            
            for i in range(limit - 3):
                # Check for sequence 1-2-3
                if beat_nums[i] == 1 and beat_nums[i+1] == 2 and beat_nums[i+2] == 3:
                    
                    t1, t2, t3, t4 = real_times[i], real_times[i+1], real_times[i+2], real_times[i+3]

                    # Strict check: All beats must exist
                    if t1 is not None and t2 is not None and t3 is not None and t4 is not None:
                        d1 = t2 - t1
                        d2 = t3 - t2
                        d3 = t4 - t3
                        
                        total = d1 + d2 + d3
                        if total > 0:
                            triplets.append([d1/total, d2/total, d3/total])
            
            # --- DEBUG PRINT ---
            # This will show up in your logs so we know if we are finding ANYTHING
            print(f"   [DEBUG] Found {len(triplets)} valid measures out of {len(beat_nums)//3} total.")

            if triplets:
                avg_ratios = np.mean(triplets, axis=0).tolist()
                asymmetry_score = np.sum(np.abs(np.array(avg_ratios) - 0.333))
        
        return asymmetry_score, meter, avg_ratios

    def _calculate_swing_ratio(self, beat_info, onsets):
        """
        Calculates swing using pre-loaded onsets.
        """
        if len(beat_info) < 2: return 1.0
        
        ratios = []
        for i in range(len(beat_info) - 1):
            start = beat_info[i, 0]
            end = beat_info[i+1, 0]
            duration = end - start
            
            # Filter for onsets in the middle 60% of the beat
            candidates = [o for o in onsets if (start + duration*0.2) < o < (end - duration*0.2)]
            
            if candidates:
                # Pick the candidate closest to the geometric center
                mid_point = min(candidates, key=lambda x: abs(x - (start + (duration / 2))))
                first_half = mid_point - start
                second_half = end - mid_point
                
                if second_half > 0.001:
                    ratios.append(first_half / second_half)
        
        if not ratios: return 1.0
        return float(np.median(ratios).item())

    def _analyze_vocal_presence(self, audio):
        """
        Estimates if there is a dominant voice/melody line.
        Returns a dict with 'confidence' score and boolean flag.
        """
        # PitchMelodia extracts the dominant melody pitch curve
        # hopSize=128 gives high resolution
        run_melodia = es.PredominantPitchMelodia(frameSize=2048, hopSize=128)
        pitch, confidence = run_melodia(audio)

        # 1. Filter out silence/noise (confidence < 0.1)
        valid_indices = confidence > 0.1
        if np.sum(valid_indices) == 0:
            return {"confidence": 0.0, "is_instrumental": True}

        valid_pitch = pitch[valid_indices]
        valid_confidence = confidence[valid_indices]

        # 2. Vocal Range Filtering (approx 100Hz to 1000Hz)
        # Violins go higher, Bass goes lower.
        # If the majority of the melody is within human vocal range, it increases likelihood.
        in_vocal_range = (valid_pitch > 80) & (valid_pitch < 1000)
        
        # Calculate scores
        avg_confidence = np.mean(valid_confidence)
        
        # Calculate how much of the "Melody" is in vocal range
        vocal_range_ratio = np.sum(in_vocal_range) / len(valid_pitch) if len(valid_pitch) > 0 else 0

        # Heuristic: 
        # Voice tracks usually have:
        # 1. High confidence (it's a single clear source)
        # 2. High percentage in vocal range
        # 3. Violins have high confidence but often go > 1000Hz (E5 is ~660Hz, but harmonics go high)
        
        is_instrumental = True
        
        # Tunable Thresholds
        if avg_confidence > 0.6 and vocal_range_ratio > 0.7:
            is_instrumental = False # Likely Voice
            
        return {
            "confidence": self._safe_float(avg_confidence),
            "vocal_range_ratio": self._safe_float(vocal_range_ratio),
            "is_instrumental": is_instrumental
        }