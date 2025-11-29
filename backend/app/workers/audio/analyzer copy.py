import librosa
import numpy as np
import madmom
import madmom.features.downbeats
import essentia
import essentia.standard as es
import traceback
import os
from .style_head import ClassificationHead

# ==========================================
# 1. CONFIGURATION
# ==========================================

METER_HINTS = {
    # Ternary (3/4)
    "hambo": 3, "hamburska": 3, "polska": 3, "pols": 3, 
    "springlek": 3, "bondpolska": 3, "slängpolska": 3, 
    "släng": 3, "vals": 3, "waltz": 3, "hoppvals": 3, 
    "mazurka": 3, "masurka": 3,
    # Binary (2/4 or 4/4)
    "schottis": [2, 4], "reinländer": [2, 4], "snoa": [2, 4], 
    "gånglåt": [2, 4], "marsch": [2, 4], "polka": [2, 4]
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_BACKBONE = os.path.join(BASE_DIR, "models", "msd-musicnn-1.pb")
MODEL_VOICE = os.path.join(BASE_DIR, "models", "voice_instrumental-msd-musicnn-1.pb")

class AudioAnalyzer:
    def __init__(self):
        print("🧠 Loading Analysis Models...")
        self.proc_beat = madmom.features.downbeats.RNNDownBeatProcessor()
        self.head = ClassificationHead()
        
        try:
            # 1. Backbone
            self.tf_embeddings = es.TensorflowPredictMusiCNN(
                graphFilename=MODEL_BACKBONE,
                output="model/dense/BiasAdd"
            )
            
            # 2. Voice Head (Standard config, NO inputShapes)
            self.tf_voice_classifier = es.TensorflowPredict(
                graphFilename=MODEL_VOICE,
                inputs=["model/Placeholder"],
                outputs=["model/Softmax"]
            )
            print("   ✅ AI Pipeline loaded.")
        except Exception as e:
            print(f"   ⚠️ AI Models failed to load: {e}")
            self.tf_embeddings = None

    def analyze_file(self, file_path: str, metadata_context: str = "") -> dict:
        try:
            # --- 1. LOAD AUDIO & TEXTURE ---
            loader = es.MonoLoader(filename=file_path, sampleRate=16000, resampleQuality=4)
            audio_16k = loader()
            
            # Texture (Embedding)
            raw_embeddings = self.tf_embeddings(audio_16k)
            avg_embedding = np.mean(raw_embeddings, axis=0) 

            # --- 2. VOICE DETECTION (Purely Descriptive) ---
            vocal_data = self._analyze_vocal_presence(audio_16k)

            # --- 3. RHYTHM ANALYSIS (Madmom) ---
            act = self.proc_beat(file_path)
            beats_hint = self._get_meter_hint(metadata_context)
            
            proc_decode = madmom.features.downbeats.DBNDownBeatTrackingProcessor(
                beats_per_bar=beats_hint if beats_hint else [2, 3, 4], 
                fps=100,
                transition_lambda=20 if beats_hint == 3 else 100
            )
            beat_info = proc_decode(act)
            beat_times = beat_info[:, 0]

            # --- 4. SWING ANALYSIS (Sub-beat) ---
            # We need Onsets to calculate swing within the beat
            # (Re-using your Librosa logic here, but optimized)
            y, sr = librosa.load(file_path, sr=22050, duration=30)
            onsets = librosa.onset.onset_detect(y=y, sr=sr, units='time', backtrack=True)
            
            swing_ratio = self._calculate_sub_beat_swing(beat_times, onsets)

            # --- 5. FOLK FEATURES (Measure Ratios & Energy) ---
            # Get beat strengths
            beat_indices = np.clip((beat_times * 100).astype(int), 0, len(act)-1)
            beat_activations = np.max(act[beat_indices], axis=1)

            folk_features = self._extract_folk_features(beat_times, beat_activations)
            
            # --- 6. PREDICT STYLE (The Brain) ---
            # Vector = [Embedding (200)] + [FolkFeatures (6)] + [Swing (1)]
            # We append Swing to the vector because it's vital for Schottis
            full_vector = np.concatenate([
                avg_embedding, 
                folk_features, 
                [swing_ratio] 
            ])
            
            predicted_style = self.style_brain.predict(full_vector)

            # --- 7. METRICS FOR DB ---
            intervals = np.diff(beat_times)
            raw_bpm = 60.0 / np.median(intervals) if len(intervals) > 0 else 0

            return {
                # AI Decisions
                "ml_suggested_style": predicted_style,
                "embedding": full_vector.tolist(), # Contains Texture + Rhythm + Swing
                
                # Descriptive Data
                "tempo_bpm": self._to_float(raw_bpm),
                "is_likely_instrumental": bool(prob_voice < 0.5), # Only for description
                "voice_probability": self._to_float(prob_voice),
                
                # Rhythmic Details
                "swing_ratio": self._to_float(swing_ratio), # Sub-beat
                "avg_beat_ratios": [self._to_float(x) for x in folk_features[3:6]], # Measure
                "punchiness": self._to_float(folk_features[2]),
                "meter": f"{int(np.max(beat_info[:,1])) if len(beat_info) > 0 else 0}/4"
            }

        except Exception as e:
            traceback.print_exc()
            return None
        
    def _analyze_vocal_presence(self, audio):
        """
        Robust heuristic to detect vocals without loading a 4D TF Graph.
        Uses PitchMelodia to find dominant melody lines in vocal range.
        """
        # Run Melodia (Standard Essentia Algo)
        run_melodia = es.PredominantPitchMelodia(frameSize=2048, hopSize=128)
        pitch, confidence = run_melodia(audio)

        # 1. Filter out silence/noise
        valid_indices = confidence > 0.1
        if np.sum(valid_indices) == 0:
            return {"confidence": 0.0, "is_instrumental": True}

        valid_pitch = pitch[valid_indices]
        valid_confidence = confidence[valid_indices]

        # 2. Vocal Range Check (100Hz - 1000Hz approx for main melody energy)
        in_vocal_range = (valid_pitch > 80) & (valid_pitch < 1000)
        
        # 3. Calculate metrics
        avg_confidence = np.mean(valid_confidence)
        vocal_range_ratio = np.sum(in_vocal_range) / len(valid_pitch) if len(valid_pitch) > 0 else 0
        
        # Heuristic: High confidence melody + inside vocal range = Voice
        # Tuned thresholds for Folk music (where Fiddles can mimic voice range)
        is_instrumental = True
        if avg_confidence > 0.65 and vocal_range_ratio > 0.75:
            is_instrumental = False # Likely Voice
            
        return {
            "confidence": self._to_float(avg_confidence),
            "is_instrumental": is_instrumental
        }

    def _calculate_sub_beat_swing(self, beat_times, onsets):
        """
        Calculates the ratio of the first sub-beat to the second.
        1.0 = Straight, >1.3 = Swung.
        """
        if len(beat_times) < 2: return 1.0
        
        ratios = []
        for i in range(len(beat_times) - 1):
            start = beat_times[i]
            end = beat_times[i+1]
            duration = end - start
            
            # Look for an onset in the middle 60% of the beat
            candidates = [o for o in onsets if (start + duration*0.2) < o < (end - duration*0.2)]
            
            if candidates:
                # Find the onset closest to the center
                mid_point = min(candidates, key=lambda x: abs(x - (start + (duration / 2))))
                first_half = mid_point - start
                second_half = end - mid_point
                
                if second_half > 0.001:
                    ratios.append(first_half / second_half)
        
        if not ratios: return 1.0
        return float(np.median(ratios))

    def _extract_folk_features(self, beat_times, beat_activations):
        """
        Returns [BPM, Fluctuation, Punchiness, Ratio1, Ratio2, Ratio3]
        """
        if len(beat_times) < 12: return [0.0] * 6

        intervals = np.diff(beat_times)
        tempo_fluctuation = np.var(intervals) 
        avg_bpm = 60.0 / np.mean(intervals)

        # Pattern Analysis (The 3 Views)
        views = [[], [], []]
        for offset in range(3):
            ratios_1, ratios_2, ratios_3 = [], [], []
            for i in range(offset, len(beat_times) - 3, 3):
                t1, t2, t3, t4 = beat_times[i:i+4]
                d1, d2, d3 = t2-t1, t3-t2, t4-t3
                total = d1 + d2 + d3
                if total > 0:
                    ratios_1.append(d1/total)
                    ratios_2.append(d2/total)
                    ratios_3.append(d3/total)
            if ratios_1:
                views[offset] = [np.mean(ratios_1), np.mean(ratios_2), np.mean(ratios_3)]
            else:
                views[offset] = [0.33, 0.33, 0.33]

        # Use view with highest asymmetry (Standard Deviation)
        deviations = [np.std(v) for v in views]
        best_view_idx = np.argmax(deviations) 
        best_ratios = views[best_view_idx]

        activation_punchiness = np.std(beat_activations)

        return [
            avg_bpm,
            tempo_fluctuation,
            activation_punchiness,
            best_ratios[0], best_ratios[1], best_ratios[2]
        ]

    def _to_float(self, value):
        try:
            if hasattr(value, 'item'): return float(value.item())
            if isinstance(value, (list, tuple)): return float(value[0]) if value else 0.0
            return float(value)
        except: return 0.0

    def _get_meter_hint(self, text: str):
        if not text: return None
        text = text.lower()
        for keyword, beats in METER_HINTS.items():
            if keyword in text: return beats
        return None