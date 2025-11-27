from sqlalchemy.orm import Session
from app.repository.track import TrackRepository
from app.repository.analysis import AnalysisRepository
from app.core.models import Track, AnalysisSource

# Expanded Keywords based on your list
STYLE_GROUPS = {
    "hambo": "Hambo", "hamburska": "Hambo", "hamburgerpolka": "Hambo",
    "polska": "Polska", "springlek": "Polska", "pols": "Polska", "bondpolska": "Polska",
    "slängpolska": "Slängpolska", 
    "schottis": "Schottis", "reinländer": "Schottis", "tyskpolka": "Schottis",
    "engelska": "Engelska", "reel": "Engelska", "anglais": "Engelska",
    "snoa": "Snoa", "gånglåt": "Snoa", "marsch": "Snoa",
    "polka": "Polka", "galopp": "Polka", "polkett": "Polka",
    "vals": "Vals", "hoppvals": "Vals", "waltz": "Vals", "walz": "Vals",
    "mazurka": "Mazurka"
}

# ==========================================
# 3. CLASSIFIER (Logic & MPM)
# ==========================================

class AdvancedDanceClassifier:
    def __init__(self, db: Session):
        self.db = db
        self.track_repo = TrackRepository(db)
        self.analysis_repo = AnalysisRepository(db)

    def classify_pending_tracks(self, limit=50):
        print("🧠 Starting Advanced Classification...")
        tracks = (self.db.query(Track)
                .join(AnalysisSource)
                .filter(AnalysisSource.source_type == 'hybrid_ml_v2')
                .limit(limit)
                .all())

        for track in tracks:
            analysis = self.analysis_repo.get_latest_by_track(track.id, "hybrid_ml_v2")
            if not analysis or not analysis.raw_data: continue

            raw_data = analysis.raw_data
            
            # 1. Run Classifier Logic
            scores, mpm = self._classify_single_track(track, raw_data)

            # 2. Sort
            sorted_styles = sorted(scores.items(), key=lambda item: item, reverse=True)
            top_style, top_score = sorted_styles
            
            print(f"   '{track.title}' -> {top_style} ({top_score:.2f}) @ {mpm} MPM")

            # 3. Save (Saving only top match for brevity, loop if you want ranks)
            if top_score > 0.3:
                self.track_repo.add_dance_style(
                    track_id=track.id,
                    style=top_style,
                    multiplier=1.0, # MPM is already calculated, no multiplier needed usually
                    effective_bpm=mpm # Saving MPM into the BPM field or a new MPM field
                )

    def _classify_single_track(self, track, data):
        scores = {v: 0.0 for v in set(STYLE_GROUPS.values())}
        
        # Features
        bpm = data.get('tempo_bpm', 0)
        meter = data.get('meter', '4/4')
        asymmetry = data.get('asymmetry_score', 0)
        swing = data.get('swing_ratio', 1.0)
        density = data.get('onset_rate', 0)
        ratios = data.get('beat_ratios',) # e.g., [0.28, 0.42, 0.30]

        # --- A. Metadata Signal (Strongest) ---
        text = f"{track.title} {track.artist_name} {track.album_name or ''}".lower()
        meta_style = None
        for keyword, style in STYLE_GROUPS.items():
            if keyword in text:
                meta_style = style
                scores[style] += 2.0 # Strong boost
                break
        
        # --- B. Audio Heuristics ---
        
        # === TERNARY BRANCH (3/4) ===
        if meter == "3/4":
            # 1. Hambo vs Vals vs Polska
            
            # Vals: Very symmetric (Asymmetry low)
            if asymmetry < 0.08:
                scores['Vals'] += 0.5
            
            # Hambo: Specific Ratio (Short 1 / Long 2 / Short 3) or (Long 1 / Long 2 / Short 3)
            # Common Hambo ratio approx: 1st (33%), 2nd (40%), 3rd (27%) or similar elongation of 2.
            # If 2nd beat is significantly longer than 3rd:
            if len(ratios) == 3:
                if ratios > 0.36: # 2nd beat is elongated
                    scores['Hambo'] += 0.4
                    scores['Polska'] += 0.3 # Polskas also do this (Boda)
            
            # Slängpolska: High note density (running 16ths), steady flow
            if density > 4.0: # Threshold depends on data, >4 notes/sec is "busy"
                scores += 0.4
            
            # Mazurka: Punchy (High energy) + Accent on 2 or 3
            # Hard to detect accent without phase info, but high energy helps
            if data.get('energy', 0) > 0.15 and asymmetry < 0.15: # Mazurka is straighter than Polska
                scores['Mazurka'] += 0.3

        # === BINARY BRANCH (2/4 or 4/4) ===
        elif meter in ["2/4", "4/4"]:
            
            # Schottis vs Polka/Engelska
            # Schottis has "Swing" (dotted step-hop). Ratio ~ 1.5 to 3.0
            if swing > 1.3: 
                scores += 0.6
            else:
                # Straight rhythm -> Polka or Snoa or Engelska
                scores['Polka'] += 0.4
                scores['Engelska'] += 0.3
                scores += 0.3
            
            # Tempo differentiation
            # Snoa is slow walking (70-100 BPM)
            if bpm < 105 and swing < 1.3:
                scores += 0.5
            
            # Polka is fast
            if bpm > 115 and swing < 1.3:
                scores['Polka'] += 0.4

        # --- C. MPM Calculation ---
        # Determine the winner to pick the right divisor
        best_style = max(scores, key=scores.get)
        
        final_mpm = 0

        if best_style in STYLE_GROUPS['3/4']:
            # 3/4 logic
            if bpm > 180: # Beat tracker caught eighth notes?
                final_mpm = int(bpm / 6)
            else:
                final_mpm = int(bpm / 3)

        elif best_style in STYLE_GROUPS['4/4']:
            # 4/4 logic (Schottis usually counted in 4s for steps, or 2 measures)
            # Standard Schottis ~140-160 BPM (steps). MPM ~ 35-40.
            final_mpm = int(bpm / 4)

        elif best_style in STYLE_GROUPS['2/4']:
            # 2/4 logic. Polka ~100-120 BPM. MPM ~ 50-60.
            final_mpm = int(bpm / 2)

        return scores, final_mpm