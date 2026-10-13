import type { Database as DatabaseType } from 'better-sqlite3';
import type { PersistCompletedRunInput, PersistCompletedRunResult } from './types.js';

function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function assertExistingValue(
  row: Record<string, unknown> | undefined,
  expected: Record<string, unknown>,
  label: string,
): void {
  if (!row) throw new Error(`${label} was not persisted`);
  for (const [key, value] of Object.entries(expected)) {
    if (row[key] !== value) throw new Error(`${label} idempotency conflict on ${key}`);
  }
}

/**
 * Atomically persists a finished orchestration. Repeating the exact same input
 * is safe; reusing an identifier for different content fails and rolls back.
 */
export function persistCompletedRun(
  db: DatabaseType,
  input: PersistCompletedRunInput,
): PersistCompletedRunResult {
  if (input.decision.caseId !== input.caseId) throw new Error('Decision case does not match run case');
  if (input.artifacts.some((item) => !item.artifactId || !item.stage || !item.actor)) {
    throw new Error('Artifact identifiers, stages, and actors are required');
  }
  if (input.events.some((item) => !item.eventId || !Number.isInteger(item.sequence) || item.sequence < 0)) {
    throw new Error('Event identifiers and non-negative integer sequences are required');
  }

  return db.transaction(() => {
    const alreadyPresent = db.prepare('SELECT input_hash FROM agent_runs WHERE run_id = ?').get(input.runId) as
      | { input_hash: string }
      | undefined;

    db.prepare(`
      INSERT OR IGNORE INTO agent_runs
        (run_id, case_id, provider, mode, status, input_hash, started_at, completed_at)
      VALUES (?, ?, ?, ?, 'completed', ?, ?, ?)
    `).run(
      input.runId,
      input.caseId,
      input.provider,
      input.mode,
      input.inputHash,
      input.startedAt,
      input.completedAt,
    );

    const runRow = db.prepare(`
      SELECT case_id, provider, mode, status, input_hash, started_at, completed_at
      FROM agent_runs WHERE run_id = ?
    `).get(input.runId) as Record<string, unknown> | undefined;
    assertExistingValue(runRow, {
      case_id: input.caseId,
      provider: input.provider,
      mode: input.mode,
      status: 'completed',
      input_hash: input.inputHash,
      started_at: input.startedAt,
      completed_at: input.completedAt,
    }, 'Run');

    const insertArtifact = db.prepare(`
      INSERT OR IGNORE INTO agent_artifacts (artifact_id, run_id, stage, actor, payload)
      VALUES (?, ?, ?, ?, ?)
    `);
    const findArtifact = db.prepare(`
      SELECT artifact_id, run_id, stage, actor, payload
      FROM agent_artifacts WHERE run_id = ? AND stage = ? AND actor = ?
    `);
    for (const artifact of input.artifacts) {
      const payload = json(artifact.payload);
      insertArtifact.run(artifact.artifactId, input.runId, artifact.stage, artifact.actor, payload);
      assertExistingValue(findArtifact.get(input.runId, artifact.stage, artifact.actor) as Record<string, unknown>, {
        artifact_id: artifact.artifactId,
        run_id: input.runId,
        stage: artifact.stage,
        actor: artifact.actor,
        payload,
      }, `Artifact ${artifact.artifactId}`);
    }

    const insertEvent = db.prepare(`
      INSERT OR IGNORE INTO run_events (event_id, run_id, sequence, event_type, payload)
      VALUES (?, ?, ?, ?, ?)
    `);
    const findEvent = db.prepare(`
      SELECT event_id, run_id, sequence, event_type, payload
      FROM run_events WHERE run_id = ? AND sequence = ?
    `);
    for (const event of input.events) {
      const payload = json(event.payload);
      insertEvent.run(event.eventId, input.runId, event.sequence, event.eventType, payload);
      assertExistingValue(findEvent.get(input.runId, event.sequence) as Record<string, unknown>, {
        event_id: event.eventId,
        run_id: input.runId,
        sequence: event.sequence,
        event_type: event.eventType,
        payload,
      }, `Event ${event.eventId}`);
    }

    const decision = input.decision;
    const disposition = decision.disposition;
    const proposal = json(decision.proposal);
    const evidence = json(decision.evidenceCitations);
    const policies = json(decision.policyCitations);
    const reasonCodes = json(decision.reasonCodes);
    db.prepare(`
      INSERT OR IGNORE INTO decisions
        (decision_id, run_id, case_id, validation_status, disposition, action,
         amount_minor, currency, evidence_citations, policy_citations, reason_codes, proposal)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.decisionId,
      input.runId,
      input.caseId,
      decision.status,
      disposition,
      decision.action,
      decision.amountMinor,
      decision.currency,
      evidence,
      policies,
      reasonCodes,
      proposal,
    );

    const decisionRow = db.prepare(`
      SELECT decision_id, run_id, case_id, validation_status, disposition, action,
             amount_minor, currency, evidence_citations, policy_citations, reason_codes, proposal
      FROM decisions WHERE run_id = ?
    `).get(input.runId) as Record<string, unknown> | undefined;
    assertExistingValue(decisionRow, {
      decision_id: input.decisionId,
      run_id: input.runId,
      case_id: input.caseId,
      validation_status: decision.status,
      disposition,
      action: decision.action,
      amount_minor: decision.amountMinor,
      currency: decision.currency,
      evidence_citations: evidence,
      policy_citations: policies,
      reason_codes: reasonCodes,
      proposal,
    }, 'Decision');

    let actionId: string | null = null;
    if (decision.status === 'validated' && decision.action === 'reverse_fee' && decision.amountMinor > 0) {
      actionId = `${input.decisionId}:simulated-action`;
      const idempotencyKey = `${input.caseId}:${input.decisionId}`;
      db.prepare(`
        INSERT OR IGNORE INTO simulated_actions
          (action_id, decision_id, case_id, action_type, amount_minor, currency, status, idempotency_key)
        VALUES (?, ?, ?, ?, ?, ?, 'simulated', ?)
      `).run(
        actionId,
        input.decisionId,
        input.caseId,
        decision.action,
        decision.amountMinor,
        decision.currency,
        idempotencyKey,
      );
      const actionRow = db.prepare(`
        SELECT action_id, decision_id, case_id, action_type, amount_minor, currency, status, idempotency_key
        FROM simulated_actions WHERE decision_id = ?
      `).get(input.decisionId) as Record<string, unknown> | undefined;
      assertExistingValue(actionRow, {
        action_id: actionId,
        decision_id: input.decisionId,
        case_id: input.caseId,
        action_type: decision.action,
        amount_minor: decision.amountMinor,
        currency: decision.currency,
        status: 'simulated',
        idempotency_key: idempotencyKey,
      }, 'Simulated action');
    }

    return {
      runId: input.runId,
      decisionId: input.decisionId,
      actionId,
      replayed: Boolean(alreadyPresent),
    };
  })();
}
