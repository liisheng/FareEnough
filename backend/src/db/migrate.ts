import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Database as DatabaseType } from 'better-sqlite3';

// ---------------------------------------------------------------------------
// Migration runner — applies SQL files from the migrations directory in order.
// Tracks applied migrations in the schema_migrations table.
//
// The migrations directory is resolved relative to this module.  When running
// via tsx (dev), that's src/db/migrations/.  When running the compiled output
// (npm start), it's dist/db/migrations/ (copied by scripts/copy-assets.mjs).
// If the compiled migrations dir doesn't exist, we fall back to src/ so the
// server still works when dist/ hasn't been populated with assets.
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

function findMigrationsDir(): string {
  // Primary: migrations/ next to this module (works for both src/ and dist/)
  const localMigrations = resolve(__dirname, 'migrations');
  if (existsSync(localMigrations)) return localMigrations;

  // Fallback: src/db/migrations (relative to dist/db/ → ../../src/db/migrations)
  const srcMigrations = resolve(__dirname, '../../src/db/migrations');
  if (existsSync(srcMigrations)) return srcMigrations;

  // Last resort: return the primary path so readdirSync throws a clear error
  return localMigrations;
}

const MIGRATIONS_DIR = findMigrationsDir();

/** Run all pending migrations in order. */
export function runMigrations(db: DatabaseType): string[] {
  // Ensure schema_migrations table exists
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const applied = new Set(
    db.prepare('SELECT id FROM schema_migrations').all().map((r: any) => r.id)
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const newlyApplied: string[] = [];

  const migrate = db.transaction(() => {
    for (const file of files) {
      const migrationId = file.replace(/\.sql$/, '');
      if (applied.has(migrationId)) continue;

      const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf-8');
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(migrationId);
      newlyApplied.push(migrationId);
    }
  });

  migrate();
  return newlyApplied;
}
