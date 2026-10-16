-- Existing decisions retain NULL rather than inventing retrospective assessments.
ALTER TABLE decisions ADD COLUMN confidence_json TEXT;
