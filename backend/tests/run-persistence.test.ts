import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { runMigrations } from '../src/db/migrate.js';
import { validateDecision } from '../src/decisions/validator.js';
import { persistCompletedRun } from '../src/persistence/run-repository.js';
import type { PersistCompletedRunInput } from '../src/persistence/types.js';

function validatedDecision() {
  return validateDecision({
    caseId: 'DISP-002',
    waitingDuration: { value: 480, status: 'established' },
    proposal: {
      disposition: 'claim_rejected',
      action: 'uphold_fee',
      amountMinor: 0,
      currency: 'SGD',
      evidenceCitations: ['gps-005', 'gps-008'],
      policyCitations: ['ORG-NS-03'],
    },
  });
}

function completedRun(): PersistCompletedRunInput {
  return {
    runId: 'run-001',
    decisionId: 'decision-001',
    caseId: 'DISP-002',
    provider: 'deterministic-replay',
    mode: 'test',
    inputHash: 'sha256:test-input',
    startedAt: '2026-10-13T01:00:00.000Z',
    completedAt: '2026-10-13T01:00:01.000Z',
    artifacts: [
      { artifactId: 'artifact-rider', stage: 'argument', actor: 'rider_advocate', payload: { claims: [] } },
      { artifactId: 'artifact-driver', stage: 'argument', actor: 'driver_advocate', payload: { claims: [] } },
      { artifactId: 'artifact-judge', stage: 'proposal', actor: 'judge', payload: { result: 'reject' } },
    ],
    events: [
      { eventId: 'event-001', sequence: 0, eventType: 'run_started', payload: {} },
      { eventId: 'event-002', sequence: 1, eventType: 'decision_validated', payload: {} },
    ],
    decision: validatedDecision(),
  };
}

describe('agent run persistence', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
  });

  it('atomically stores a run, artifacts, events and decision without inventing a zero-value action', () => {
    const result = persistCompletedRun(db, completedRun());

    expect(result.actionId).toBeNull();
    expect((db.prepare('SELECT count(*) AS count FROM agent_runs').get() as any).count).toBe(1);
    expect((db.prepare('SELECT count(*) AS count FROM agent_artifacts').get() as any).count).toBe(3);
    expect((db.prepare('SELECT count(*) AS count FROM run_events').get() as any).count).toBe(2);
    expect((db.prepare('SELECT count(*) AS count FROM decisions').get() as any).count).toBe(1);
    expect((db.prepare('SELECT count(*) AS count FROM simulated_actions').get() as any).count).toBe(0);
  });

  it('is idempotent and keeps the no-change outcome action-free', () => {
    const input = completedRun();
    const first = persistCompletedRun(db, input);
    const second = persistCompletedRun(db, input);

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect((db.prepare('SELECT count(*) AS count FROM agent_runs').get() as any).count).toBe(1);
    expect((db.prepare('SELECT count(*) AS count FROM simulated_actions').get() as any).count).toBe(0);
  });

  it('persists human review without creating an action', () => {
    const input = completedRun();
    input.runId = 'run-review';
    input.decisionId = 'decision-review';
    input.artifacts = [];
    input.events = [];
    input.decision = validateDecision({
      caseId: 'DISP-002',
      proposal: { answer: 'uncertain' },
      waitingDuration: { value: 480, status: 'uncertain' },
    });

    const result = persistCompletedRun(db, input);
    expect(result.actionId).toBeNull();
    expect((db.prepare('SELECT validation_status FROM decisions').get() as any).validation_status)
      .toBe('human_review');
    expect((db.prepare('SELECT count(*) AS count FROM simulated_actions').get() as any).count).toBe(0);
  });

  it('rolls back and rejects reuse of a run id with changed content', () => {
    const input = completedRun();
    persistCompletedRun(db, input);

    expect(() => persistCompletedRun(db, { ...input, inputHash: 'sha256:different' }))
      .toThrow(/idempotency conflict/);
    expect((db.prepare('SELECT count(*) AS count FROM agent_runs').get() as any).count).toBe(1);
    expect((db.prepare('SELECT count(*) AS count FROM simulated_actions').get() as any).count).toBe(0);
  });
});
