import type { AgentStage, AdvocateBrief, JudgeProposal, Rebuttal } from '../agents/schemas.js';
import type { AgentEvidenceSnapshot } from '../tools/case-evidence-tools.js';

export type ProviderOutput = AdvocateBrief | Rebuttal | JudgeProposal;

export interface ModelProviderRequest {
  stage: AgentStage;
  conversationId: string;
  systemPrompt: string;
  evidence: AgentEvidenceSnapshot;
  priorOutputs: readonly ProviderOutput[];
}

/** Provider-neutral boundary. A future live adapter implements this contract. */
export interface ModelProvider {
  readonly id: string;
  readonly mode: 'replay' | 'live';
  generate(request: ModelProviderRequest): Promise<unknown>;
}
