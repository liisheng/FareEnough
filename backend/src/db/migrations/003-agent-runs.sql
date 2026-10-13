-- Agent execution audit trail and simulated decision actions.
-- Nothing in this schema can execute a real payment.

CREATE TABLE IF NOT EXISTS agent_runs (
  run_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(case_id),
  provider TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('live', 'replay', 'test')),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  input_hash TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_case_id ON agent_runs(case_id);

CREATE TABLE IF NOT EXISTS agent_artifacts (
  artifact_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES agent_runs(run_id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  actor TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (run_id, stage, actor)
);

CREATE TABLE IF NOT EXISTS run_events (
  event_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES agent_runs(run_id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (run_id, sequence)
);

CREATE TABLE IF NOT EXISTS decisions (
  decision_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL UNIQUE REFERENCES agent_runs(run_id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES cases(case_id),
  validation_status TEXT NOT NULL CHECK (validation_status IN ('validated', 'human_review')),
  disposition TEXT,
  action TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL,
  evidence_citations TEXT NOT NULL,
  policy_citations TEXT NOT NULL,
  reason_codes TEXT NOT NULL,
  proposal TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_decisions_case_id ON decisions(case_id);

CREATE TABLE IF NOT EXISTS simulated_actions (
  action_id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL UNIQUE REFERENCES decisions(decision_id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES cases(case_id),
  action_type TEXT NOT NULL CHECK (action_type IN ('uphold_fee', 'reverse_fee')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'simulated' CHECK (status = 'simulated'),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
