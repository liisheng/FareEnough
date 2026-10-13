import { getDb, closeDb } from './connection.js';
import { runMigrations } from './migrate.js';

// ---------------------------------------------------------------------------
// Seed CLI — run with: npm run seed
// Runs migrations (if needed) then seeds the DISP-002 data.
// Migrations use INSERT OR IGNORE so seeding is idempotent.
// ---------------------------------------------------------------------------

const db = getDb();
runMigrations(db);
console.log('Seed complete: DISP-002 case, evidence items, and policy bundle are present.');
closeDb();
