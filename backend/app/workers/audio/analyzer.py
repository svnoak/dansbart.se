import numpy as np
import essentia.standard as es
import traceback
import os
from .style_head import ClassificationHead
from .extractors.rhythm import RhythmExtractor
from .extractors.vocal import analyze_vocal_presence
from .extractors.swing import calculate_swing_ratio

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_BACKBONE = os.path.join(BASE_DIR, "models", "msd-musicnn-1.pb")

class AudioAnalyzer:
    def __init__(self):
        print("🧠 Loading Analysis Models...")
        self.rhythm_extractor = RhythmExtractor()
        self.head = ClassificationHead()
        
        try:
            self.tf_embeddings = es.TensorflowPredictMusiCNN(
                graphFilename=MODEL_BACKBONE,
                output="model/dense/BiasAdd"
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
            
            raw_embeddings = self.tf_embeddings(audio_16k)
            avg_embedding = np.mean(raw_embeddings, axis=0) 

            # --- 2. VOICE DETECTION ---
            vocal_data = analyze_vocal_presence(audio_16k)

            # --- 3. RHYTHM ANALYSIS ---
            # Call method on the instance, NOT the class
            act, beat_times, beat_info = self.rhythm_extractor.analyze_beats(file_path, metadata_context)
            folk_features = self.rhythm_extractor.extract_folk_features(beat_times, act)

            # --- 4. SWING ANALYSIS ---
            swing_ratio = calculate_swing_ratio(file_path, beat_times)

            # --- 5. PREDICT STYLE ---
            full_vector = np.concatenate([
                avg_embedding, 
                folk_features, 
                [swing_ratio] 
            ])
            
            predicted_style = self.head.predict(full_vector)

            # --- 6. RETURN METRICS ---
            raw_bpm = folk_features[0]

            return {
                "ml_suggested_style": predicted_style,
                "embedding": full_vector.tolist(),
                "tempo_bpm": self._to_float(raw_bpm),
                "is_likely_instrumental": vocal_data['is_instrumental'],
                "voice_probability": vocal_data['confidence'],
                "swing_ratio": self._to_float(swing_ratio),
                "avg_beat_ratios": [self._to_float(x) for x in folk_features[3:6]],
                "punchiness": self._to_float(folk_features[2]),
                "meter": f"{int(np.max(beat_info[:,1])) if len(beat_info) > 0 else 0}/4"
            }

        except Exception as e:
            print(f"❌ Analysis Error: {e}")
            traceback.print_exc()
            return None

    def _to_float(self, value):
        try:
            if hasattr(value, 'item'): return float(value.item())
            if isinstance(value, (list, tuple)): return float(value[0]) if value else 0.0
            return float(value)
        except: return 0.0