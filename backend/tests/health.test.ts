import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { healthRoutes } from '../src/routes/health.js';
import { caseRoutes } from '../src/routes/cases.js';
import { setTestDb, closeDb } from '../src/db/connection.js';
import { runMigrations } from '../src/db/migrate.js';
import Database from 'better-sqlite3';

describe('GET /health', () => {
  let app: any;

  beforeAll(async () => {
    const db = new Database(':memory:');
    runMigrations(db);
    setTestDb(db);
    app = Fastify({ logger: false });
    await app.register(healthRoutes);
    await app.register(caseRoutes);
    await app.ready();
  });

  afterAll(async () => {
    closeDb();
    await app.close();
  });

  it('returns 200 with status ok and database true', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.database).toBe(true);
    expect(body.provider).toBe(false);
    expect(body.timestamp).toBeDefined();
  });
});
