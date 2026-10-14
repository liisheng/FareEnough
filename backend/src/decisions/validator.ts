import { z } from 'zod';
import { deriveOrganizerOutcome } from './organizer-policy.js';
import type {
  DecisionResult,
  DecisionValidationInput,
  HumanReviewDecision,
  JudgeProposal,
} from './types.js';

export const DISP002_EVIDENCE_IDS = new Set([
  'dispute-001',
  'trip-001',
  ...Array.from({ length: 8 }, (_, i) => `gps-${String(i + 1).padStart(3, '0')}`),
  ...Array.from({ length: 6 }, (_, i) => `chat-${String(i + 1).padStart(3, '0')}`),
  ...Array.from({ length: 10 }, (_, i) => `evt-${String(i + 1).padStart(3, '0')}`),
  'derived_wait_duration',
]);

export const DISP002_POLICY_RULE_IDS = new Set([
  'ORG-NS-01',
  'ORG-NS-02',
  'ORG-NS-03',
  'ORG-NS-04',
  'ORG-NS-05',
]);

const ProposalSchema = z.object({
  disposition: z.enum(['claim_upheld', 'claim_rejected']),
  action: z.enum(['reverse_fee', 'uphold_fee', 'none', 'human_review']),
  amountMinor: z.number().int().nonnegative(),
  currency: z.string(),
  evidenceCitations: z.array(z.string()).min(1),
  policyCitations: z.array(z.string()).min(1),
  rationale: z.string().optional(),
}).strict();

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function review(input: DecisionValidationInput, reasons: string[], proposal: unknown): HumanReviewDecision {
  const parsed = ProposalSchema.safeParse(proposal);
  return {
    status: 'human_review',
    caseId: input.caseId,
    disposition: null,
    action: 'human_review',
    amountMinor: 0,
    currency: 'SGD',
    evidenceCitations: parsed.success ? unique(parsed.data.evidenceCitations) : [],
    policyCitations: parsed.success ? unique(parsed.data.policyCitations) : [],
    reasonCodes: unique(reasons),
    proposal,
  };
}

/**
 * Treats model output as an untrusted proposal. Any malformed, uncited, or
 * deterministically inconsistent proposal is stopped for human review.
 */
export interface TrustedPolicyContext { profileId: string; evidenceIds: ReadonlySet<string> }
export function validateDecision(input: DecisionValidationInput, context?: TrustedPolicyContext): DecisionResult {
  if (input.caseId !== 'DISP-002' && context?.profileId !== 'organizer-disp002-v1') {
    return review(input, ['UNSUPPORTED_CASE'], input.proposal);
  }

  const parsed = ProposalSchema.safeParse(input.proposal);
  if (!parsed.success) {
    return review(input, ['INVALID_PROPOSAL_SCHEMA'], input.proposal);
  }

  const proposal: JudgeProposal = parsed.data;
  const reasons: string[] = [];
  const evidenceCitations = unique(proposal.evidenceCitations);
  const policyCitations = unique(proposal.policyCitations);

  if (evidenceCitations.some((id) => !(context?.evidenceIds ?? DISP002_EVIDENCE_IDS).has(id))) {
    reasons.push('UNKNOWN_EVIDENCE_CITATION');
  }
  if (policyCitations.some((id) => !DISP002_POLICY_RULE_IDS.has(id))) {
    reasons.push('UNKNOWN_POLICY_CITATION');
  }
  if (proposal.currency !== 'SGD') reasons.push('INVALID_CURRENCY');

  const deterministic = deriveOrganizerOutcome(input.waitingDuration);
  if (!deterministic) reasons.push('WAITING_DURATION_NOT_ESTABLISHED');

  if (deterministic) {
    if (proposal.disposition !== deterministic.disposition) reasons.push('DISPOSITION_CONFLICT');
    if (proposal.action !== deterministic.action) reasons.push('ACTION_CONFLICT');
    if (proposal.amountMinor !== deterministic.amountMinor) reasons.push('AMOUNT_CONFLICT');
  }

  // These invariants remain true even if a future policy evaluator changes.
  if (proposal.action === 'uphold_fee' && proposal.amountMinor !== 0) reasons.push('INVALID_UPHOLD_AMOUNT');
  if (proposal.action === 'reverse_fee' && proposal.amountMinor !== 500) reasons.push('INVALID_REVERSAL_AMOUNT');
  if (proposal.action === 'none' || proposal.action === 'human_review') reasons.push('INVALID_AUTOMATED_ACTION');

  if (reasons.length > 0 || !deterministic) return review(input, reasons, proposal);

  return {
    status: 'validated',
    caseId: input.caseId,
    disposition: deterministic.disposition,
    action: deterministic.action,
    amountMinor: deterministic.amountMinor,
    currency: 'SGD',
    evidenceCitations,
    policyCitations,
    reasonCodes: ['DETERMINISTIC_POLICY_MATCH'],
    proposal,
  };
}

/** Shape accepted directly from the bounded Judge agent. */
export interface AgentJudgeProposalInput {
  outcome: 'uphold_fee' | 'reverse_fee' | 'human_review';
  proposedAdjustmentCents: number;
  evidenceIds: string[];
  policyRuleIds: string[];
  explanation?: string;
  uncertainty?: string[];
}

/** Converts the agent contract into the untrusted proposal validated above. */
export function validateAgentJudgeProposal(
  caseId: string,
  proposal: AgentJudgeProposalInput,
  waitingDuration: DecisionValidationInput['waitingDuration'],
  context?: TrustedPolicyContext,
): DecisionResult {
  if (proposal.outcome === 'human_review' || (proposal.uncertainty?.length ?? 0) > 0) {
    return {
      status: 'human_review', caseId, disposition: null, action: 'human_review',
      amountMinor: 0, currency: 'SGD',
      evidenceCitations: unique(proposal.evidenceIds.filter((id) => (context?.evidenceIds ?? DISP002_EVIDENCE_IDS).has(id))),
      policyCitations: unique(proposal.policyRuleIds.filter((id) => DISP002_POLICY_RULE_IDS.has(id))),
      reasonCodes: [proposal.outcome === 'human_review' ? 'AGENT_REQUESTED_HUMAN_REVIEW' : 'AGENT_REPORTED_MATERIAL_UNCERTAINTY'],
      proposal,
    };
  }

  return validateDecision({
    caseId,
    waitingDuration,
    proposal: {
      disposition: proposal.outcome === 'uphold_fee' ? 'claim_rejected' : 'claim_upheld',
      action: proposal.outcome,
      amountMinor: proposal.proposedAdjustmentCents,
      currency: 'SGD',
      evidenceCitations: proposal.evidenceIds,
      policyCitations: proposal.policyRuleIds,
      rationale: proposal.explanation,
    },
  }, context);
}
