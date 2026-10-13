-- 001-init.sql — initial schema for FareEnough
-- Tables: schema_migrations, cases, evidence_items, policy_bundles, derived_facts

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cases (
  case_id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  filed_by TEXT NOT NULL CHECK (filed_by IN ('rider', 'driver')),
  dispute_type TEXT NOT NULL,
  description TEXT NOT NULL,
  filed_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  policy_profile_id TEXT,
  policy_profile_version TEXT,
  fixture_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS evidence_items (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(case_id),
  source_kind TEXT NOT NULL,
  original_timestamp TEXT NOT NULL,
  content_hash TEXT,
  provenance TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'shared',
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_evidence_items_case_id
  ON evidence_items(case_id);

CREATE TABLE IF NOT EXISTS policy_bundles (
  profile_id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  source_register TEXT,
  retrieval_date TEXT,
  applicable_services TEXT,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS derived_facts (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(case_id),
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  unit TEXT,
  source_evidence_ids TEXT NOT NULL,
  calculation_version TEXT NOT NULL,
  policy_rule_ids TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('established', 'uncertain', 'not_applicable')),
  warnings TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_derived_facts_case_id
  ON derived_facts(case_id);
