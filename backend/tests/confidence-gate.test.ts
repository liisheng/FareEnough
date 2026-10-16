import { describe, expect, it } from 'vitest';
import { AUTOMATIC_CONFIDENCE_THRESHOLD, calculateConfidence, confidenceGateReasons } from '../src/decisions/confidence.js';
import { assessEvidenceConfidence } from '../src/decisions/evidence-confidence.js';
import { validateDecision } from '../src/decisions/validator.js';
import { validatePolicyProposal } from '../src/decisions/policy-validator.js';
import { loadReviewFixture } from '../src/policies/ryde-v21.js';
import { organizerContext, routeContext } from './helpers/confidence-context.js';

const proposal = { disposition: 'claim_rejected', action: 'uphold_fee', amountMinor: 0, currency: 'SGD', evidenceCitations: ['gps-005', 'gps-008'], policyCitations: ['ORG-NS-03'] };
const input = { caseId: 'DISP-002', proposal, waitingDuration: { value: 480, status: 'established' as const } };

describe('DEC-03/DEC-04 deterministic confidence gate', () => {
  it.each([0.84, 0.85, 0.86])('uses the inclusive 0.85 boundary for score %s', score => {
    const confidence = { ...calculateConfidence({ complete: true, corroboration: 'consistent', policyCoverage: 'complete', citationsValid: true }), score };
    expect(confidenceGateReasons(confidence)).toEqual(score < AUTOMATIC_CONFIDENCE_THRESHOLD ? ['CONFIDENCE_BELOW_THRESHOLD'] : []);
  });

  it.each([NaN, Infinity, -1, 1.01])('rejects an invalid score %s', score => {
    const confidence = { ...assessEvidenceConfidence(organizerContext().snapshot, true), score };
    expect(confidenceGateReasons(confidence)).toContain('CONFIDENCE_BELOW_THRESHOLD');
  });

  it('accepts exactly 0.85 from a disclosed, established nonmaterial warning', () => {
    const context = organizerContext();
    context.snapshot.evidence.find(record => record.id === 'derived_wait_duration')!.data = {
      ...context.snapshot.evidence.find(record => record.id === 'derived_wait_duration')!.data,
      warnings: ['Synthetic nonmaterial timestamp precision note; duration remains established.'],
    };
    const result = validateDecision(input, context);
    expect(result).toMatchObject({ status: 'validated', confidence: { score: 0.85, corroboration: 0.5, threshold: 0.85 } });
    expect(result.confidence.explanations.join(' ')).toContain('nonmaterial warning');
  });

  it('assesses complete evidence above the boundary and records versioned inputs', () => {
    const result = validateDecision(input, organizerContext());
    expect(result).toMatchObject({ status: 'validated', confidence: { score: 1, assessmentVersion: 'evidence-checklist-v1' } });
    expect(result.confidence.checks?.find(check => check.id === 'pickup-records')).toMatchObject({ passed: true, evidenceIds: expect.arrayContaining(['gps-005', 'gps-008']) });
  });

  it('fails closed when only a model proposal and calculated number are supplied', () => {
    expect(validateDecision(input)).toMatchObject({ status: 'human_review', amountMinor: 0, reasonCodes: expect.arrayContaining(['CONFIDENCE_BELOW_THRESHOLD', 'CONFIDENCE_MISSING_MATERIAL_EVIDENCE']) });
  });

  it('blocks an unknown citation even though the score is 0.90', () => {
    const result = validateDecision({ ...input, proposal: { ...proposal, evidenceCitations: ['invented'] } }, organizerContext());
    expect(result).toMatchObject({ status: 'human_review', amountMinor: 0, confidence: { score: 0.9 }, reasonCodes: expect.arrayContaining(['UNKNOWN_EVIDENCE_CITATION', 'CONFIDENCE_INVALID_CITATIONS']) });
  });

  it('blocks missing material records below 0.85 and preserves the proposed decision', () => {
    const context = organizerContext();
    context.snapshot.evidence = context.snapshot.evidence.filter(record => record.id !== 'evt-004');
    const result = validateDecision(input, context);
    expect(result).toMatchObject({ status: 'human_review', amountMinor: 0, proposal, confidence: { completeness: 0 } });
    expect(result.confidence.score).toBeLessThan(0.85);
    expect(result.confidence.checks?.find(check => check.id === 'derived:derived_wait_duration')?.passed).toBe(false);
  });

  it('blocks conflicting GPS rather than accepting a bare established wait', () => {
    const context = organizerContext();
    context.snapshot.evidence.find(record => record.id === 'gps-008')!.data = { lat: 0, lng: 0, speedKmh: 0 };
    expect(validateDecision(input, context)).toMatchObject({ status: 'human_review', amountMinor: 0, confidence: { corroboration: 0 }, reasonCodes: expect.arrayContaining(['CONFIDENCE_MATERIAL_CONFLICT']) });
  });

  it('does not count duplicated records as independent corroboration', () => {
    const context = organizerContext();
    context.snapshot.evidence = [...context.snapshot.evidence, structuredClone(context.snapshot.evidence[0])];
    expect(validateDecision(input, context).reasonCodes).toContain('CONFIDENCE_MISSING_MATERIAL_EVIDENCE');
  });

  it('blocks a missing selected-profile rule even if the Judge cites only available rules', () => {
    const context = organizerContext();
    context.snapshot.policyRules = context.snapshot.policyRules.filter(rule => rule.id !== 'ORG-NS-04');
    expect(validateDecision(input, context)).toMatchObject({ status: 'human_review', confidence: { policyCoverage: 0 }, reasonCodes: expect.arrayContaining(['CONFIDENCE_MISSING_POLICY_COVERAGE']) });
  });

  it('blocks a decision fact or case that disagrees with the assessed snapshot', () => {
    expect(validateDecision({ ...input, waitingDuration: { value: 481, status: 'established' } }, organizerContext()).reasonCodes).toContain('DECISION_FACT_CONFLICT');
    const context = organizerContext();
    context.snapshot.caseId = 'OTHER-CASE';
    expect(validateDecision(input, context).reasonCodes).toContain('CONFIDENCE_CONTEXT_MISMATCH');
  });

  it('cannot apply the organizer clock to a v2.1 snapshot with the same case ID', () => {
    const context = organizerContext();
    context.profileId = 'ryde-v2.1';
    expect(validateDecision(input, context).reasonCodes).toEqual(['UNSUPPORTED_POLICY_PROFILE']);
  });

  it.each(['payment-001', 'route-consent-001', 'gantry-coverage-001'])('route confidence requires %s', id => {
    const context = routeContext();
    context.snapshot.evidence = context.snapshot.evidence.filter(record => record.id !== id);
    const confidence = assessEvidenceConfidence(context.snapshot, true);
    expect(confidenceGateReasons(confidence).length).toBeGreaterThan(0);
  });

  it('rejects an altered paid total at the route corroboration check', () => {
    const context = routeContext();
    context.snapshot.evidence.find(record => record.id === 'payment-001')!.data = { paidMinor: 9999, priorReliefMinor: 0, currency: 'SGD' };
    expect(assessEvidenceConfidence(context.snapshot, true).corroboration).toBe(0);
  });

  it('does not replace v2.1 calibration or mandatory review with the rubric score', () => {
    const fixture = loadReviewFixture('DISP-003');
    const { evidenceIds, policyRuleIds } = fixture.assessment;
    const proposal = { outcome: 'reverse_fee', proposedAdjustmentCents: 450, explanation: 'Supplied fare and notification evidence supports the surge differential.', findings: [{ text: 'The recorded increase was not notified and the calculated difference is 450 cents.', evidenceIds, policyRuleIds }], evidenceIds, policyRuleIds, uncertainty: [] };
    const calibrationRequired = { ...fixture.assessment, outcome: 'human_review' as const, adjustmentCents: 0, reasonCodes: ['CALIBRATED_CONFIDENCE_UNAVAILABLE_OR_LOW'] };
    expect(validatePolicyProposal(fixture.snapshot, calibrationRequired, proposal)).toMatchObject({ status: 'human_review', amountMinor: 0, confidence: { score: 1 }, reasonCodes: expect.arrayContaining(['CALIBRATED_CONFIDENCE_UNAVAILABLE_OR_LOW', 'POLICY_REQUIRES_REVIEW']) });
  });

  it('applies the same gate to v2.1 when a calculation loses its source record', () => {
    const fixture = loadReviewFixture('DISP-003');
    const { evidenceIds, policyRuleIds } = fixture.assessment;
    const proposal = { outcome: 'reverse_fee', proposedAdjustmentCents: 450, explanation: 'The surge difference is 450 cents.', findings: [{ text: 'The records support the refund.', evidenceIds, policyRuleIds }], evidenceIds, policyRuleIds, uncertainty: [] };
    fixture.snapshot.evidence = fixture.snapshot.evidence.filter(record => record.id !== 'fare-001');
    expect(validatePolicyProposal(fixture.snapshot, fixture.assessment, proposal)).toMatchObject({ status: 'human_review', amountMinor: 0, reasonCodes: expect.arrayContaining(['CONFIDENCE_BELOW_THRESHOLD']) });
  });

  it.each(['gps', 'contact', 'fee'])('v2.1 no-show confidence checks raw %s records against stale derived facts', fault => {
    const fixture = loadReviewFixture('DISP-002');
    const record = fixture.snapshot.evidence.find(item => item.id === (fault === 'gps' ? 'gps-008' : fault === 'contact' ? 'chat-001' : 'trip-001'))!;
    record.data = fault === 'gps' ? { ...record.data, lat: 0 } : fault === 'contact' ? { ...record.data, sender: 'rider' } : { ...record.data, cancellationFee: 6 };
    expect(assessEvidenceConfidence(fixture.snapshot, true).corroboration).toBe(0);
  });

  it('v2.1 surge confidence does not trust a stale calculated total after the receipt changes', () => {
    const fixture = loadReviewFixture('DISP-003');
    const record = fixture.snapshot.evidence.find(item => item.id === 'trip-001')!;
    record.data = { ...record.data, actual_fare: 100 };
    expect(assessEvidenceConfidence(fixture.snapshot, true).corroboration).toBe(0);
  });
});
