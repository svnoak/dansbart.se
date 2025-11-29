from app.core.models import Track
from app.workers.audio.style_head import ClassificationHead
from app.core.music_theory import categorize_tempo, TEMPO_RANGES

class StyleClassifier:
    """
    Multi-Label Classifier for Swedish Folk Music.
    
    Decision Priority:
    1. Metadata (Keywords in Title/Album) -> 98% Confidence
    2. AI Brain (Texture + Rhythmic Fingerprint) -> 85% Confidence
    3. Heuristics (Math on BPM, Swing, Ratios) -> 40-75% Confidence
    """

    # ====================================================
    # 1. KNOWLEDGE BASE
    # ====================================================

    KEYWORDS = {
        # Ternary (3/4)
        "hambo": "Hambo", "hamburska": "Hambo", "hambor": "Hambo",
        "polska": "Polska", "bondpolska": "Polska", "springlek": "Polska", "pols": "Polska",
        "slängpolska": "Slängpolska", "släng": "Slängpolska",
        "mazurka": "Mazurka", "masurka": "Mazurka",
        "vals": "Vals", "waltz": "Vals", "brudvals": "Vals", "walz": "Vals",
        "menuett": "Menuett",
        
        # Binary (2/4, 4/4)
        "schottis": "Schottis", "reinländer": "Schottis", "reinlender": "Schottis",
        "rheinlender": "Schottis",
        "snoa": "Snoa", "gånglåt": "Snoa", "marsch": "Snoa",
        "polka": "Polka", "polkett": "Polka",
        "engelska": "Engelska", "reel": "Engelska", "anglais": "Engelska"
    }

    # ====================================================
    # 2. MAIN ENTRY POINT
    # ====================================================

    def __init__(self):
        # 2. LOAD THE BRAIN ON INIT
        # This ensures we are always using the latest .pkl file
        self.head = ClassificationHead()

    def classify(self, track: Track, analysis: dict) -> list:
        """
        Returns a list of classifications.
        """
        results = []
        raw_bpm = analysis.get("tempo_bpm", 0)
        
        # --- A. DETECT PRIMARY STYLE ---
        primary = self._get_primary_style(track, analysis)
        
        # Calculate Multiplier & Effective BPM (Normalization)
        primary['multiplier'], primary['effective_bpm'] = self._calculate_mpm(primary['style'], raw_bpm)
        primary['dance_tempo'] = categorize_tempo(primary['style'], primary['effective_bpm'])
        primary['type'] = 'Primary'
        
        results.append(primary)

        # --- B. ADD COMPATIBLE STYLES ---
        secondaries = self._get_secondary_styles(primary, raw_bpm, analysis)
        results.extend(secondaries)

        return results

    # ====================================================
    # 3. CORE LOGIC
    # ====================================================

    def _get_primary_style(self, track, analysis):
        """
        Decides the main style.
        """
        
        # --- 1. GOD RULE: Metadata ---
        # If the artist calls it a Hambo, it is a Hambo.
        meta = self._check_metadata(track)
        if meta: 
            return {
                "style": meta, 
                "confidence": 0.98, 
                "reason": f"Metadata match: '{meta}'"
            }
        
        # --- 2. THE BRAIN: AI Suggestion ---
        # This comes from the 'Classification heead' which learned from previous feedback
        embedding = analysis.get("embedding")
        
        if embedding:
            # Ask the loaded head for a prediction
            ml_style = self.head.predict(embedding)
            
            if ml_style != "Unknown":
                return {
                    "style": ml_style,
                    "confidence": 0.85, 
                    "reason": "AI Groove Fingerprint (v2)"
                }

        # --- 3. FALLBACK: Heuristics (Math) ---
        # If metadata is empty and AI is untrained, guess based on rhythm metrics.
        meter = analysis.get("meter", "4/4")
        swing = analysis.get("swing_ratio", 1.0)
        bpm = analysis.get("tempo_bpm", 0)
        ratios = analysis.get("avg_beat_ratios", [0.33, 0.33, 0.33]) # [Beat1, Beat2, Beat3]
        punchiness = analysis.get("punchiness", 0) # High = Stompy, Low = Smooth

        # === TERNARY METER (3/4) ===
        if "3/" in meter:
            # Logic: Hambo has a long Beat 1 (dotted) and short Beat 2
            if ratios[0] > 0.40:
                return {
                    "style": "Hambo",
                    "confidence": 0.70,
                    "reason": "Rhythm: Long 1st Beat (Hambo Ratio)"
                }
            
            # Logic: Vals is symmetrical
            if abs(ratios[0] - 0.33) < 0.05 and abs(ratios[1] - 0.33) < 0.05:
                return {
                    "style": "Vals",
                    "confidence": 0.60,
                    "reason": "Rhythm: Even Beat lengths"
                }

            # Logic: Slängpolska is smooth (low punchiness), Polska is punchier
            if punchiness < 0.1: # Threshold depends on normalization
                return {
                    "style": "Slängpolska",
                    "confidence": 0.65,
                    "reason": "Texture: Smooth/Flowing 16th notes"
                }

            # Default
            return {
                "style": "Polska", 
                "confidence": 0.50, 
                "reason": "Generic 3/4 Rhythm"
            }

        # === BINARY METER (2/4 or 4/4) ===
        else:
            # Logic: Schottis has high swing (dotted notes)
            if swing > 1.25:
                return {
                    "style": "Schottis", 
                    "confidence": 0.75, 
                    "reason": f"Binary Meter + High Swing ({swing:.2f})"
                }
            
            # Logic: Tempo distinction
            if 80 < bpm < 115:
                return {
                    "style": "Snoa", 
                    "confidence": 0.60, 
                    "reason": "Binary Meter + Walking Tempo"
                }
            elif bpm >= 115:
                return {
                    "style": "Polka", 
                    "confidence": 0.55, 
                    "reason": "Binary Meter + Fast Tempo"
                }
            
            return {
                "style": "Polka", 
                "confidence": 0.40, 
                "reason": "Generic Binary Rhythm"
            }

    def _get_secondary_styles(self, primary, raw_bpm, analysis):
        """
        Determines what ELSE you can dance to this track.
        """
        style = primary['style']
        base_conf = primary['confidence']
        swing = analysis.get("swing_ratio", 1.0)
        secondaries = []

        def add_secondary(new_style, reason, confidence_penalty=0.8):
            mult, eff = self._calculate_mpm(new_style, raw_bpm)
            secondaries.append({
                "style": new_style,
                "type": "Secondary",
                "confidence": base_conf * confidence_penalty,
                "reason": reason,
                "multiplier": mult,
                "effective_bpm": eff,
                "dance_tempo": categorize_tempo(new_style, eff)
            })

        # 1. Snoa <-> Polka
        if style == "Snoa":
            add_secondary("Polka", "Compatible Rhythm (Slow Polka)")
        elif style == "Polka" and raw_bpm < 120:
            add_secondary("Snoa", "Compatible Rhythm (Fast Snoa)")

        # 2. Engelska <-> Polka
        if style == "Engelska":
            add_secondary("Polka", "Rhythmically Identical")

        # 3. Schottis -> Polka (If straight enough)
        if style == "Schottis" and swing < 1.4:
            add_secondary("Polka", "Low Swing Schottis", confidence_penalty=0.6)

        # 4. Vals <-> Polska
        if style == "Vals":
            add_secondary("Polska", "Smooth 3/4", confidence_penalty=0.5)

        return secondaries

    # ====================================================
    # 4. HELPERS
    # ====================================================

    def _calculate_mpm(self, style: str, raw_bpm: float) -> tuple[float, int]:
        """
        Determines the correct multiplier to get a danceable BPM/MPM.
        """
        if not raw_bpm: return 1.0, 0
            
        multiplier = 1.0
        
        # Hambo: Usually counts in 3s. Standard is ~100-110 BPM.
        if style == "Hambo":
            if raw_bpm > 160: multiplier = 0.333
            elif raw_bpm < 70: multiplier = 2.0
        
        # Polska: Standard ~105-125 BPM.
        elif style in ["Polska", "Slängpolska"]:
            if raw_bpm > 180: multiplier = 0.5
        
        # Schottis: Steps are counted in 4s (~140-150 BPM).
        elif style == "Schottis":
            if raw_bpm > 200: multiplier = 0.5
            elif raw_bpm < 75: multiplier = 2.0
            
        # Vals: Measures Per Minute (MPM)
        elif style == "Vals":
            if raw_bpm > 100: multiplier = 0.333 

        effective_bpm = int(raw_bpm * multiplier)
        return multiplier, effective_bpm

    def _check_metadata(self, track):
        text = f"{track.title} {track.artist_name} {track.album_name or ''}".lower()
        for keyword, style in self.KEYWORDS.items():
            if keyword in text:
                return style
        return None