-- The classifier tags each prediction with a source: metadata, ml, or heuristic.
ALTER TABLE track_dance_styles ADD COLUMN source VARCHAR;

-- A row written before this column holds no source. Confidence cannot supply one: the
-- random forest reports 0.98 when 98 of its 100 trees agree, the value a metadata match
-- carries.
