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

# =========================================================
# POLSKA vs HAMBO SIGNATURE PROFILES
# =========================================================
# Polska: The characteristic "lift" - beat 2 or 3 is elongated
# creating an asymmetric, "hanging" feel. High micro-timing variance.
# 
# Hambo: Heavy downbeat (beat 1 is longest), square phrasing,
# more predictable/regular timing.
# =========================================================

TERNARY_PROFILES = {
    # Profile: (ratio1_range, ratio2_range, ratio3_range, timing_variance_threshold)
    # Swedish Polska often has beat 3 elongated (the "lift")
    "polska_beat3_lift": {
        "ratios": (0.28, 0.38, 0.28, 0.38, 0.30, 0.45),  # r1_min, r1_max, r2_min, r2_max, r3_min, r3_max
        "variance_min": 0.003,  # Polska has higher micro-timing variance
        "description": "Beat 3 elongated (hanging feel)"
    },
    # Some Polska variants have beat 2 elongated
    "polska_beat2_lift": {
        "ratios": (0.28, 0.36, 0.35, 0.45, 0.25, 0.35),
        "variance_min": 0.003,
        "description": "Beat 2 elongated"
    },
    # Hambo: Heavy first beat
    "hambo_classic": {
        "ratios": (0.38, 0.50, 0.22, 0.35, 0.22, 0.35),
        "variance_max": 0.008,  # Hambo is more metronomic
        "description": "Heavy downbeat, square feel"
    },
    # Vals: Very even
    "vals_even": {
        "ratios": (0.30, 0.36, 0.30, 0.36, 0.30, 0.36),
        "variance_max": 0.005,
        "description": "Even triplet feel"
    }
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
        Also calculates ternary confidence to detect Polska misclassified as binary.
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
        
        # NEW: Calculate ternary vs binary confidence
        # This helps detect Polska being misidentified as Polka
        ternary_confidence = self._calculate_ternary_confidence(act, beat_times)
        
        return act, beat_times, beat_info, ternary_confidence
    
    def _calculate_ternary_confidence(self, act, beat_times):
        """
        Analyzes the activation pattern to determine if the track is likely ternary (3/4).
        
        Polska often gets misdetected as binary because:
        1. The asymmetric beat ratios confuse the tracker
        2. The "lift" beat can be interpreted as a downbeat
        
        Returns a confidence score 0.0-1.0 for ternary meter.
        """
        if len(beat_times) < 12:
            return 0.5  # Not enough data
        
        intervals = np.diff(beat_times)
        if len(intervals) < 6:
            return 0.5
        
        # Strategy 1: Check if grouping by 3 produces more consistent patterns than grouping by 2/4
        
        # Group intervals by 3 and check variance
        ternary_groups = []
        for i in range(0, len(intervals) - 2, 3):
            group_sum = intervals[i] + intervals[i+1] + intervals[i+2]
            ternary_groups.append(group_sum)
        
        # Group intervals by 2 and check variance  
        binary_groups = []
        for i in range(0, len(intervals) - 1, 2):
            group_sum = intervals[i] + intervals[i+1]
            binary_groups.append(group_sum)
        
        # Group intervals by 4 and check variance
        quaternary_groups = []
        for i in range(0, len(intervals) - 3, 4):
            group_sum = intervals[i] + intervals[i+1] + intervals[i+2] + intervals[i+3]
            quaternary_groups.append(group_sum)
        
        # Lower variance = more consistent grouping = more likely correct meter
        ternary_var = np.var(ternary_groups) if len(ternary_groups) > 2 else float('inf')
        binary_var = np.var(binary_groups) if len(binary_groups) > 2 else float('inf')
        quaternary_var = np.var(quaternary_groups) if len(quaternary_groups) > 2 else float('inf')
        
        # Strategy 2: Check for characteristic polska ratio patterns
        # In polska, we expect uneven beat divisions within each bar
        ratio_asymmetry = []
        for i in range(0, len(intervals) - 2, 3):
            d1, d2, d3 = intervals[i], intervals[i+1], intervals[i+2]
            total = d1 + d2 + d3
            if total > 0:
                r1, r2, r3 = d1/total, d2/total, d3/total
                # How far from even (0.33, 0.33, 0.33)?
                asymmetry = abs(r1 - 0.33) + abs(r2 - 0.33) + abs(r3 - 0.33)
                ratio_asymmetry.append(asymmetry)
        
        avg_asymmetry = np.mean(ratio_asymmetry) if ratio_asymmetry else 0
        
        # Calculate ternary confidence
        ternary_confidence = 0.5  # Start neutral
        
        # If ternary grouping is most consistent, boost confidence
        min_var = min(ternary_var, binary_var, quaternary_var)
        if min_var == ternary_var and ternary_var < binary_var * 0.8:
            ternary_confidence += 0.25
        elif min_var == binary_var and binary_var < ternary_var * 0.5:
            ternary_confidence -= 0.20
        
        # Polska-like asymmetry boosts ternary confidence
        # (True binary music has even intervals, polska does not)
        if avg_asymmetry > 0.15:  # Significant asymmetry
            ternary_confidence += min(0.25, avg_asymmetry * 0.8)
        
        return np.clip(ternary_confidence, 0.0, 1.0)

    def extract_folk_features(self, beat_times, act):
        """
        Returns [BPM, Fluctuation, Punchiness, Ratio1, Ratio2, Ratio3, PolskaScore, HamboScore]
        
        The last two features are signature scores for distinguishing Polska vs Hambo.
        """
        if len(beat_times) < 12: 
            return [0.0] * 8

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
        view_variances = [[], [], []]  # NEW: Track per-triplet variance
        
        for offset in range(3):
            ratios_1, ratios_2, ratios_3 = [], [], []
            triplet_variances = []
            
            for i in range(offset, len(beat_times) - 3, 3):
                t1, t2, t3, t4 = beat_times[i:i+4]
                d1, d2, d3 = t2-t1, t3-t2, t4-t3
                total = d1 + d2 + d3
                if total > 0:
                    r1, r2, r3 = d1/total, d2/total, d3/total
                    ratios_1.append(r1)
                    ratios_2.append(r2)
                    ratios_3.append(r3)
                    # Variance within this triplet (how uneven is it?)
                    triplet_variances.append(np.var([r1, r2, r3]))
            
            if ratios_1:
                views[offset] = [np.mean(ratios_1), np.mean(ratios_2), np.mean(ratios_3)]
                view_variances[offset] = triplet_variances
            else:
                views[offset] = [0.33, 0.33, 0.33]
                view_variances[offset] = [0.0]

        # 4. Pick Best View (Highest Deviation)
        deviations = [np.std(v) for v in views]
        best_view_idx = np.argmax(deviations) 
        best_ratios = views[best_view_idx]
        best_variances = view_variances[best_view_idx]
        
        # 5. NEW: Calculate Polska vs Hambo signature scores
        polska_score, hambo_score = self._calculate_ternary_signatures(
            best_ratios, 
            best_variances,
            intervals,
            beat_activations
        )

        return [
            avg_bpm,
            tempo_fluctuation,
            activation_punchiness,
            best_ratios[0], best_ratios[1], best_ratios[2],
            polska_score,
            hambo_score
        ]
    
    def _calculate_ternary_signatures(self, ratios, triplet_variances, intervals, activations):
        """
        Calculates signature scores for Polska vs Hambo based on:
        1. Beat ratio patterns (where is the "weight"?)
        2. Micro-timing variance (Polska is more "loose", Hambo more "tight")
        3. Activation patterns (Hambo has strong downbeat accent)
        """
        r1, r2, r3 = ratios
        
        # --- MICRO-TIMING ANALYSIS ---
        # Polska has characteristic "rubato" - timing varies between triplets
        timing_variance = np.mean(triplet_variances) if triplet_variances else 0.0
        
        # Interval consistency (how regular is the beat spacing?)
        interval_cv = np.std(intervals) / np.mean(intervals) if np.mean(intervals) > 0 else 0.0
        
        # --- ACTIVATION PATTERN ANALYSIS ---
        # Group activations by beat position (1, 2, 3)
        if len(activations) >= 6:
            beat1_acts = activations[0::3]  # Every 3rd starting at 0
            beat2_acts = activations[1::3]
            beat3_acts = activations[2::3]
            
            avg_beat1 = np.mean(beat1_acts) if len(beat1_acts) > 0 else 0
            avg_beat2 = np.mean(beat2_acts) if len(beat2_acts) > 0 else 0
            avg_beat3 = np.mean(beat3_acts) if len(beat3_acts) > 0 else 0
            
            # Downbeat dominance ratio (Hambo has strong beat 1)
            total_act = avg_beat1 + avg_beat2 + avg_beat3
            downbeat_dominance = avg_beat1 / total_act if total_act > 0 else 0.33
        else:
            downbeat_dominance = 0.33
        
        # --- POLSKA SCORE ---
        # Polska characteristics:
        # 1. Beat 2 or Beat 3 is elongated (not beat 1)
        # 2. Higher micro-timing variance (rubato)
        # 3. Less downbeat dominance in activation
        
        polska_score = 0.0
        
        # Check for "lift" patterns
        beat3_lift = r3 > r1 and r3 > 0.34  # Beat 3 longest
        beat2_lift = r2 > r1 and r2 > 0.36  # Beat 2 longest
        
        if beat3_lift:
            polska_score += 0.35
        elif beat2_lift:
            polska_score += 0.30
        
        # Timing variance bonus (Polska is "looser")
        if timing_variance > 0.003:
            polska_score += min(0.25, timing_variance * 30)
        
        # Interval irregularity bonus
        if interval_cv > 0.08:
            polska_score += min(0.20, interval_cv)
        
        # Weak downbeat bonus
        if downbeat_dominance < 0.38:
            polska_score += 0.15
        
        # --- HAMBO SCORE ---
        # Hambo characteristics:
        # 1. Beat 1 is longest (heavy downbeat)
        # 2. Lower timing variance (metronomic)
        # 3. Strong downbeat activation
        
        hambo_score = 0.0
        
        # Heavy first beat
        if r1 > 0.38:
            hambo_score += 0.30 + min(0.20, (r1 - 0.38) * 2)
        
        # Tight timing bonus (Hambo is "stricter")
        if timing_variance < 0.004:
            hambo_score += 0.20
        
        # Regular intervals bonus
        if interval_cv < 0.06:
            hambo_score += 0.15
        
        # Strong downbeat accent
        if downbeat_dominance > 0.40:
            hambo_score += 0.20
        
        # Normalize to 0-1 range
        polska_score = min(1.0, polska_score)
        hambo_score = min(1.0, hambo_score)
        
        return polska_score, hambo_score
    
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