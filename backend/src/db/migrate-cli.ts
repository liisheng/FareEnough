import { getDb, closeDb } from './connection.js';
import { runMigrations } from './migrate.js';

// ---------------------------------------------------------------------------
// Migration CLI — run with: npm run db:migrate
// Creates the SQLite database and applies all pending migrations.
// ---------------------------------------------------------------------------

const db = getDb();
const applied = runMigrations(db);
if (applied.length > 0) {
  console.log(`Applied ${applied.length} migration(s): ${applied.join(', ')}`);
} else {
  console.log('No pending migrations.');
}
closeDb();
