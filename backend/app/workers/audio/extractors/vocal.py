def analyze_vocal_presence(audio):
    """
    Robust heuristic to detect vocals.
    """
    import essentia.standard as es
    import numpy as np
    
    run_melodia = es.PredominantPitchMelodia(frameSize=2048, hopSize=128)
    pitch, confidence = run_melodia(audio)

    valid_indices = confidence > 0.1
    if np.sum(valid_indices) == 0:
        return {"confidence": 0.0, "is_instrumental": True}

    valid_pitch = pitch[valid_indices]
    valid_confidence = confidence[valid_indices]

    in_vocal_range = (valid_pitch > 80) & (valid_pitch < 1000)
    
    avg_confidence = np.mean(valid_confidence)
    vocal_range_ratio = np.sum(in_vocal_range) / len(valid_pitch) if len(valid_pitch) > 0 else 0
    
    is_instrumental = True
    if avg_confidence > 0.65 and vocal_range_ratio > 0.75:
        is_instrumental = False
        
    return {
        "confidence": float(avg_confidence),
        "is_instrumental": is_instrumental
    }