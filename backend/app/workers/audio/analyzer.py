import traceback
import os
from .extractors.vocal import analyze_vocal_presence
from .extractors.swing import calculate_swing_ratio
from .extractors.feel import analyze_feel
from .extractors.section_labeler import ABSectionLabeler

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_BACKBONE = os.path.join(BASE_DIR, "models", "msd-musicnn-1.pb")

class AudioAnalyzer:
    def __init__(self):
        print("🧠 Loading Analysis Models...")
        from .extractors.rhythm import RhythmExtractor
        from .extractors.structure import StructureExtractor
        from .style_head import ClassificationHead
        from .folk_authenticity import FolkAuthenticityDetector
        import essentia.standard as es
        
        self.rhythm_extractor = RhythmExtractor()
        self.structure_extractor = StructureExtractor()
        self.head = ClassificationHead()
        self.folk_detector = FolkAuthenticityDetector(manual_review_threshold=0.6)

        try:
            self.tf_embeddings = es.TensorflowPredictMusiCNN(
                graphFilename=MODEL_BACKBONE,
                output="model/dense/BiasAdd"
            )
            print("   ✅ AI Pipeline loaded.")
        except Exception as e:
            print(f"   ⚠️ AI Models failed to load: {e}")
            self.tf_embeddings = None


    def _extract_lightweight_features(self, audio) -> list:
        """
        Extracts robust, crash-proof structural proxies.
        These help the classifier distinguish between 'busy' styles (Polska) 
        and 'sparse' styles (Waltz) without running the full segmentation logic.
        """
        import essentia.standard as es

        try:
            # 1. Dynamics (Standard Deviation of RMS amplitude)
            # High deviation = lots of pauses/dynamic changes (Live Folk)
            # Low deviation = constant volume (Modern/Pop)
            rms = es.RMS()(audio)
            
            # 2. Density (Zero Crossing Rate)
            # High ZCR often correlates with percussive/noisy sounds
            zcr = es.ZeroCrossingRate()(audio)
            
            # 3. Simple Onset Density (How many events per second?)
            # We don't need perfect onset times, just the count/rate.
            # HFC is fast and good for percussive detection.
            onsets = es.OnsetDetection(method='hfc')(audio, audio) # passing audio twice is a quirk of some es versions, check docs or use complex spectral
            # If HFC is complex to setup, we can use a simpler proxy:
            # Just returning RMS and ZCR is often enough for a huge boost.
            
            return [float(rms), float(zcr)]
        except Exception:
            # Never let lightweight features crash the pipeline
            return [0.0, 0.0]

    def analyze_file(self, file_path: str, metadata_context: str = "") -> dict:
        import essentia.standard as es
        import numpy as np

        try:
            # --- 1. LOAD AUDIO & TEXTURE ---
            print(f"   [ANALYSIS] Load audio and texture...")
            loader = es.MonoLoader(filename=file_path, sampleRate=16000, resampleQuality=4)
            audio_16k = loader()
            
            print(f"   [ANALYSIS] Set embeddings...")
            if self.tf_embeddings is None:
                raise RuntimeError("MusiCNN embeddings model not loaded")
            raw_embeddings = self.tf_embeddings(audio_16k)
            avg_embedding = np.mean(raw_embeddings, axis=0) 

            # --- 2. VOICE DETECTION ---
            print(f"   [ANALYSIS] Doing voicedetection...")
            vocal_data = analyze_vocal_presence(audio_16k)

            # --- 3. RHYTHM ANALYSIS ---
            # Call method on the instance, NOT the class
            print(f"   [ANALYSIS] Doing rythm analysis...")
            act, beat_times, beat_info, ternary_confidence = self.rhythm_extractor.analyze_beats(file_path, metadata_context)
            folk_features = self.rhythm_extractor.extract_folk_features(beat_times, act)
            bars = self.rhythm_extractor.get_bars(beat_info)

            # --- 4. SWING ANALYSIS ---
            print(f"   [ANALYSIS] Doing swinganalysis...")
            swing_ratio = calculate_swing_ratio(file_path, beat_times)

            print(f"   [ANALYSIS] Analyzing feel/texture...")
            feel_data = analyze_feel(audio_16k, beat_times, swing_ratio)

            # --- 5. LIGHTWEIGHT STRUCTURAL PROXIES (NEW) ---
            # This is the "Safety Net" feature injection
            print(f"   [ANALYSIS] Extracting layout stats...")
            layout_stats = self._extract_lightweight_features(audio_16k)

            # --- 6. PREDICT STYLE ---
            print(f"   [ANALYSIS] Predict style...")
            full_vector = np.concatenate([
                avg_embedding, 
                folk_features, 
                [swing_ratio],
                layout_stats
            ])
            
            predicted_style, ml_confidence = self.head.predict(full_vector)

            # --- 7. FOLK AUTHENTICITY DETECTION ---
            print(f"   [ANALYSIS] Checking folk authenticity...")
            rms_value = layout_stats[0]
            zcr_value = layout_stats[1]
            folk_auth_result = self.folk_detector.analyze(
                rms_value=rms_value,
                zcr_value=zcr_value,
                swing_ratio=swing_ratio,
                articulation=feel_data['articulation'],
                bounciness=feel_data['bounciness'],
                voice_probability=vocal_data['confidence'],
                is_likely_instrumental=vocal_data['is_instrumental'],
                embedding=avg_embedding
            )

            # --- 8. DEEP STRUCTURE ANALYSIS --- 
            # Now we run the unstable heavy structure analysis, 
            # but we use the predicted style (which is now smarter) to guide it.
            print(f"   [ANALYSIS] Structure analysis (Hint: {predicted_style}, conf: {ml_confidence:.2f})...")
            
            try:
                sections = self.structure_extractor.extract_segments(
                    audio=audio_16k, 
                    bars=bars, 
                    style_hint=predicted_style
                )
                if sections is None: sections = []
            except Exception as e:
                print(f"   ⚠️ Structure analysis unstable: {e}")
                sections = [] # Fallback to empty, don't crash

            # Only label if we actually found sections
            if sections:
                section_labeler = ABSectionLabeler(sr=16000)
                section_labels = section_labeler.label_sections(audio_16k, sections)
            else:
                section_labels = []

            # --- 7. RETURN METRICS ---
            print(f"   [ANALYSIS] Returning metrics...")
            raw_bpm = folk_features[0]
            
            # Extract Polska/Hambo signature scores (indices 6 and 7)
            polska_score = folk_features[6] if len(folk_features) > 6 else 0.0
            hambo_score = folk_features[7] if len(folk_features) > 7 else 0.0

            return {
                "ml_suggested_style": predicted_style,
                "embedding": full_vector.tolist(),
                "tempo_bpm": self._to_float(raw_bpm),
                "is_likely_instrumental": vocal_data['is_instrumental'],
                "voice_probability": vocal_data['confidence'],
                "swing_ratio": self._to_float(swing_ratio),
                "articulation": feel_data['articulation'],
                "bounciness": feel_data['bounciness'],
                "avg_beat_ratios": [self._to_float(x) for x in folk_features[3:6]],
                "punchiness": self._to_float(folk_features[2]),
                "polska_score": self._to_float(polska_score),
                "hambo_score": self._to_float(hambo_score),
                "ternary_confidence": self._to_float(ternary_confidence),
                "meter": f"{int(np.max(beat_info[:,1])) if len(beat_info) > 0 else 0}/4",
                "bars": [self._to_float(b) for b in bars],
                "sections": [self._to_float(s) for s in sections],
                "section_labels": section_labels,
                "folk_authenticity_score": folk_auth_result['folk_authenticity_score'],
                "requires_manual_review": folk_auth_result['requires_manual_review'],
                "folk_authenticity_breakdown": folk_auth_result['confidence_breakdown'],
                "folk_authenticity_interpretation": folk_auth_result['interpretation']
            }

        except Exception as e:
            print(f"❌ Analysis Error: {e}")
            traceback.print_exc()
            return None
        

    def refine_structure(self, file_path: str, bars: list, new_style_hint: str) -> dict:
        """
        Lightweight pass: Re-runs ONLY the structure segmentation 
        using a confirmed style hint (e.g., 'Hambo').
        """
        import essentia.standard as es

        try:
            print(f"   [ANALYSIS] Refining structure with hint: {new_style_hint}...")
            
            # 1. Load Audio (Fast load, we don't need high-res resampling for just structure if not needed, 
            # but usually structure needs the full signal or at least 16k)
            loader = es.MonoLoader(filename=file_path, sampleRate=16000)
            audio_16k = loader()

            # 2. Run Extractor with the GROUND TRUTH hint
            sections = self.structure_extractor.extract_segments(
                audio=audio_16k, 
                bars=bars, 
                style_hint=new_style_hint
            )

            # 3. Label
            if sections:
                section_labeler = ABSectionLabeler(sr=16000)
                labels = section_labeler.label_sections(audio_16k, sections)
            else:
                labels = []

            return {
                "sections": [self._to_float(s) for s in sections],
                "section_labels": labels
            }
            
        except Exception as e:
            print(f"❌ Structure Refinement Error: {e}")
            return None

    def _to_float(self, value):
        try:
            if hasattr(value, 'item'): return float(value.item())
            if isinstance(value, (list, tuple)): return float(value[0]) if value else 0.0
            return float(value)
        except: return 0.0