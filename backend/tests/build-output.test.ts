import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Build output test — verifies that the compiled dist/ contains the SQL
// migration files alongside the compiled JavaScript.
//
// This catches the ENOENT regression where `tsc` compiles .ts → .js but does
// not copy non-TS assets like .sql files.  The build script (scripts/
// copy-assets.mjs) must run after tsc to populate dist/db/migrations/.
//
// Uses process.cwd() because vitest runs from backend/ and dist/ is a
// subdirectory of backend/, not the repo root.
// ---------------------------------------------------------------------------

const DIST_DIR = resolve(process.cwd(), 'dist');

describe('Compiled build output (dist/)', () => {
  it('dist/ directory exists', () => {
    expect(existsSync(DIST_DIR)).toBe(true);
  });

  it('dist/db/migrations/ directory exists and contains SQL files', () => {
    const migrationsDir = resolve(DIST_DIR, 'db/migrations');
    expect(existsSync(migrationsDir)).toBe(true);

    const sqlFiles = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
    expect(sqlFiles.length).toBeGreaterThan(0);
    expect(sqlFiles).toContain('001-init.sql');
    expect(sqlFiles).toContain('002-seed-disp002.sql');
  });

  it('dist/db/migrations/*.sql files are non-empty', () => {
    const migrationsDir = resolve(DIST_DIR, 'db/migrations');
    const sqlFiles = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
    for (const f of sqlFiles) {
      const stat = statSync(resolve(migrationsDir, f));
      expect(stat.size).toBeGreaterThan(0);
    }
  });

  it('dist/index.js exists (compiled entry point)', () => {
    const entryFile = resolve(DIST_DIR, 'index.js');
    expect(existsSync(entryFile)).toBe(true);
  });

  it('dist/db/migrate.js exists (compiled migration runner)', () => {
    const migrateFile = resolve(DIST_DIR, 'db/migrate.js');
    expect(existsSync(migrateFile)).toBe(true);
  });
});
