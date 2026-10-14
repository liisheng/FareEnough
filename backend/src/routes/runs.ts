import { createHash, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { runThreeAgentReview } from '../agents/run-coordinator.js';
import { getDb } from '../db/connection.js';
import { validateAgentJudgeProposal } from '../decisions/validator.js';
import { loadDisp002Fixture } from '../fixtures/loader.js';
import { persistCompletedRun } from '../persistence/run-repository.js';
import { projectCaseEvidence } from '../projections/case-projection.js';
import { ReplayModelProvider } from '../providers/replay-provider.js';
import { AdpModelProvider, AdpProviderError } from '../providers/adp-provider.js';
import type { ModelProvider } from '../providers/model-provider.js';
import type { SafeAgentEvent } from '../agents/schemas.js';
import { config, isAdpConfigured, type Env } from '../config.js';
import { findWorkspaceCase, requireSession, workspaceProjection } from '../workspace.js';
import { createCaseEvidenceTools } from '../tools/case-evidence-tools.js';
import { SubmittedReplayProvider } from '../providers/submitted-replay-provider.js';

const RunBodySchema = z.object({ mode: z.enum(['replay', 'live']), progressId: z.string().uuid().optional() }).strict();

export interface RunRoutesOptions {
  env?: Env;
  liveProviderFactory?: () => ModelProvider;
}

function boundedInt(value: string, fallback: number, maximum: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function displayDecision(
  result: ReturnType<typeof validateAgentJudgeProposal>,
  explanation: string,
  decisiveFacts: string[],
) {
  const validated = result.status === 'validated';
  return {
    ...result,
    validationStatus: result.status,
    dispositionLabel: validated
      ? result.disposition === 'claim_rejected' ? 'Rider claim not upheld' : 'Rider claim upheld'
      : 'Human review required',
    feeTreatment: validated
      ? result.action === 'uphold_fee' ? 'Existing fee upheld' : 'Existing fee reversed'
      : 'No automatic change',
    decisiveFacts,
    policyRuleIds: result.policyCitations,
    explanation,
  };
}

export async function runRoutes(app: FastifyInstance, options: RunRoutesOptions = {}): Promise<void> {
  const env = options.env ?? config;
  let liveBusy = false;
  let reservedCalls = 0;
  // Original fixture walkthroughs have no workspace case to poll. Expose only
  // neutral stage events under an opaque, client-generated run identifier.
  const fixtureProgress = new Map<string, {status:string; mode:string; events:SafeAgentEvent[]}>();
  app.get('/api/cases/DISP-002/progress/:progressId', async (request, reply) => {
    const progress = fixtureProgress.get((request.params as {progressId:string}).progressId);
    return progress ?? reply.code(404).send({ error: 'Progress unavailable' });
  });
  app.post('/api/cases/:id/runs', async (request, reply) => {
    if (request.headers.origin && !['http://127.0.0.1:3000', 'http://localhost:3000'].includes(request.headers.origin)) {
      return reply.code(403).send({ error: 'Origin is not allowed' });
    }
    const { id } = request.params as { id: string };
    const submitted = id === 'DISP-002' ? undefined : findWorkspaceCase(id);
    if (id !== 'DISP-002') {
      if (!requireSession(request, reply, 'support')) return;
      if (!submitted) return reply.code(404).send({ error: 'Case not found' });
      if (!submitted.supported || !submitted.driver_account) return reply.code(409).send({ error: 'Review requires a supported trip and both party accounts.' });
      if (submitted.status === 'running') return reply.code(409).send({ error: 'This case is already running.' });
      if (submitted.status === 'completed') return reply.code(200).send(JSON.parse(submitted.result!));
    }

    const body = RunBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'Choose explicit replay or live mode' });
    }
    const live = body.data.mode === 'live';
    const progressId = !submitted ? body.data.progressId : undefined;
    if (progressId && fixtureProgress.has(progressId)) return reply.code(409).send({ error: 'This review request has already started.' });
    if (live && !isAdpConfigured(env)) return reply.code(400).send({ error: 'Live ADP is not configured' });
    if (live && liveBusy) return reply.code(409).send({ error: 'A live review is already running' });
    const sessionLimit = boundedInt(env.MAX_MODEL_CALLS_PER_SESSION, 60, 60);
    if (live && (reservedCalls + 5 > sessionLimit || Number(env.MAX_MODEL_CALLS_PER_RUN) < 5)) {
      return reply.code(429).send({ error: 'Live review call limit reached for this server session' });
    }

    const projection = submitted ? workspaceProjection(submitted) : projectCaseEvidence(loadDisp002Fixture());
    const waitFact = projection.derivedFacts.find((fact) => fact.id === 'derived_wait_duration');
    if (!waitFact || typeof waitFact.value !== 'number') {
      return reply.code(500).send({ error: 'Waiting-duration fact is unavailable' });
    }

    const runId = `run-${randomUUID()}`;
    const startedAt = new Date().toISOString();
    const events: SafeAgentEvent[] = [];
    if (progressId) {
      if (fixtureProgress.size >= 100) {
        const oldest = [...fixtureProgress].find(([,progress]) => progress.status !== 'running');
        if (oldest) fixtureProgress.delete(oldest[0]);
        else return reply.code(429).send({ error: 'Too many active reviews.' });
      }
      fixtureProgress.set(progressId, {status:'running',mode:body.data.mode,events});
    }
    if (submitted) getDb().prepare("UPDATE workspace_cases SET status = 'running', reason = 'Three-agent review in progress.', run_id = ?, run_mode = ?, events = '[]', result = NULL WHERE case_id = ?").run(runId, body.data.mode, id);
    if (live) { liveBusy = true; reservedCalls += 5; }
    let provider: ModelProvider | undefined;
    try {
    provider = live ? (options.liveProviderFactory?.() ?? new AdpModelProvider({
      riderAppKey: env.ADP_RIDER_APP_KEY,
      driverAppKey: env.ADP_DRIVER_APP_KEY,
      judgeAppKey: env.ADP_JUDGE_APP_KEY,
      chatUrl: env.ADP_CHAT_URL,
      callTimeoutMs: boundedInt(env.MODEL_CALL_TIMEOUT_MS, 60000, 120000),
      runTimeoutMs: boundedInt(env.RUN_TIMEOUT_MS, 240000, 480000),
    })) : submitted ? new SubmittedReplayProvider() : new ReplayModelProvider();
    const run = await runThreeAgentReview(projection, provider, { runId, onEvent(event) {
      events.push(event);
      if (submitted) getDb().prepare('UPDATE workspace_cases SET events = ? WHERE case_id = ?').run(JSON.stringify(events), id);
    } });
    const decision = validateAgentJudgeProposal(id, run.judgeProposal, {
      value: waitFact.value,
      status: waitFact.status,
      sourceEvidenceIds: waitFact.sourceEvidenceIds,
      policyRuleIds: waitFact.policyRuleIds,
    }, submitted ? { profileId: projection.policyProfile.profileId, evidenceIds: new Set(createCaseEvidenceTools(projection).getEvidence().map(e => e.id)) } : undefined);
    const completedAt = new Date().toISOString();
    const artifacts = [
      ['rider_brief', 'rider_advocate', run.riderBrief],
      ['driver_brief', 'driver_advocate', run.driverBrief],
      ['rider_rebuttal', 'rider_advocate', run.riderRebuttal],
      ['driver_rebuttal', 'driver_advocate', run.driverRebuttal],
      ['judge', 'judge', run.judgeProposal],
    ] as const;
    const inputHash = createHash('sha256')
      .update(JSON.stringify({ caseId: id, mode: body.data.mode, projection, provider: provider.id }))
      .digest('hex');

    const response = {
      ...run, mode: body.data.mode,
      status: decision.status === 'validated' ? 'completed' : 'human_review',
      validatedDecision: displayDecision(decision, run.judgeProposal.explanation, run.judgeProposal.findings.map(f => f.text)),
    };
    getDb().transaction(() => {
    persistCompletedRun(getDb(), {
      runId,
      decisionId: `${runId}:decision`,
      caseId: id,
      provider: run.provider.id,
      mode: body.data.mode,
      inputHash: `sha256:${inputHash}`,
      startedAt,
      completedAt,
      artifacts: artifacts.map(([stage, actor, payload]) => ({
        artifactId: `${runId}:${stage}`,
        stage,
        actor,
        payload,
      })),
      events: run.events.map((event) => ({
        eventId: `${runId}:event:${event.sequence}`,
        sequence: event.sequence,
        eventType: `${event.stage}_${event.status}`,
        payload: event,
      })),
      decision,
    });
    if (submitted) getDb().prepare('UPDATE workspace_cases SET status = ?, reason = ?, result = ? WHERE case_id = ?').run(response.status, decision.status === 'validated' ? 'Review completed; any financial outcome is simulated.' : 'Human review required; no automatic adjustment.', JSON.stringify(response), id);
    })();
    if (progressId) fixtureProgress.get(progressId)!.status = response.status;
    return reply.code(201).send(response);
    } catch (error) {
      provider?.abort?.();
      // Never return or persist upstream errors, prompts, keys, or invalid model output.
      const message = 'Review could not be completed. Human review is required; no financial action was taken.';
      const code = error instanceof AdpProviderError ? error.code : 'INVALID_OR_INCOMPLETE_REVIEW';
      const db = getDb();
      db.transaction(() => {
        db.prepare(`INSERT INTO agent_runs
          (run_id, case_id, provider, mode, status, input_hash, started_at, completed_at, error_message)
          VALUES (?, ?, ?, ?, 'failed', ?, ?, ?, ?)`).run(
            runId, id, live ? 'adp' : 'replay', body.data.mode,
            `sha256:${createHash('sha256').update(JSON.stringify(projection)).digest('hex')}`,
            startedAt, new Date().toISOString(), `${code}: ${message}`,
          );
        const insert = db.prepare('INSERT INTO run_events (event_id, run_id, sequence, event_type, payload) VALUES (?, ?, ?, ?, ?)');
        for (const event of events) insert.run(`${runId}:event:${event.sequence}`, runId, event.sequence, `${event.stage}_${event.status}`, JSON.stringify(event));
      })();
      if (submitted) getDb().prepare("UPDATE workspace_cases SET status = 'human_review', reason = ? WHERE case_id = ?").run(message, id);
      if (progressId) fixtureProgress.get(progressId)!.status = 'failed';
      return reply.code(502).send({ error: message, code, runId, mode: body.data.mode, status: 'human_review' });
    } finally {
      if (live) liveBusy = false;
    }
  });
}
