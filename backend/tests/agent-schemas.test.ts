import { describe, expect, it } from 'vitest';
import { AdvocateBriefSchema, CitedClaimSchema, JudgeProposalSchema, RebuttalSchema } from '../src/agents/schemas.js';

const missingPolicyIds = { text: 'The record documents a contact attempt.', evidenceIds: ['record-1'] };
const factualClaim = { ...missingPolicyIds, policyRuleIds: [] };

describe('strict agent citation fields', () => {
  it('rejects an omitted policyRuleIds field rather than filling it in', () => {
    expect(CitedClaimSchema.safeParse(missingPolicyIds).success).toBe(false);
  });
  it('continues to accept an explicit empty array for a purely factual claim unchanged', () => {
    expect(CitedClaimSchema.parse(factualClaim)).toEqual(factualClaim);
  });
  it.each(['claims', 'adverseEvidence'] as const)('rejects missing citation fields inside brief %s', field => {
    const brief = { role: 'rider_advocate', position: 'A supported position.', claims: [factualClaim], adverseEvidence: [factualClaim], concessions: [], unansweredQuestions: [], [field]: [missingPolicyIds] };
    expect(AdvocateBriefSchema.safeParse(brief).success).toBe(false);
  });
  it('rejects a rebuttal with an omitted policy citation field', () => {
    expect(RebuttalSchema.safeParse({ role: 'driver_advocate', response: 'A response.', challengedClaim: 'An argument.', claims: [missingPolicyIds], preservedConcessions: [] }).success).toBe(false);
  });
  it('rejects a Judge finding with an omitted policy citation field', () => {
    expect(JudgeProposalSchema.safeParse({ outcome: 'human_review', explanation: 'A required condition is unresolved.', findings: [missingPolicyIds], evidenceIds: ['record-1'], policyRuleIds: ['policy-1'], proposedAdjustmentCents: 0, uncertainty: ['A material gap.'] }).success).toBe(false);
  });
});
