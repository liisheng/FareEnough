import Database from 'better-sqlite3';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, setTestDb } from '../src/db/connection.js';
import { runMigrations } from '../src/db/migrate.js';
import { runRoutes } from '../src/routes/runs.js';

describe('POST case run', () => {
  let db: Database.Database;
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
    setTestDb(db);
    app = Fastify({ logger: false });
    await app.register(runRoutes);
  });

  afterEach(async () => {
    await app.close();
    closeDb();
  });

  it('runs the five-call replay, validates it, and persists the audit trail', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/cases/DISP-002/runs',
      payload: { mode: 'replay' },
    });
    const body = response.json();

    expect(response.statusCode).toBe(201);
    expect(body.mode).toBe('replay');
    expect(body.events).toHaveLength(10);
    expect(body.riderBrief.role).toBe('rider_advocate');
    expect(body.driverBrief.role).toBe('driver_advocate');
    expect(body.judgeProposal.outcome).toBe('uphold_fee');
    expect(body.validatedDecision).toMatchObject({
      validationStatus: 'validated',
      disposition: 'claim_rejected',
      dispositionLabel: 'Rider claim not upheld',
      amountMinor: 0,
    });
    expect((db.prepare('SELECT count(*) AS count FROM agent_runs').get() as any).count).toBe(1);
    expect((db.prepare('SELECT count(*) AS count FROM agent_artifacts').get() as any).count).toBe(5);
    expect((db.prepare('SELECT count(*) AS count FROM run_events').get() as any).count).toBe(10);
    expect((db.prepare('SELECT count(*) AS count FROM decisions').get() as any).count).toBe(1);
    expect((db.prepare('SELECT count(*) AS count FROM simulated_actions').get() as any).count).toBe(0);
  });

  it('rejects implicit or live execution in the replay-only baseline', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/cases/DISP-002/runs',
      payload: { mode: 'live' },
    });
    expect(response.statusCode).toBe(400);
  });
});
