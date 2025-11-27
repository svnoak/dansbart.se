from app.core.models import Track

class StyleClassifier:
    """
    Multi-Label Classifier for Swedish Folk Music.
    
    1. Determines Primary Style (Metadata > Audio Analysis).
    2. Suggests Compatible Secondary Styles (e.g. Snoa -> Polka).
    3. Calculates 'Danceable' BPM (MPM) for dancers.
    4. Assigns Confidence Scores for human review.
    """

    # ====================================================
    # 1. KNOWLEDGE BASE
    # ====================================================

    # If these keywords appear in the title/album, we trust them 95%.
    KEYWORDS = {
        # Ternary (3/4)
        "hambo": "Hambo", "hamburska": "Hambo", "hambor": "Hambo",
        "polska": "Polska", "bondpolska": "Polska", "springlek": "Polska", "pols": "Polska",
        "slängpolska": "Slängpolska", "släng": "Slängpolska",
        "mazurka": "Mazurka",
        "vals": "Vals", "waltz": "Vals", "brudvals": "Vals", "walz": "Vals",
        "menuett": "Menuett",
        
        # Binary (2/4, 4/4)
        "schottis": "Schottis", "reinländer": "Schottis", "reinlender": "Schottis", "rheinlender": "Schottis",
        "snoa": "Snoa", "gånglåt": "Snoa", "marsch": "Snoa",
        "polka": "Polka", "polkett": "Polka",
        "engelska": "Engelska", "reel": "Engelska", "anglais": "Engelska"
    }

    # Used to categorize tempo description (Slow/Medium/Fast/Turbo)
    TEMPO_RANGES = {
        "Hambo":      (100, 115), 
        "Polska":     (105, 125), 
        "Slängpolska":(110, 125),
        "Vals":       (150, 200), # Viennese waltz tempo
        "Schottis":   (140, 160), 
        "Snoa":       (80, 110),
        "Polka":      (120, 150),
        "Engelska":   (110, 130),
        "Mazurka":    (130, 160)
    }

    # ====================================================
    # 2. MAIN ENTRY POINT
    # ====================================================

    def classify(self, track: Track, analysis: dict) -> list:
        """
        Returns a list of classifications.
        Example: [
            {'style': 'Snoa', 'type': 'Primary', 'confidence': 0.9, ...},
            {'style': 'Polka', 'type': 'Secondary', 'confidence': 0.6, ...}
        ]
        """
        results = []
        raw_bpm = analysis.get("tempo_bpm", 0)
        
        # --- A. DETECT PRIMARY STYLE ---
        primary = self._get_primary_style(track, analysis)
        
        # Calculate Multiplier & Effective BPM (Normalization)
        primary['multiplier'], primary['effective_bpm'] = self._calculate_mpm(primary['style'], raw_bpm)
        primary['dance_tempo'] = self._categorize_tempo(primary['style'], primary['effective_bpm'])
        primary['type'] = 'Primary'
        
        results.append(primary)

        # --- B. ADD COMPATIBLE STYLES ---
        # Pass the primary confidence so secondaries are always weighted lower
        secondaries = self._get_secondary_styles(primary, raw_bpm, analysis)
        results.extend(secondaries)

        return results

    # ====================================================
    # 3. CORE LOGIC
    # ====================================================

    def _get_primary_style(self, track, analysis):
        """
        Decides the main style based on Metadata (Best) or Audio (Fallback).
        """
        # 1. Metadata Check (The "God" Rule)
        meta = self._check_metadata(track)
        if meta: 
            return {
                "style": meta, 
                "confidence": 0.95, 
                "reason": f"Metadata match: '{meta}'"
            }
        
        # 2. Audio Analysis Fallback
        meter = analysis.get("meter", "4/4")     # e.g. "3/4"
        swing = analysis.get("swing_ratio", 1.0) # 1.0 = Straight, >1.2 = Swung
        density = analysis.get("onset_rate", 0)  # Notes per second
        bpm = analysis.get("tempo_bpm", 0)

        # === TERNARY METER (3/4) ===
        if "3/" in meter:
            # Rule: High Swing = Hambo or Mazurka
            if swing > 1.25:
                return {
                    "style": "Hambo", 
                    "confidence": 0.85, 
                    "reason": f"3/4 Meter + High Swing ({swing:.2f})"
                }
            
            # Rule: High Note Density + Straight = Slängpolska
            # (Stream of 16th notes usually results in density > 4.8)
            elif density > 4.8:
                return {
                    "style": "Slängpolska", 
                    "confidence": 0.80, 
                    "reason": f"High Note Density ({density:.1f}/s)"
                }
            
            # Rule: Smooth/Low Swing = Vals
            elif swing < 0.9:
                return {
                    "style": "Vals", 
                    "confidence": 0.60, 
                    "reason": f"3/4 Meter + Smooth Rhythm"
                }
            
            # Rule: Default to Polska
            else:
                return {
                    "style": "Polska", 
                    "confidence": 0.55, 
                    "reason": "Generic 3/4 Rhythm"
                }

        # === BINARY METER (2/4 or 4/4) ===
        else:
            # Rule: High Swing = Schottis
            if swing > 1.20:
                return {
                    "style": "Schottis", 
                    "confidence": 0.85, 
                    "reason": f"Binary Meter + Swung ({swing:.2f})"
                }
            
            # Rule: Straight Rhythm -> Check Tempo
            # Snoa is usually walking tempo (80-110)
            # Polka is usually faster (120+)
            if 80 < bpm < 115:
                return {
                    "style": "Snoa", 
                    "confidence": 0.65, 
                    "reason": "Binary Meter + Walking Tempo"
                }
            elif bpm >= 115:
                return {
                    "style": "Polka", 
                    "confidence": 0.60, 
                    "reason": "Binary Meter + Fast Tempo"
                }
            
            return {
                "style": "Polka", 
                "confidence": 0.50, 
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

        # Helper to add a secondary style easily
        def add_secondary(new_style, reason, confidence_penalty=0.8):
            mult, eff = self._calculate_mpm(new_style, raw_bpm)
            secondaries.append({
                "style": new_style,
                "type": "Secondary",
                "confidence": base_conf * confidence_penalty,
                "reason": reason,
                "multiplier": mult,
                "effective_bpm": eff,
                "dance_tempo": self._categorize_tempo(new_style, eff)
            })

        # --- LOGIC MATRIX ---

        # 1. Snoa <-> Polka
        if style == "Snoa":
            add_secondary("Polka", "Compatible Rhythm (Slow Polka)")
        elif style == "Polka" and raw_bpm < 120:
            add_secondary("Snoa", "Compatible Rhythm (Fast Snoa)")

        # 2. Engelska <-> Polka
        if style == "Engelska":
            add_secondary("Polka", "Rhythmically Identical")

        # 3. Schottis -> Polka (If straight enough)
        # Some Schottis are played very straight and work as Polka
        if style == "Schottis" and swing < 1.4:
            add_secondary("Polka", "Low Swing Schottis", confidence_penalty=0.6)

        # 4. Vals <-> Polska
        # A smooth Waltz can be danced as a smooth Polska
        if style == "Vals":
            add_secondary("Polska", "Smooth 3/4", confidence_penalty=0.5)

        return secondaries

    # ====================================================
    # 4. HELPERS (Normalization & Metadata)
    # ====================================================

    def _calculate_mpm(self, style: str, raw_bpm: float) -> tuple[float, int]:
        """
        Determines the correct multiplier to get a danceable BPM/MPM.
        This fixes double-time or half-time detection errors.
        """
        if not raw_bpm: 
            return 1.0, 0
            
        multiplier = 1.0
        
        # Hambo: Usually counts in 3s. Standard is ~100-110 BPM.
        if style == "Hambo":
            if raw_bpm > 160: multiplier = 0.333 # Beat tracker caught 8th notes (300bpm) -> measure (100bpm)
            elif raw_bpm < 70: multiplier = 2.0  # Beat tracker caught measures -> beats
        
        # Polska: Standard ~105-125 BPM.
        elif style in ["Polska", "Slängpolska"]:
            if raw_bpm > 180: multiplier = 0.5   # Double-time fix
        
        # Schottis: Steps are counted in 4s (~140-150 BPM).
        elif style == "Schottis":
            if raw_bpm > 200: multiplier = 0.5
            elif raw_bpm < 75: multiplier = 2.0
            
        # Vals: Dancers usually count measures (MPM). 
        # Standard Viennese is ~180 beats -> 60 MPM.
        elif style == "Vals":
            if raw_bpm > 100: multiplier = 0.333 # Return Measures Per Minute

        effective_bpm = int(raw_bpm * multiplier)
        return multiplier, effective_bpm

    def _categorize_tempo(self, style, bpm):
        """
        Returns 'Slow', 'Medium', 'Fast', or 'Turbo' based on the style.
        """
        if style not in self.TEMPO_RANGES:
            return "Medium"
        
        low, high = self.TEMPO_RANGES[style]
        
        if bpm < low: return "Slow"
        if low <= bpm <= high: return "Medium"
        if bpm > (high + 15): return "Turbo"
        return "Fast"

    def _check_metadata(self, track):
        """
        Scans Title, Artist, and Album for style keywords.
        """
        text = f"{track.title} {track.artist_name} {track.album_name or ''}".lower()
        
        # Check specific keywords
        for keyword, style in self.KEYWORDS.items():
            # Add spaces to prevent partial matches (e.g. "Polska" matching inside "Polskan")
            # Or just simple substring check is usually fine for this domain
            if keyword in text:
                return style
        return None