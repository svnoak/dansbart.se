# ==========================================
# CENTRAL KNOWLEDGE BASE FOR MUSIC LOGIC
# ==========================================

# Used to categorize tempo description (Slow/Medium/Fast/Turbo)
# Format: "Style": (Min_Medium, Max_Medium)
# Anything below Min is "Slow/Lugn"
# Anything above Max is "Fast/Rask"
# Anything way above Max is "Turbo/Rojigt"

TEMPO_RANGES = {
    "Hambo":      (100, 115), 
    "Polska":     (105, 125), 
    "Slängpolska":(110, 125),
    "Vals":       (150, 200), 
    "Schottis":   (140, 160), 
    "Snoa":       (80, 110),
    "Polka":      (120, 150),
    "Engelska":   (110, 130),
    "Mazurka":    (130, 160)
}

def categorize_tempo(style: str, bpm: int) -> str:
    """
    Returns 'Slow', 'Medium', 'Fast', or 'Turbo' based on the style.
    Used by both the initial Classifier and the API Feedback loop.
    """
    # Default behavior for unknown styles
    if not style or style not in TEMPO_RANGES:
        return "Medium"
    
    low, high = TEMPO_RANGES[style]
    
    if bpm < low: 
        return "Slow"   # Lugn
    if low <= bpm <= high: 
        return "Medium" # Lagom
    if bpm > (high + 15): 
        return "Turbo"  # Rojigt/Ösigt
        
    return "Fast"       # Rask/Pigg