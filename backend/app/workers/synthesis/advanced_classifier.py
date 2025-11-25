from app.repository.track import TrackRepository
from app.repository.analysis import AnalysisRepository

# Expanded Keywords based on your list
METADATA_MAP = {
    "hambo": "Hambo", "hamburska": "Hambo",
    "polska": "Polska", "springlek": "Polska", "pols": "Polska", "bondpolska": "Polska",
    "slängpolska": "Slängpolska", 
    "schottis": "Schottis", "reinländer": "Schottis", "engelska": "Schottis",
    "snoa": "Snoa", "gånglåt": "Snoa", "marsch": "Snoa",
    "polka": "Polka", "galopp": "Polka", "polkett": "Polka",
    "vals": "Vals", "hoppvals": "Vals"
}

class AdvancedDanceClassifier:
    def __init__(self, db_session):
        self.db = db_session
        self.track_repo = TrackRepository(db_session)
        self.analysis_repo = AnalysisRepository(db_session)

    def classify_pending(self):
        #... (Fetching logic similar to your code)...
        # Assume we have 'track' and 'analysis' (hybrid_ml_v1)
        pass

    def _classify_single_track(self, track, analysis_data):
        """
        Returns a dict of {Style: Score} and the effective BPM
        """
        scores = {k: 0.0 for k in set(METADATA_MAP.values())}
        
        # Feature Unpacking
        bpm = analysis_data.get('tempo_bpm', 0)
        meter = analysis_data.get('meter', '4/4')
        asymmetry = analysis_data.get('asymmetry_score', 0)
        danceability = analysis_data.get('danceability', 0)
        
        # --- SIGNAL 1: Metadata (Weight: 1.0 - Very High) ---
        meta_style = self._check_metadata(track)
        if meta_style:
            scores[meta_style] += 1.0

        # --- SIGNAL 2: Audio Heuristics (Weight: 0.5 - Validator) ---
        
        if meter == "3/4":
            # Distinguishing the 3/4 family
            
            # Hambo: Stable, usually 100-120 BPM, Low-Medium Asymmetry
            if 95 <= bpm <= 130: scores['Hambo'] += 0.3
            if asymmetry < 0.15: scores['Hambo'] += 0.2

            # Polska: High Asymmetry OR specific tempo
            if asymmetry > 0.15: scores['Polska'] += 0.6 # Strong indicator of asymmetry
            if 110 <= bpm <= 150: scores['Polska'] += 0.2
            
            # Vals: Very Low Asymmetry (Even beats), Fast or Slow
            if asymmetry < 0.05: scores['Vals'] += 0.5
            
        elif meter == "4/4" or meter == "2/4":
            # Distinguishing the 2/4 family
            
            # Schottis: "Danceable", 140-160 BPM
            if 135 <= bpm <= 165: scores += 0.4
            if danceability > 1.2: scores += 0.2
            
            # Snoa: Slower, smooth
            if 70 <= bpm <= 110: scores += 0.5
            if danceability < 1.0: scores += 0.2 # Less "punchy"
            
            # Polka: Fast, High Energy
            if bpm > 120 and danceability > 1.5: scores['Polka'] += 0.5

        # --- Result ---
        # Sort by score
        best_style = max(scores, key=scores.get)
        confidence = scores[best_style]
        
        # Calculate "Dancer's Tempo" (MPM vs BPM)
        effective_bpm = self._calculate_effective_bpm(best_style, bpm)
        
        return best_style, confidence, effective_bpm

    def _check_metadata(self, track):
        text = f"{track.title} {track.album_name}".lower()
        for key, style in METADATA_MAP.items():
            if key in text: return style
        return None

    def _calculate_effective_bpm(self, style, raw_bpm):
        """
        Goal B: Get the perceived tempo for dancers.
        """
        if style in ['Polska', 'Hambo']:
            # If raw BPM is counting beats (approx 300+), divide by 3
            # If raw BPM is counting 1 and 3 (approx 200), divide by 2
            # If raw BPM is 100-130, it's likely already Measures Per Minute (MPM)
            if raw_bpm > 200: return int(raw_bpm / 3)
            return int(raw_bpm)
            
        if style == 'Schottis':
            # Dancers want ~140-160 BPM. 
            # If detected as 70-80 (halftime), double it.
            if raw_bpm < 90: return int(raw_bpm * 2)
            
        return int(raw_bpm)