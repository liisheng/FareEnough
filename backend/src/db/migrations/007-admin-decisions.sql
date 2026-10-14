ALTER TABLE demo_sessions RENAME TO old_demo_sessions;
CREATE TABLE demo_sessions (
  token TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK(role IN ('rider','driver','support','admin')),
  actor_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
INSERT INTO demo_sessions SELECT * FROM old_demo_sessions;
DROP TABLE old_demo_sessions;
CREATE TABLE human_decisions (
  case_id TEXT PRIMARY KEY REFERENCES workspace_cases(case_id),
  reviewer_id TEXT NOT NULL,
  action TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK(amount_minor >= 0 AND amount_minor <= 500),
  currency TEXT NOT NULL CHECK(currency = 'SGD'),
  rationale TEXT NOT NULL,
  decided_at TEXT NOT NULL
);
