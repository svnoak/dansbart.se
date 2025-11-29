import librosa
import numpy as np

def calculate_swing_ratio(file_path, beat_times):
    """
    Calculates sub-beat swing using Librosa onsets.
    """
    # Load separate instance for librosa (optimized duration)
    y, sr = librosa.load(file_path, sr=22050, duration=30)
    onsets = librosa.onset.onset_detect(y=y, sr=sr, units='time', backtrack=True)
    
    if len(beat_times) < 2: return 1.0
    
    ratios = []
    for i in range(len(beat_times) - 1):
        start = beat_times[i]
        end = beat_times[i+1]
        duration = end - start
        
        candidates = [o for o in onsets if (start + duration*0.2) < o < (end - duration*0.2)]
        
        if candidates:
            mid_point = min(candidates, key=lambda x: abs(x - (start + (duration / 2))))
            first_half = mid_point - start
            second_half = end - mid_point
            if second_half > 0.001:
                ratios.append(first_half / second_half)
    
    if not ratios: return 1.0
    return float(np.median(ratios))