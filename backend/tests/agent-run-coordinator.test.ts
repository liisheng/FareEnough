import { describe, expect, it } from 'vitest';
import { loadDisp002Fixture } from '../src/fixtures/loader.js';
import { projectCaseEvidence } from '../src/projections/case-projection.js';
import { runThreeAgentReview } from '../src/agents/run-coordinator.js';
import { ReplayModelProvider } from '../src/providers/replay-provider.js';
import type { ModelProvider, ModelProviderRequest } from '../src/providers/model-provider.js';

describe('three-agent coordinator', () => {
  it('runs independent briefs, one rebuttal each, then the judge with observable events', async () => {
    const requests: ModelProviderRequest[] = [];
    const replay = new ReplayModelProvider();
    const provider: ModelProvider = { id: replay.id, mode: replay.mode, async generate(request) { requests.push(request); return replay.generate(request); } };
    const result = await runThreeAgentReview(projectCaseEvidence(loadDisp002Fixture()), provider, { runId: 'test-run' });

    expect(requests.map((r) => r.stage)).toEqual(['rider_brief', 'driver_brief', 'rider_rebuttal', 'driver_rebuttal', 'judge']);
    expect(requests[0].priorOutputs).toEqual([]);
    expect(requests[1].priorOutputs).toEqual([]);
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
});
