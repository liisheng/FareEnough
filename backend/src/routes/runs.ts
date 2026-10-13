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

const RunBodySchema = z.object({ mode: z.literal('replay') }).strict();

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
    confidence: validated ? 1 : 0,
    decisiveFacts,
    policyRuleIds: result.policyCitations,
    explanation,
  };
}

export async function runRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/cases/:id/runs', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (id !== 'DISP-002') return reply.code(404).send({ error: 'Case not found', caseId: id });

    const body = RunBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'Only explicit replay mode is available in this baseline' });
    }

    const projection = projectCaseEvidence(loadDisp002Fixture());
    const waitFact = projection.derivedFacts.find((fact) => fact.id === 'derived_wait_duration');
    if (!waitFact || typeof waitFact.value !== 'number') {
      return reply.code(500).send({ error: 'Waiting-duration fact is unavailable' });
    }

    const runId = `run-${randomUUID()}`;
    const startedAt = new Date().toISOString();
    const provider = new ReplayModelProvider();
    const run = await runThreeAgentReview(projection, provider, { runId });
    const decision = validateAgentJudgeProposal(id, run.judgeProposal, {
      value: waitFact.value,
      status: waitFact.status,
      sourceEvidenceIds: waitFact.sourceEvidenceIds,
      policyRuleIds: waitFact.policyRuleIds,
    });
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

    persistCompletedRun(getDb(), {
      runId,
      decisionId: `${runId}:decision`,
      caseId: id,
      provider: provider.id,
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

    return reply.code(201).send({
      ...run,
      mode: 'replay',
      status: decision.status === 'validated' ? 'completed' : 'human_review',
      validatedDecision: displayDecision(
        decision,
        run.judgeProposal.explanation,
        run.judgeProposal.findings.map((finding) => finding.text),
      ),
    });
  });
}
