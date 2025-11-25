from sqlalchemy.orm import Session
from app.repository.track import TrackRepository
from app.repository.analysis import AnalysisRepository
from app.core.models import Track

# 1. The Knowledge Base (Keep this!)
STYLE_KEYWORDS = {
    "hambo": "Hambo",
    "hamburska": "Hambo",
    "polska": "Polska",
    "springlek": "Polska",
    "slängpolska": "Slängpolska", 
    "schottis": "Schottis",
    "reinländer": "Schottis",
    "reinlender": "Schottis",
    "Rheinlender": "Schottis",
    "Reinländer": "Schottis",
    "Skotsk": "Schottis",
    "snoa": "Snoa/Polka",
    "polka": "Snoa/Polka",
    "engelsk": "Engelska",
    "vals": "Vals",
    "wals": "Vals"
}

class DanceClassifier:
    def __init__(self, db: Session):
        self.db = db
        self.track_repo = TrackRepository(db)
        self.analysis_repo = AnalysisRepository(db)

    def classify_tracks(self, limit=50):
        print("🧠 Starting Classification...")
        
        # Optimization: Only fetch tracks that have audio analysis
        from app.core.models import AnalysisSource
        tracks = (self.db.query(Track)
                  .join(AnalysisSource)
                  .filter(AnalysisSource.source_type == 'librosa_v1')
                  .limit(limit)
                  .all())

        print(f"   Found {len(tracks)} analyzed tracks to process...")

        for track in tracks:
            # 1. Get Audio Data
            analysis = self.analysis_repo.get_latest_by_track(track.id, "librosa_v1")
            if not analysis: continue

            raw_bpm = analysis.raw_data.get("bpm", 0)
            pulse_clarity = analysis.raw_data.get("pulse_clarity", 0.0)
            
            # 2. Strategy A: Metadata (Strongest Signal)
            detected_style = self._infer_style_from_metadata(track)
            
            # 3. Strategy B: Playlist Context (Medium Signal)
            if not detected_style:
                detected_style = self._infer_style_from_context(track)

            # 4. Strategy C: Audio Heuristics (Fallback)
            if not detected_style:
                detected_style = self._infer_style_from_audio(raw_bpm, pulse_clarity)
                if detected_style:
                    print(f"🤖 AI Guessed '{track.title}' is {detected_style} (BPM: {raw_bpm:.0f}, Clarity: {pulse_clarity:.3f})")

            # 5. Finalize and Save
            if detected_style:
                # Optional: Validate against Ground Truth Profile
                # self._validate_against_profile(detected_style, raw_bpm) 
                
                if self._infer_style_from_metadata(track) == detected_style:
                     print(f"🎯 Identified '{track.title}' as {detected_style}")
                
                self._apply_style_logic(track, detected_style, raw_bpm, pulse_clarity)
            else:
                print(f"❓ Unknown style: '{track.title}' (BPM: {raw_bpm:.0f}, Clarity: {pulse_clarity:.3f})")

    def _infer_style_from_metadata(self, track):
        text = (track.title + " " + (track.artist_name) + " " + (track.album_name or "")).lower()
        for keyword, style in STYLE_KEYWORDS.items():
            if keyword in text: return style
        return None

    def _infer_style_from_context(self, track):
        """Checks if track is in a playlist named 'Hambo' etc."""
        contexts = [a for a in track.analysis_sources if a.source_type == 'playlist_context']
        for analysis in contexts:
            playlist_name = analysis.raw_data.get('playlist_name', '').lower()
            for keyword, style in STYLE_KEYWORDS.items():
                if keyword in playlist_name: return style
        return None

    def _infer_style_from_audio(self, bpm, clarity):
        """
        Guess style based on BPM and Clarity (Normalized 0.0 - 0.2).
        """
        # 1. The "Danger Zone" (100 - 115 BPM)
        # Hambo vs Slow Schottis vs Slängpolska
        if 100 <= bpm <= 118:
            if clarity > 0.035: 
                return "Schottis" # Stompy
            elif clarity < 0.015:
                return "Slängpolska" # Very smooth/flowing
            else:
                return "Hambo" # Standard lilt

        # 2. The Fast Zone (140 - 180 BPM)
        if 140 <= bpm <= 180:
            if clarity > 0.04:
                return "Schottis" # Fast, distinct hits
            else:
                return "Polska" # 16-dels polska (often muddy audio)

        # 3. The Walking Zone (80 - 100 BPM)
        if 80 <= bpm < 100:
            if clarity > 0.05:
                return "Polka" # Heavy beat (often half-time)
            else:
                return "Gånglåt" # Walking

        # 4. The Polska Zone (120 - 135 BPM)
        if 120 <= bpm < 140:
            return "Polska" # Typical Bondpolska tempo

        return None

    def _apply_style_logic(self, track, style, raw_bpm, clarity):
        """Applies multipliers and saves tags"""
        
        # Noise Filter: If clarity is near zero, it's likely intro/applause/drone
        if clarity < 0.005:
            print(f"⚠️ Skipping '{track.title}' - Audio too messy ({clarity:.4f})")
            return

        multiplier = 1.0
        
        # --- BPM NORMALIZATION ---
        
        # Hambo: Should be ~100-120. If >150, it's double-time.
        if style == "Hambo":
            if raw_bpm > 150: multiplier = 0.5
            elif raw_bpm < 80: multiplier = 2.0 
            
        # Schottis/Engelska: Should be ~140-160 (or ~70-80 walking). 
        # If >160, it's likely reading 8th notes.
        if style in ["Engelska", "Schottis", "Polka"] and raw_bpm > 165:
            multiplier = 0.5

        # Vals: Can be 50-70 (1 beat/bar) or 150-200 (3 beats/bar)
        if style == "Vals" and raw_bpm > 140:
            # Convert quarter-note BPM to measure BPM (often preferred for fast waltz)
            # Or just keep it simple:
            multiplier = 0.333 # (Optional preference)
            
        effective_bpm = int(raw_bpm * multiplier)
        
        # Save Main Tag
        self.track_repo.add_dance_style(
            track_id=track.id,
            style=style,
            multiplier=multiplier,
            effective_bpm=effective_bpm
        )
        
        # --- CROSSOVER LOGIC (Multi-Tagging) ---
        
        # A fast Schottis/Polka is often a good Snoa
        if style in ["Schottis", "Polka"] and effective_bpm > 130:
             self.track_repo.add_dance_style(
                track_id=track.id,
                style="Snoa/Polka",
                multiplier=1.0,
                effective_bpm=effective_bpm
            )

    def _validate_against_profile(self, style, bpm):
        """Future Proofing: Check against Folkwiki Ground Truth"""
        profile = self.analysis_repo.get_genre_profile(style)
        if not profile: return
        
        # Example: Check if this track fits the density profile
        # (Requires audio density calculation in Analyzer first)
        pass