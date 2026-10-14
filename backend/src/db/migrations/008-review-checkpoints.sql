CREATE TABLE review_checkpoints (
  run_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(case_id),
  mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TEXT NOT NULL,
  evidence TEXT NOT NULL,
  artifacts TEXT NOT NULL DEFAULT '{}',
  events TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX review_checkpoints_case ON review_checkpoints(case_id);
