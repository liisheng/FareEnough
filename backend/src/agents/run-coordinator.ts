import type { CaseEvidenceResponse } from '../schemas/api.js';
import type { ModelProvider, ProviderOutput } from '../providers/model-provider.js';
import { createCaseEvidenceTools, type CaseEvidenceTools } from '../tools/case-evidence-tools.js';
import { loadAgentPrompt } from './prompt-loader.js';
import {
  AdvocateBriefSchema,
  JudgeProposalSchema,
  RebuttalSchema,
  type AdvocateBrief,
  type JudgeProposal,
  type Rebuttal,
  type SafeAgentEvent,
  type AgentStage,
} from './schemas.js';

export interface AgentRunResult {
  runId: string;
  caseId: string;
  provider: { id: string; mode: 'replay' | 'live' };
  riderBrief: AdvocateBrief;
  driverBrief: AdvocateBrief;
  riderRebuttal: Rebuttal;
  driverRebuttal: Rebuttal;
  judgeProposal: JudgeProposal;
  events: SafeAgentEvent[];
}

export interface RunCoordinatorOptions {
  onEvent?: (event: SafeAgentEvent) => void | Promise<void>;
  runId?: string;
}

function assertGrounded(output: ProviderOutput, tools: CaseEvidenceTools): void {
  const claims = 'claims' in output ? output.claims : output.findings;
  const evidenceIds = [...claims.flatMap((claim) => claim.evidenceIds), ...('evidenceIds' in output ? output.evidenceIds : [])];
  const policyIds = [...claims.flatMap((claim) => claim.policyRuleIds), ...('policyRuleIds' in output ? output.policyRuleIds : [])];
  const invalidEvidence = [...new Set(evidenceIds.filter((id) => !tools.hasEvidence(id)))];
  const invalidPolicy = [...new Set(policyIds.filter((id) => !tools.hasPolicyRule(id)))];
  if (invalidEvidence.length || invalidPolicy.length) {
    throw new Error(`Ungrounded agent citations: evidence=[${invalidEvidence.join(',')}], policy=[${invalidPolicy.join(',')}]`);
  }
}

/** Executes exactly five bounded calls: two independent briefs, two rebuttals, one judge. */
export async function runThreeAgentReview(
  projection: CaseEvidenceResponse,
  provider: ModelProvider,
  options: RunCoordinatorOptions = {},
): Promise<AgentRunResult> {
  const tools = createCaseEvidenceTools(projection);
  const runId = options.runId ?? `run-${Date.now().toString(36)}`;
  const events: SafeAgentEvent[] = [];
  let sequence = 0;
  const emit = async (stage: AgentStage, status: SafeAgentEvent['status'], role: SafeAgentEvent['role'], message: string) => {
    const event = { sequence: ++sequence, stage, status, role, message } satisfies SafeAgentEvent;
    events.push(event);
    await options.onEvent?.(event);
  };
  const call = async <T extends ProviderOutput>(stage: AgentStage, role: SafeAgentEvent['role'], prompt: string, prior: readonly ProviderOutput[], parse: (value: unknown) => T): Promise<T> => {
    await emit(stage, 'started', role, `${role} started ${stage.replaceAll('_', ' ')}`);
    try {
      const value = parse(await provider.generate({ stage, conversationId: `${runId}:${stage}`, systemPrompt: prompt, evidence: tools.snapshot(), priorOutputs: prior }));
      assertGrounded(value, tools);
      await emit(stage, 'completed', role, `${role} completed ${stage.replaceAll('_', ' ')}`);
      return value;
    } catch (error) {
      await emit(stage, 'failed', role, `${role} failed ${stage.replaceAll('_', ' ')}`);
      throw error;
    }
  };

  const [riderPrompt, driverPrompt, judgePrompt] = await Promise.all([
    loadAgentPrompt('rider-advocate'), loadAgentPrompt('driver-advocate'), loadAgentPrompt('judge'),
  ]);

  // No prior output is supplied to either brief, preserving independent contexts.
  const [riderBrief, driverBrief] = await Promise.all([
    call('rider_brief', 'rider_advocate', riderPrompt, [], (v) => AdvocateBriefSchema.parse(v)),
    call('driver_brief', 'driver_advocate', driverPrompt, [], (v) => AdvocateBriefSchema.parse(v)),
  ]);
  const riderRebuttal = await call('rider_rebuttal', 'rider_advocate', riderPrompt, [driverBrief], (v) => RebuttalSchema.parse(v));
  const driverRebuttal = await call('driver_rebuttal', 'driver_advocate', driverPrompt, [riderBrief], (v) => RebuttalSchema.parse(v));
  const judgeProposal = await call('judge', 'judge', judgePrompt, [riderBrief, driverBrief, riderRebuttal, driverRebuttal], (v) => JudgeProposalSchema.parse(v));

  return { runId, caseId: projection.caseId, provider: { id: provider.id, mode: provider.mode }, riderBrief, driverBrief, riderRebuttal, driverRebuttal, judgeProposal, events };
}
