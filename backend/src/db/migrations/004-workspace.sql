CREATE TABLE demo_sessions (
  token TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK(role IN ('rider','driver','support')),
  actor_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE workspace_cases (
  case_id TEXT PRIMARY KEY REFERENCES cases(case_id),
  rider_id TEXT NOT NULL,
  driver_id TEXT,
  trip_reference TEXT NOT NULL,
  category TEXT NOT NULL,
  complaint TEXT NOT NULL,
  safety INTEGER NOT NULL,
  supported INTEGER NOT NULL,
  driver_account TEXT,
  driver_filed_at TEXT,
  filed_at TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT NOT NULL,
  request_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  run_id TEXT,
  run_mode TEXT,
  events TEXT NOT NULL DEFAULT '[]',
  result TEXT,
  UNIQUE(rider_id, request_key),
  UNIQUE(rider_id, trip_reference, category)
);
