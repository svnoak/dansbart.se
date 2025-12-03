import numpy as np
import madmom
import madmom.features.downbeats

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

class RhythmExtractor:
    def __init__(self):
        self.proc_beat = madmom.features.downbeats.RNNDownBeatProcessor()

    def get_meter_hint(self, text: str):
        if not text: return None
        text = text.lower()
        for keyword, beats in METER_HINTS.items():
            if keyword in text: return beats
        return None

    def analyze_beats(self, file_path, metadata_context):
        """
        Runs Madmom to get the raw activation matrix and beat times.
        """
        act = self.proc_beat(file_path)
        beats_hint = self.get_meter_hint(metadata_context)
        
        proc_decode = madmom.features.downbeats.DBNDownBeatTrackingProcessor(
            beats_per_bar=beats_hint if beats_hint else [2, 3, 4], 
            fps=100,
            transition_lambda=20 if beats_hint == 3 else 100
        )
        beat_info = proc_decode(act)
        beat_times = beat_info[:, 0]
        return act, beat_times, beat_info

    def extract_folk_features(self, beat_times, act):
        """
        Returns [BPM, Fluctuation, Punchiness, Ratio1, Ratio2, Ratio3]
        """
        if len(beat_times) < 12: 
            return [0.0] * 6

        # 1. Calculate Beat Activations (Punchiness)
        # Convert time to frame indices (Madmom uses 100 fps)
        beat_indices = np.clip((beat_times * 100).astype(int), 0, len(act)-1)
        beat_activations = np.max(act[beat_indices], axis=1)
        activation_punchiness = np.std(beat_activations)

        # 2. Calculate Intervals & BPM
        intervals = np.diff(beat_times)
        tempo_fluctuation = np.var(intervals) 
        avg_bpm = 60.0 / np.mean(intervals)

        # 3. Calculate Ratios (The 3 Views Logic)
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

        # 4. Pick Best View (Highest Deviation)
        deviations = [np.std(v) for v in views]
        best_view_idx = np.argmax(deviations) 
        best_ratios = views[best_view_idx]

        return [
            avg_bpm,
            tempo_fluctuation,
            activation_punchiness,
            best_ratios[0], best_ratios[1], best_ratios[2]
        ]
    
    def get_bars(self, beat_info):
        """
        Extracts timestamps of the '1's (Downbeats).
        beat_info is a 2D numpy array: [[timestamp, beat_number], ...]
        """
        if len(beat_info) == 0:
            return []
            
        # Filter rows where beat_number (index 1) is 1.0
        # Return just the timestamp (index 0)
        downbeats = [row[0] for row in beat_info if row[1] == 1.0]
        return downbeats