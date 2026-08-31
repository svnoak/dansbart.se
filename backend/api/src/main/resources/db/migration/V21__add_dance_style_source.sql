-- The classifier already tags each guess with where it came from (metadata keyword match,
-- ML groove-fingerprint prediction, or a math/structure heuristic) but track_dance_styles
-- never stored it, so the frontend was left reconstructing provenance by thresholding the
-- single confidence number. Add the column so it can be persisted going forward.
ALTER TABLE track_dance_styles ADD COLUMN source VARCHAR;

-- Best-effort backfill from the confidence bands the three provenance tiers actually use
-- (style_classifier.py: metadata=0.98, heuristic capped at 0.50, ml is whatever the model
-- returned). This is imperfect by construction — an ml prediction below 0.50 is
-- indistinguishable from a heuristic guess under this scheme — which is exactly why the
-- column is being added, so future rows carry the real value instead of being inferred.
UPDATE track_dance_styles SET source = 'metadata' WHERE source IS NULL AND confidence = 0.98;
UPDATE track_dance_styles SET source = 'heuristic' WHERE source IS NULL AND confidence <= 0.50;
UPDATE track_dance_styles SET source = 'ml' WHERE source IS NULL AND confidence IS NOT NULL;
