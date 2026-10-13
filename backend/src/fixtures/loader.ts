import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Disp002FixtureSchema, type Disp002Fixture } from '../schemas/fixture.js';

// ---------------------------------------------------------------------------
// Fixture loader — reads and validates data/fixtures/disp-002.json with Zod.
// Caches the validated result in memory after first load.
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

// From backend/src/fixtures/loader.ts → ../../data/fixtures/disp-002.json
const FIXTURE_PATH = resolve(__dirname, '../../../data/fixtures/disp-002.json');

let cached: Disp002Fixture | null = null;

export function loadDisp002Fixture(): Disp002Fixture {
  if (cached) return cached;

  const raw = readFileSync(FIXTURE_PATH, 'utf-8');
  const parsed: unknown = JSON.parse(raw);
  const result = Disp002FixtureSchema.safeParse(parsed);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Fixture validation failed: ${issues}`);
  }

  cached = result.data;
  return cached;
}

/** Reset cache — useful for tests that need to re-read the fixture. */
export function resetFixtureCache(): void {
  cached = null;
}
