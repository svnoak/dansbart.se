from app.core.models import Track
from app.workers.audio.style_head import ClassificationHead
from app.core.music_theory import categorize_tempo, TEMPO_RANGES
import numpy as np

class StyleClassifier:
    """
    Multi-Label Classifier for Swedish Folk Music.
    
    Decision Priority:
    1. Metadata (Keywords in Title/Album) -> 98% Confidence
    2. AI Brain (Texture + Rhythmic Fingerprint) -> 85% Confidence
    3. Heuristics (Math on BPM, Swing, Ratios, Structure) -> 40-75% Confidence
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
        "snoa": "Snoa", "gånglåt": "Gånglåt", "marsch": "Gånglåt",
        "polka": "Polka", "polkett": "Polka",
        "engelska": "Engelska", "reel": "Engelska", "anglais": "Engelska"
    }

    # ====================================================
    # 2. MAIN ENTRY POINT
    # ====================================================

    def __init__(self):
        # Load the Brain (AI Model)
        self.head = ClassificationHead()

    def classify(self, track: Track, analysis: dict) -> list:
        """
        Returns a list of classifications (Primary + Secondaries).
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
                "reason": f"Metadata match: '{meta}'",
                "source": "metadata"
            }
        
        # --- 2. THE BRAIN: AI Suggestion ---
        # Check if the neural network recognizes the texture/rhythm fingerprint
        embedding = analysis.get("embedding")
        if embedding:
            ml_style, ml_confidence = self.head.predict(embedding)
            if ml_style != "Unknown":
                return {
                    "style": ml_style,
                    "confidence": ml_confidence,  # Real probability from model
                    "reason": "AI Groove Fingerprint",
                    "source": "ml"
                }

        # --- 3. FALLBACK: Heuristics (Math + Structure) ---
        # These are educated guesses - confidence reflects uncertainty
        
        meter = analysis.get("meter", "4/4")
        swing = analysis.get("swing_ratio", 1.0)
        bpm = analysis.get("tempo_bpm", 0)
        ratios = analysis.get("avg_beat_ratios", [0.33, 0.33, 0.33])
        punchiness = analysis.get("punchiness", 0)
        
        # New: Structural Analysis
        bars = analysis.get("bars", [])
        sections = analysis.get("sections", [])
        
        # Calculate Phrase Length
        avg_bars = 0
        if len(sections) > 1 and len(bars) > 0:
            lengths = []
            for i in range(len(sections) - 1):
                start = sections[i]
                end = sections[i+1]
                num_bars = len([b for b in bars if start <= b < end])
                if num_bars > 4: 
                    lengths.append(num_bars)
            if lengths:
                avg_bars = np.median(lengths)

        # Helper: Is it "Square" (8, 16, 32)?
        def is_square(val):
            if 7.0 <= val <= 9.0: return True   # 8 bars
            if 15.0 <= val <= 17.0: return True # 16 bars (A+A)
            if 30.0 <= val <= 34.0: return True # 32 bars
            return False
        
        # Helper: Build heuristic result with honest confidence
        # Heuristics max out at 0.50 to indicate they're guesses
        def heuristic_result(style, base_confidence, reason, bonus=0.0):
            # Cap heuristic confidence at 0.50 (50%) - these are guesses
            conf = min(0.50, base_confidence + bonus)
            return {
                "style": style, 
                "confidence": conf, 
                "reason": f"[Heuristic] {reason}",
                "source": "heuristic"
            }

        # === TERNARY METER (3/4) ===
        if "3/" in meter:
            # Hambo Logic: Long 1st beat + Square Structure
            if ratios[0] > 0.40:
                bonus = 0.10 if is_square(avg_bars) else 0.0
                reason = "Long 1st Beat" + (f" + Square ({int(avg_bars)} bars)" if is_square(avg_bars) else "")
                return heuristic_result("Hambo", 0.40, reason, bonus)
            
            # Vals Logic: Even beats
            if abs(ratios[0] - 0.33) < 0.05 and abs(ratios[1] - 0.33) < 0.05:
                return heuristic_result("Vals", 0.35, "Even Beat lengths")

            # Slängpolska Logic: Smooth
            if punchiness < 0.1: 
                return heuristic_result("Slängpolska", 0.35, "Smooth/Flowing Texture")

            # Polska Logic: Generic/Asymmetric (Often NOT square)
            return {
                "style": "Unknown", 
                "confidence": 0.0, 
                "reason": "Undetermined 3/4 Rhythm",
                "source": "heuristic"
            }

        # === BINARY METER (2/4 or 4/4) ===
        else:
            # Schottis Logic: High Swing + Square Structure
            if swing > 1.25:
                bonus = 0.10 if is_square(avg_bars) else 0.0
                reason = f"High Swing ({swing:.2f})" + (" + Square" if is_square(avg_bars) else "")
                return heuristic_result("Schottis", 0.40, reason, bonus)
            
            # Snoa Logic: Strict Tempo Range
            if 80 < bpm < 115:
                return heuristic_result("Snoa", 0.35, f"Walking Tempo ({int(bpm)} BPM)")
            
            # Polka Logic: Fast Tempo
            elif bpm >= 115:
                return heuristic_result("Polka", 0.30, f"Fast Tempo ({int(bpm)} BPM)")
            
            return {
                "style": "Unknown", 
                "confidence": 0.0, 
                "reason": "Undetermined Binary Rhythm",
                "source": "heuristic"
            }

    def _get_secondary_styles(self, primary, raw_bpm, analysis):
        """
        Determines compatible secondary styles.
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

        if style == "Snoa":
            add_secondary("Polka", "Compatible Rhythm (Slow Polka)")
        elif style == "Polka" and raw_bpm < 120:
            add_secondary("Snoa", "Compatible Rhythm (Fast Snoa)")

        if style == "Engelska":
            add_secondary("Polka", "Rhythmically Identical")

        if style == "Schottis" and swing < 1.4:
            add_secondary("Polka", "Low Swing Schottis", confidence_penalty=0.6)

        if style == "Vals":
            add_secondary("Polska", "Smooth 3/4", confidence_penalty=0.5)

        return secondaries

    # ====================================================
    # 4. HELPERS
    # ====================================================

    def _calculate_mpm(self, style: str, raw_bpm: float) -> tuple[float, int]:
        if not raw_bpm: return 1.0, 0
            
        multiplier = 1.0
        
        if style == "Hambo":
            if raw_bpm > 160: multiplier = 0.333
            elif raw_bpm < 70: multiplier = 2.0
        elif style in ["Polska", "Slängpolska"]:
            if raw_bpm > 180: multiplier = 0.5
        elif style == "Schottis":
            if raw_bpm > 200: multiplier = 0.5
            elif raw_bpm < 75: multiplier = 2.0
        elif style == "Vals":
            if raw_bpm > 100: multiplier = 0.333 

        effective_bpm = int(raw_bpm * multiplier)
        return multiplier, effective_bpm

    def _check_metadata(self, track):

        artist_names = []
        if track.artist_links:
            artist_names = [link.artist.name for link in track.artist_links]
        
        album_title = track.album.title if track.album else ""

        text = f"{track.title} {' '.join(artist_names)} {album_title}".lower()
        for keyword, style in self.KEYWORDS.items():
            if keyword in text:
                return style
        return None