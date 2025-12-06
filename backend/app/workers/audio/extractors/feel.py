import numpy as np
import essentia.standard as es

def analyze_feel(audio: np.array, beat_times: np.array, swing: float) -> dict:
        """
        Determines the textural character: 'Smooth', 'Bouncy', 'Driving', 'Stumpy'.
        """
        try:
            # 1. Calculate 'Staccato Factor'
            # We look at the energy dip between beats.
            # High dip = Staccato (Jumpy). Low dip = Legato (Smooth).
            
            # Get the RMS envelope of the audio
            envelope = es.Envelope(attackTime=10, releaseTime=10)(audio)
            
            beat_peaks = []
            off_beat_dips = []
            
            # Check the signal around the detected beat times
            # (We skip the first and last beat to avoid index errors)
            for i in range(len(beat_times) - 1):
                # Convert time to sample index (sr=16000)
                start_idx = int(beat_times[i] * 16000)
                end_idx = int(beat_times[i+1] * 16000)
                
                if end_idx >= len(envelope): break
                
                segment = envelope[start_idx:end_idx]
                if len(segment) == 0: continue

                # The 'Beat' is usually the highest energy in the segment
                beat_peaks.append(np.max(segment))
                
                # The 'Off-beat' is the lowest energy in the segment
                off_beat_dips.append(np.min(segment))

            if not beat_peaks: return {"character": "Unknown", "bounciness": 0.0}

            avg_peak = np.mean(beat_peaks)
            avg_dip = np.mean(off_beat_dips)
            
            # Avoid division by zero
            if avg_dip < 0.0001: avg_dip = 0.0001
            
            # Ratio: How much louder is the beat than the space between?
            # 1.0 = Wall of sound (Pure drone)
            # 5.0+ = Very sharp staccato
            staccato_ratio = avg_peak / avg_dip

            # Normalize bounciness to roughly 0.0 - 1.0 range for easier UI handling
            # (Heuristic: Swing contributes 30%, Staccato 70%)
            # Staccato 1.0 -> 0.0, Staccato 4.0 -> 1.0
            norm_staccato = np.clip((staccato_ratio - 1.0) / 3.0, 0.0, 1.0)
            norm_swing = np.clip((swing - 1.0) / 0.5, 0.0, 1.0)
            
            bounciness = (norm_staccato * 0.7) + (norm_swing * 0.3)

            return {
                "articulation": float(staccato_ratio),
                "bounciness": float(bounciness)
            }

        except Exception as e:
            print(f"⚠️ Feel analysis failed: {e}")
            return {"articulation": 0.0, "bounciness": 0.0}