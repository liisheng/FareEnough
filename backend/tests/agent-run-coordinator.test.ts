import { describe, expect, it, vi } from 'vitest';
import { loadDisp002Fixture, loadRouteFixture } from '../src/fixtures/loader.js';
import { projectCaseEvidence } from '../src/projections/case-projection.js';
import { runThreeAgentReview } from '../src/agents/run-coordinator.js';
import { ReplayModelProvider } from '../src/providers/replay-provider.js';
import type { ModelProvider, ModelProviderRequest } from '../src/providers/model-provider.js';
import type { AdvocateBrief, JudgeProposal, Rebuttal, SafeAgentEvent } from '../src/agents/schemas.js';
import { createCaseEvidenceTools } from '../src/tools/case-evidence-tools.js';
import { projectRouteEvidence } from '../src/projections/route-projection.js';
import { loadAgentPrompt } from '../src/agents/prompt-loader.js';
import { responseContract } from '../src/agents/response-contract.js';

describe('three-agent coordinator', () => {
  it('rejects the synthetic route outcome when a provider returns it for a no-show case', async () => {
    const replay = new ReplayModelProvider();
    const abort = vi.fn();
    const events: SafeAgentEvent[] = [];
    const provider: ModelProvider = { id: replay.id, mode: replay.mode, abort, async generate(request) {
      const output = await replay.generate(request);
      return request.stage === 'judge'
        ? { ...output as JudgeProposal, outcome: 'refund_unsupported_charge', proposedAdjustmentCents: 500 }
        : output;
    } };
    await expect(runThreeAgentReview(projectCaseEvidence(loadDisp002Fixture()), provider, {
      onEvent: event => { events.push(event); },
    })).rejects.toThrow('Judge outcome is not supported by the selected policy profile');
    expect(events).toContainEqual(expect.objectContaining({ stage: 'judge', status: 'failed' }));
    expect(events).not.toContainEqual(expect.objectContaining({ stage: 'judge', status: 'completed' }));
    expect(abort).toHaveBeenCalledOnce();
  });

  it('isolates the synthetic route output extension from the validated sample prompts', async () => {
    const judgePrompt = await loadAgentPrompt('judge');
    const replay = new ReplayModelProvider();
    for (const projection of [projectCaseEvidence(loadDisp002Fixture()), projectRouteEvidence(loadRouteFixture())]) {
      const requests: ModelProviderRequest[] = [];
      const provider: ModelProvider = { id: replay.id, mode: replay.mode, async generate(request) {
        requests.push(request);
        return replay.generate(request);
      } };
      await runThreeAgentReview(projection, provider);
      const judge = requests.find(request => request.stage === 'judge')!;
      const contract = responseContract('judge', judge.evidence);
      const outcome = contract.schema.properties.outcome as { enum: string[] };
      if (projection.policyProfile.profileId === 'demo-route-erp-v1') {
        expect(judge.systemPrompt.startsWith(judgePrompt)).toBe(true);
        expect(judge.systemPrompt).toContain('refund_unsupported_charge');
        expect(judge.systemPrompt).not.toContain('325');
        expect(outcome.enum).toContain('refund_unsupported_charge');
      } else {
        expect(judge.systemPrompt).toBe(judgePrompt);
        expect(outcome.enum).toEqual(['uphold_fee', 'reverse_fee', 'human_review']);
      }
      for (const request of requests.filter(request => request.stage !== 'judge')) {
        expect(request.systemPrompt).toBe(await loadAgentPrompt(request.stage.startsWith('rider') ? 'rider-advocate' : 'driver-advocate'));
      }
    }
    const snapshot = createCaseEvidenceTools(projectCaseEvidence(loadDisp002Fixture())).snapshot();
    snapshot.policyProfile = { profileId: 'ryde-v2.1', version: '2.1' };
    const outcome = responseContract('judge', snapshot).schema.properties.outcome as { enum: string[] };
    expect(outcome.enum).toEqual(['uphold_fee', 'reverse_fee', 'human_review']);
  });

  it('runs independent briefs, one rebuttal each, then the judge with observable events', async () => {
    const requests: ModelProviderRequest[] = [];
    const replay = new ReplayModelProvider();
    const provider: ModelProvider = { id: replay.id, mode: replay.mode, async generate(request) { requests.push(request); return replay.generate(request); } };
    const projection = projectCaseEvidence(loadDisp002Fixture());
    const expectedEvidence = createCaseEvidenceTools(projection).snapshot();
    const result = await runThreeAgentReview(projection, provider, { runId: 'test-run' });

    expect(requests.map((r) => r.stage)).toEqual(['rider_brief', 'driver_brief', 'rider_rebuttal', 'driver_rebuttal', 'judge']);
    expect(requests[0].priorOutputs).toEqual([]);
    expect(requests[1].priorOutputs).toEqual([]);
    expect(requests[2].priorOutputs).toEqual([result.riderBrief, result.driverBrief]);
    expect(requests[3].priorOutputs).toEqual([result.driverBrief, result.riderBrief]);
    expect(requests[4].priorOutputs).toEqual([
      result.riderBrief, result.driverBrief, result.riderRebuttal, result.driverRebuttal,
    ]);
    for (const request of requests) {
      expect(request.evidence).toEqual(expectedEvidence);
      expect(request.evidence.caseId).toBe(projection.caseId);
    }
    expect(new Set(requests.map((r) => r.evidence)).size).toBe(5);
    expect(new Set(requests.map((r) => r.conversationId)).size).toBe(5);
    expect(result.events).toHaveLength(10);
    expect(result.provider.mode).toBe('replay');
    expect(result.judgeProposal.outcome).toBe('uphold_fee');
    expect(result.judgeProposal.proposedAdjustmentCents).toBe(0);
  });

  it('rejects a provider response with an invented citation', async () => {
    const replay = new ReplayModelProvider();
    const provider: ModelProvider = {
      id: 'bad-provider', mode: 'replay',
      async generate(request) {
        const output = await replay.generate(request) as Record<string, unknown>;
        if (request.stage === 'rider_brief') {
          const claims = output.claims as Array<Record<string, unknown>>;
          claims[0].evidenceIds = ['invented-999'];
        }
        return output;
      },
    };
    await expect(runThreeAgentReview(projectCaseEvidence(loadDisp002Fixture()), provider)).rejects.toThrow('Ungrounded agent citations');
  });

  it.each(['evidenceIds', 'policyRuleIds'] as const)('rejects invented %s in adverse evidence', async (field) => {
    const replay = new ReplayModelProvider();
    const stages: string[] = [];
    const provider: ModelProvider = {
      id: 'bad-adverse-citation', mode: 'replay',
      async generate(request) {
        stages.push(request.stage);
        const output = await replay.generate(request);
        if (request.stage === 'driver_brief') {
          (output as AdvocateBrief).adverseEvidence[0][field] = ['invented-999'];
        }
        return output;
      },
    };

    await expect(runThreeAgentReview(projectCaseEvidence(loadDisp002Fixture()), provider))
      .rejects.toThrow('Ungrounded agent citations');
    expect(stages).toEqual(['rider_brief', 'driver_brief']);
  });

  it.each(['rider_brief', 'driver_brief', 'rider_rebuttal', 'driver_rebuttal'] as const)(
    'rejects the wrong advocate role at %s and does not call the Judge', async (failedStage) => {
      const replay = new ReplayModelProvider();
      const stages: string[] = [];
      const events: SafeAgentEvent[] = [];
      const abort = vi.fn();
      const provider: ModelProvider = {
        id: 'wrong-role', mode: 'replay', abort,
        async generate(request) {
          stages.push(request.stage);
          const output = await replay.generate(request);
          if (request.stage === failedStage) {
            const advocateOutput = output as AdvocateBrief | Rebuttal;
            advocateOutput.role = advocateOutput.role === 'rider_advocate' ? 'driver_advocate' : 'rider_advocate';
          }
          return output;
        },
      };

      await expect(runThreeAgentReview(projectCaseEvidence(loadDisp002Fixture()), provider, {
        onEvent: (event) => { events.push(event); },
      })).rejects.toThrow('Agent role does not match requested stage');
      expect(stages).not.toContain('judge');
      expect(events).toContainEqual(expect.objectContaining({ stage: failedStage, status: 'failed' }));
      expect(events).not.toContainEqual(expect.objectContaining({ stage: failedStage, status: 'completed' }));
      expect(abort).toHaveBeenCalledOnce();
    },
  );

  it.each(['rider_brief', 'rider_rebuttal'] as const)(
    'rejects a plain-language response at %s without continuing to a decision', async (failedStage) => {
      const replay = new ReplayModelProvider();
      const stages: string[] = [];
      const events: SafeAgentEvent[] = [];
      const provider: ModelProvider = {
        id: 'plain-text-output', mode: 'replay',
        async generate(request) {
          stages.push(request.stage);
          return request.stage === failedStage
            ? 'Please supply case evidence and policy identifiers.'
            : replay.generate(request);
        },
      };

      await expect(runThreeAgentReview(projectCaseEvidence(loadDisp002Fixture()), provider, {
        onEvent: (event) => { events.push(event); },
      })).rejects.toMatchObject({ name: 'ZodError' });
      expect(stages).toEqual(failedStage === 'rider_brief'
        ? ['rider_brief', 'driver_brief']
        : ['rider_brief', 'driver_brief', 'rider_rebuttal']);
      expect(events).toContainEqual(expect.objectContaining({ stage: failedStage, status: 'failed' }));
      expect(events.some((event) => event.stage === 'judge')).toBe(false);
    },
  );

  it('waits for the other initial brief to settle after a failure', async () => {
    const replay = new ReplayModelProvider();
    let releaseDriver!: () => void;
    const driverGate = new Promise<void>((resolve) => { releaseDriver = resolve; });
    let notifyFailure!: () => void;
    const failureSeen = new Promise<void>((resolve) => { notifyFailure = resolve; });
    const stages: string[] = [];
    const abort = vi.fn();
    const provider: ModelProvider = {
      id: 'slow-brief', mode: 'replay', abort,
      async generate(request) {
        stages.push(request.stage);
        if (request.stage === 'rider_brief') return 'Missing required input.';
        if (request.stage === 'driver_brief') await driverGate;
        return replay.generate(request);
      },
    };
    let runSettled = false;
    const run = runThreeAgentReview(projectCaseEvidence(loadDisp002Fixture()), provider, {
      onEvent: (event) => {
        if (event.stage === 'rider_brief' && event.status === 'failed') notifyFailure();
      },
    });
    void run.then(() => { runSettled = true; }, () => { runSettled = true; });
    const rejection = expect(run).rejects.toMatchObject({ name: 'ZodError' });

    await failureSeen;
    // Yield to the event loop so premature rejection would be observable.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const settledBeforeDriver = runSettled;
    releaseDriver();
    await rejection;

    expect(settledBeforeDriver).toBe(false);
    expect(runSettled).toBe(true);
    expect(stages).toEqual(['rider_brief', 'driver_brief']);
    expect(abort).toHaveBeenCalledOnce();
  });
});
