import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Database as DatabaseType } from 'better-sqlite3';
import { DATABASE_PATH } from '../config.js';

// ---------------------------------------------------------------------------
// SQLite connection — opens the database at DATABASE_PATH.
// Enables WAL mode for read concurrency. Creates the directory if missing.
//
// Tests can override the singleton with setTestDb() to inject an in-memory
// database that all routes share within a test context.
// ---------------------------------------------------------------------------

let dbInstance: DatabaseType | null = null;

/** Set a test database instance as the singleton (for testing only). */
export function setTestDb(db: DatabaseType): void {
  dbInstance = db;
}

export function getDb(dbPath?: string): DatabaseType {
  if (dbInstance && !dbPath) return dbInstance;

  const path = dbPath ?? DATABASE_PATH;
  const resolved = resolve(process.cwd(), path);

  // Ensure the parent directory exists (e.g. .runtime/)
  const dir = dirname(resolved);
  mkdirSync(dir, { recursive: true });

  const db = new Database(resolved);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  if (!dbPath) {
    dbInstance = db;
  }

  return db;
}

/** Close the singleton database connection (useful for tests). */
export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
