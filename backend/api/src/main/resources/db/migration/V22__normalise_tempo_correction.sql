-- track_style_votes.tempo_correction holds one vocabulary: the keys Slow, SlowMed,
-- Medium, Fast, and Turbo. Rewrite the five Swedish labels to their key.
UPDATE track_style_votes SET tempo_correction = 'Slow'    WHERE tempo_correction = 'Långsamt';
UPDATE track_style_votes SET tempo_correction = 'SlowMed' WHERE tempo_correction = 'Lugnt';
UPDATE track_style_votes SET tempo_correction = 'Medium'  WHERE tempo_correction = 'Lagom';
UPDATE track_style_votes SET tempo_correction = 'Fast'    WHERE tempo_correction = 'Snabbt';
UPDATE track_style_votes SET tempo_correction = 'Turbo'   WHERE tempo_correction = 'Väldigt snabbt';
