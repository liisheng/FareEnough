import { describe, expect, it } from 'vitest';
import { validateAgentJudgeProposal, validateDecision } from '../src/decisions/validator.js';

const validProposal = {
  disposition: 'claim_rejected' as const,
  action: 'uphold_fee' as const,
  amountMinor: 0,
  currency: 'SGD',
  evidenceCitations: ['gps-005', 'gps-008', 'evt-009'],
  policyCitations: ['ORG-NS-03', 'ORG-NS-05'],
  rationale: 'The established wait met the organizer threshold.',
};

const established480 = { value: 480, status: 'established' as const };

describe('deterministic decision validation', () => {
  it('validates the DISP-002 proposal only when it matches the 480-second policy result', () => {
    const result = validateDecision({
      caseId: 'DISP-002',
      proposal: validProposal,
      waitingDuration: established480,
    });

    expect(result.status).toBe('validated');
    expect(result.disposition).toBe('claim_rejected');
    expect(result.action).toBe('uphold_fee');
    expect(result.amountMinor).toBe(0);
  });

  it('hard-gates a model claim that conflicts with the deterministic policy outcome', () => {
    const result = validateDecision({
      caseId: 'DISP-002',
      proposal: {
        ...validProposal,
        disposition: 'claim_upheld',
        action: 'reverse_fee',
        amountMinor: 500,
      },
      waitingDuration: established480,
    });

    expect(result.status).toBe('human_review');
    expect(result.reasonCodes).toEqual(expect.arrayContaining([
      'DISPOSITION_CONFLICT',
      'ACTION_CONFLICT',
      'AMOUNT_CONFLICT',
    ]));
  });

  it('rejects hallucinated evidence and policy citations', () => {
    const result = validateDecision({
      caseId: 'DISP-002',
      proposal: {
        ...validProposal,
        evidenceCitations: ['gps-999'],
        policyCitations: ['MADE-UP-RULE'],
      },
      waitingDuration: established480,
    });

    expect(result.status).toBe('human_review');
    expect(result.reasonCodes).toContain('UNKNOWN_EVIDENCE_CITATION');
    expect(result.reasonCodes).toContain('UNKNOWN_POLICY_CITATION');
  });

  it('requires human review when the derived fact is uncertain', () => {
    const result = validateDecision({
      caseId: 'DISP-002',
      proposal: validProposal,
      waitingDuration: { value: 480, status: 'uncertain' },
    });

    expect(result.status).toBe('human_review');
    expect(result.reasonCodes).toContain('WAITING_DURATION_NOT_ESTABLISHED');
  });

  it('routes malformed model output to review rather than throwing', () => {
    const result = validateDecision({
      caseId: 'DISP-002',
      proposal: { answer: 'probably refund it' },
      waitingDuration: established480,
    });

    expect(result.status).toBe('human_review');
    expect(result.reasonCodes).toEqual(['INVALID_PROPOSAL_SCHEMA']);
  });

  it('derives a S$5 reversal below the 480-second threshold', () => {
    const result = validateDecision({
      caseId: 'DISP-002',
      proposal: {
        ...validProposal,
        disposition: 'claim_upheld',
        action: 'reverse_fee',
        amountMinor: 500,
      },
      waitingDuration: { value: 479, status: 'established' },
    });

    expect(result.status).toBe('validated');
    expect(result.action).toBe('reverse_fee');
    expect(result.amountMinor).toBe(500);
  });

  it('accepts the bounded Judge agent contract through the adapter', () => {
    const result = validateAgentJudgeProposal('DISP-002', {
      outcome: 'uphold_fee',
      proposedAdjustmentCents: 0,
      evidenceIds: ['dispute-001', 'gps-005', 'derived_wait_duration'],
      policyRuleIds: ['ORG-NS-03'],
      explanation: 'Operational evidence meets the configured threshold.',
    }, established480);

    expect(result.status).toBe('validated');
    expect(result.action).toBe('uphold_fee');
  });

  it('honours a Judge request for human review without an automated action', () => {
    const result = validateAgentJudgeProposal('DISP-002', {
      outcome: 'human_review',
      proposedAdjustmentCents: 0,
      evidenceIds: ['gps-005'],
      policyRuleIds: ['ORG-NS-03'],
    }, established480);

    expect(result.status).toBe('human_review');
    expect(result.reasonCodes).toContain('AGENT_REQUESTED_HUMAN_REVIEW');
    expect(result.evidenceCitations).toEqual(['gps-005']);
    expect(result.policyCitations).toEqual(['ORG-NS-03']);
  });

  it('blocks an automatic outcome when the Judge reports material uncertainty', () => {
    const result = validateAgentJudgeProposal('DISP-002', {
      outcome: 'uphold_fee', proposedAdjustmentCents: 0,
      evidenceIds: ['derived_wait_duration'], policyRuleIds: ['ORG-NS-03'],
      uncertainty: ['The decisive waiting evidence conflicts.'],
    }, established480);
    expect(result.status).toBe('human_review');
    expect(result.amountMinor).toBe(0);
  });

  it('validates only the exact deterministic route/ERP adjustment and normalized action', () => {
    const context={profileId:'demo-route-erp-v1',evidenceIds:new Set(['fare-erp-001','payment-001','gantry-coverage-001','derived_supported_adjustment']),policyRuleIds:new Set(['PUB-ERP-01','DEMO-ERP-01'])};
    const proposal={outcome:'refund_unsupported_charge' as const,proposedAdjustmentCents:325,evidenceIds:[...context.evidenceIds],policyRuleIds:[...context.policyRuleIds],explanation:'The paid unsupported line is capped at 325 cents.'};
    const valid=validateAgentJudgeProposal('CASE-ROUTE',proposal,{value:325,status:'established'},context);
    expect(valid).toMatchObject({status:'validated',contractDisposition:'claim_upheld',contractAction:'simulate_refund',feeTreatment:'not_applicable',amountMinor:325,confidence:{score:1}});
    const invalid=validateAgentJudgeProposal('CASE-ROUTE',{...proposal,proposedAdjustmentCents:326},{value:325,status:'established'},context);
    expect(invalid.status).toBe('human_review');
    expect(invalid.reasonCodes).toEqual(expect.arrayContaining(['AMOUNT_CONFLICT','INVALID_REVERSAL_AMOUNT']));
    const uncertain=validateAgentJudgeProposal('CASE-ROUTE',proposal,{value:325,status:'uncertain'},context);
    expect(uncertain).toMatchObject({status:'human_review',contractAction:'request_human_review',amountMinor:0});
  });
});
