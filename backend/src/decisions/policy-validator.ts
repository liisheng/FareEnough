import { JudgeProposalSchema } from '../agents/schemas.js';
import type { AgentEvidenceSnapshot, EvidenceRecord } from '../tools/case-evidence-tools.js';
import type { DecisionResult } from './types.js';
import { confidenceGateReasons } from './confidence.js';
import { assessEvidenceConfidence } from './evidence-confidence.js';

export interface AssessedPolicyOutcome {
  outcome: 'uphold_fee' | 'reverse_fee' | 'human_review';
  adjustmentCents: number;
  evidenceIds: string[];
  policyRuleIds: string[];
  reasonCodes: string[];
}

/** Semantic amount fields emitted by the backend calculation layer, not model text. */
const reversalAmountFields = ['recordedFeeCents', 'fareDifferenceCents', 'excessDistanceFareCents'] as const;

function establishesReversalAmount(record: EvidenceRecord, amountCents: number, knownEvidence: Set<string>): boolean {
  if (record.kind !== 'derived_fact' || !Number.isSafeInteger(amountCents) || amountCents <= 0) return false;
  const sources = record.data.sourceEvidenceIds;
  if (!Array.isArray(sources) || sources.length === 0 || sources.some(id => typeof id !== 'string' || id === record.id || !knownEvidence.has(id))) return false;
  if (typeof record.data.calculation !== 'string' || !record.data.calculation.trim()) return false;
  return reversalAmountFields.some(field => record.data[field] === amountCents);
}

/** Validate against the selected policy, never against an evaluation answer key. */
export function validatePolicyProposal(
  snapshot: AgentEvidenceSnapshot,
  assessment: AssessedPolicyOutcome,
  rawProposal: unknown,
): DecisionResult {
  const parsed = JudgeProposalSchema.safeParse(rawProposal);
  const evidence = new Set(snapshot.evidence.map((item) => item.id));
  const rules = new Set(snapshot.policyRules.map((item) => item.id));
  const reasons: string[] = [];
  const proposal = parsed.success ? parsed.data : undefined;
  if (!proposal) reasons.push('INVALID_PROPOSAL_SCHEMA');
  if (proposal) {
    const findingEvidence = new Set(proposal.findings.flatMap(item => item.evidenceIds));
    const findingRules = new Set(proposal.findings.flatMap(item => item.policyRuleIds));
    const citedEvidence = [...proposal.evidenceIds, ...findingEvidence];
    const citedRules = [...proposal.policyRuleIds, ...findingRules];
    if (citedEvidence.some((id) => !evidence.has(id))) reasons.push('UNKNOWN_EVIDENCE_CITATION');
    if (citedRules.some((id) => !rules.has(id))) reasons.push('UNKNOWN_POLICY_CITATION');
    if ([...findingEvidence].some(id => !proposal.evidenceIds.includes(id))
      || [...findingRules].some(id => !proposal.policyRuleIds.includes(id))) reasons.push('INCOMPLETE_CITATION_SUMMARY');
    if (proposal.evidenceIds.some(id => !findingEvidence.has(id))
      || proposal.policyRuleIds.some(id => !findingRules.has(id))) reasons.push('EXTRANEOUS_CITATION_SUMMARY');
    if (new Set(proposal.evidenceIds).size !== proposal.evidenceIds.length
      || new Set(proposal.policyRuleIds).size !== proposal.policyRuleIds.length) reasons.push('DUPLICATE_CITATION_SUMMARY');
    // A matching enum/amount is not a cited explanation. At least one finding
    // must connect case evidence to a rule the policy assessment actually uses.
    if (!proposal.findings.some(item => item.evidenceIds.some(id => evidence.has(id))
      && item.policyRuleIds.some(id => rules.has(id) && assessment.policyRuleIds.includes(id)))) reasons.push('MISSING_POLICY_GROUNDING');
    if (proposal.outcome === 'reverse_fee' && !snapshot.evidence.some(item => findingEvidence.has(item.id)
      && establishesReversalAmount(item, proposal.proposedAdjustmentCents, evidence))) reasons.push('UNCITED_VERIFIED_MONETARY_AMOUNT');
    if (proposal.outcome === 'human_review') reasons.push('AGENT_REQUESTED_HUMAN_REVIEW');
    if (proposal.uncertainty.length) reasons.push('AGENT_REPORTED_MATERIAL_UNCERTAINTY');
    if (proposal.outcome !== assessment.outcome) reasons.push('POLICY_OUTCOME_CONFLICT');
    if (proposal.proposedAdjustmentCents !== assessment.adjustmentCents) reasons.push('AMOUNT_CONFLICT');
  }
  if (assessment.outcome === 'human_review') reasons.push(...assessment.reasonCodes, 'POLICY_REQUIRES_REVIEW');
  if (!Number.isSafeInteger(assessment.adjustmentCents) || assessment.adjustmentCents < 0
    || (assessment.outcome !== 'reverse_fee' && assessment.adjustmentCents !== 0)) reasons.push('INVALID_POLICY_ASSESSMENT');
  const evidenceCitations = [...new Set((proposal?.evidenceIds ?? []).filter((id) => evidence.has(id)))];
  const policyCitations = [...new Set((proposal?.policyRuleIds ?? []).filter((id) => rules.has(id)))];
  const confidence = assessEvidenceConfidence(snapshot, !!proposal && !reasons.some(reason => /CITATION|GROUNDING|UNCITED/.test(reason)));
  reasons.push(...confidenceGateReasons(confidence));
  if (reasons.length || !proposal || assessment.outcome === 'human_review') {
    return {
      status: 'human_review', caseId: snapshot.caseId, disposition: null, action: 'human_review',
      amountMinor: 0, currency: 'SGD', evidenceCitations, policyCitations,
      reasonCodes: [...new Set(reasons)], proposal: rawProposal,
      contractDisposition: 'needs_review', contractAction: 'request_human_review', feeTreatment: 'undetermined',
      confidence,
    };
  }
  const disposition = assessment.outcome === 'uphold_fee' ? 'claim_rejected' : 'claim_upheld';
  return {
    status: 'validated', caseId: snapshot.caseId, disposition, action: assessment.outcome,
    amountMinor: assessment.adjustmentCents, currency: 'SGD', evidenceCitations, policyCitations,
    reasonCodes: ['SELECTED_POLICY_MATCH', ...assessment.reasonCodes],
    contractDisposition: disposition,
    contractAction: assessment.outcome === 'uphold_fee' ? 'no_change' : 'simulate_refund',
    feeTreatment: assessment.outcome === 'uphold_fee' ? 'upheld' : 'reversed',
    confidence,
    proposal: { disposition, action: assessment.outcome, amountMinor: proposal.proposedAdjustmentCents,
      currency: 'SGD', evidenceCitations, policyCitations, rationale: proposal.explanation },
  };
}
