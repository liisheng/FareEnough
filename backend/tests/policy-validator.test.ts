import { describe, expect, it } from 'vitest';
import { validatePolicyProposal, type AssessedPolicyOutcome } from '../src/decisions/policy-validator.js';
import { loadReviewFixture } from '../src/policies/ryde-v21.js';

function proposal(outcome: AssessedPolicyOutcome['outcome'], amount: number, caseId = 'DISP-003') {
  const fixture = loadReviewFixture(caseId);
  const evidenceIds = fixture.assessment.evidenceIds;
  const policyRuleIds = fixture.assessment.policyRuleIds;
  return { outcome, proposedAdjustmentCents: amount,
    explanation: 'Proposal checked against supplied policy and calculated evidence.',
    findings: [{ text: 'The supplied evidence establishes the stated policy conditions.', evidenceIds, policyRuleIds }],
    evidenceIds, policyRuleIds, uncertainty: [] as string[] };
}

function citedSurgeProposal() {
  return {
    outcome: 'reverse_fee' as const, proposedAdjustmentCents: 450,
    explanation: 'The unnotified surge difference is refundable under the supplied policy.',
    findings: [
      { text: 'The app record shows no notification of the surge increase, triggering the refund rule.', evidenceIds: ['surge-001'], policyRuleIds: ['RYDE-V2.1-3.2', 'RYDE-V2.1-3.3'] },
      { text: 'The backend verified that the difference attributable solely to surge is 450 cents.', evidenceIds: ['derived-ryde-v21-surge'], policyRuleIds: ['RYDE-V2.1-3.4'] },
    ],
    evidenceIds: ['surge-001', 'derived-ryde-v21-surge'],
    policyRuleIds: ['RYDE-V2.1-3.2', 'RYDE-V2.1-3.3', 'RYDE-V2.1-3.4'], uncertainty: [],
  };
}

describe('selected-policy proposal validation', () => {
  it('allows the supported surge differential, not the full trip fare or fixed no-show amount', () => {
    const fixture = loadReviewFixture('DISP-003');
    expect(validatePolicyProposal(fixture.snapshot, fixture.assessment, proposal('reverse_fee', 450)))
      .toMatchObject({status:'validated',action:'reverse_fee',amountMinor:450});
    for (const amount of [500, 1650, 0]) {
      expect(validatePolicyProposal(fixture.snapshot, fixture.assessment, proposal('reverse_fee', amount)))
        .toMatchObject({status:'human_review',amountMinor:0,reasonCodes:expect.arrayContaining(['AMOUNT_CONFLICT'])});
    }
  });

  it('blocks a route refund when a category rule requires review, even if the reference refund amount matches', () => {
    const fixture = loadReviewFixture('DISP-001');
    expect(validatePolicyProposal(fixture.snapshot, fixture.assessment, proposal('reverse_fee',344,'DISP-001')))
      .toMatchObject({status:'human_review',amountMinor:0,reasonCodes:expect.arrayContaining(['POLICY_REQUIRES_REVIEW'])});
  });

  it('preserves model-reported uncertainty instead of coercing the reference outcome', () => {
    const fixture = loadReviewFixture('DISP-002');
    const uncertain = proposal('uphold_fee',0,'DISP-002');
    uncertain.uncertainty=['The required pickup location is materially disputed.'];
    expect(validatePolicyProposal(fixture.snapshot, fixture.assessment, uncertain))
      .toMatchObject({status:'human_review',reasonCodes:expect.arrayContaining(['AGENT_REPORTED_MATERIAL_UNCERTAINTY'])});
    expect(validatePolicyProposal(fixture.snapshot, fixture.assessment, proposal('human_review',0,'DISP-002')))
      .toMatchObject({status:'human_review',amountMinor:0});
  });

  it('rejects unknown and cross-profile citations, including finding-only citations', () => {
    const fixture = loadReviewFixture('DISP-003');
    const unknown = proposal('reverse_fee',450);
    unknown.findings[0].evidenceIds=[...unknown.evidenceIds,'invented-evidence'];
    expect(validatePolicyProposal(fixture.snapshot,fixture.assessment,unknown).reasonCodes).toContain('UNKNOWN_EVIDENCE_CITATION');
    const legacy = proposal('reverse_fee',450);
    legacy.policyRuleIds=['ORG-NS-05'];
    expect(validatePolicyProposal(fixture.snapshot,fixture.assessment,legacy).reasonCodes).toContain('UNKNOWN_POLICY_CITATION');
  });

  it('rejects extra fields and missing top-level finding citations', () => {
    const fixture=loadReviewFixture('DISP-003');
    expect(validatePolicyProposal(fixture.snapshot,fixture.assessment,{...proposal('reverse_fee',450),executed:true}).reasonCodes)
      .toContain('INVALID_PROPOSAL_SCHEMA');
    const incomplete=proposal('reverse_fee',450);
    incomplete.evidenceIds=incomplete.evidenceIds.slice(1);
    expect(validatePolicyProposal(fixture.snapshot,fixture.assessment,incomplete).reasonCodes).toContain('INCOMPLETE_CITATION_SUMMARY');
  });

  it('does not validate the right amount justified only by a GPS fix and an unrelated threshold rule', () => {
    const fixture = loadReviewFixture('DISP-003');
    const uncited = { ...citedSurgeProposal(), findings: [{ text: 'The vehicle was at the pickup coordinates.', evidenceIds: ['gps-001'], policyRuleIds: [] }], evidenceIds: ['gps-001'], policyRuleIds: ['RYDE-V2.1-6.1'] };
    expect(validatePolicyProposal(fixture.snapshot, fixture.assessment, uncited))
      .toMatchObject({ status: 'human_review', amountMinor: 0, reasonCodes: expect.arrayContaining(['MISSING_POLICY_GROUNDING', 'UNCITED_VERIFIED_MONETARY_AMOUNT']) });
  });

  it('requires the refund amount to be cited in a finding, not merely present in the input', () => {
    const fixture = loadReviewFixture('DISP-003');
    const uncited = citedSurgeProposal();
    uncited.findings = uncited.findings.slice(0, 1);
    uncited.evidenceIds = ['surge-001'];
    uncited.policyRuleIds = ['RYDE-V2.1-3.2', 'RYDE-V2.1-3.3'];
    expect(validatePolicyProposal(fixture.snapshot, fixture.assessment, uncited).reasonCodes).toContain('UNCITED_VERIFIED_MONETARY_AMOUNT');
  });

  it('requires a cited rule applicable to the independently established policy grounds', () => {
    const fixture = loadReviewFixture('DISP-003');
    const unrelated = citedSurgeProposal();
    unrelated.findings.forEach(finding => { finding.policyRuleIds = ['RYDE-V2.1-6.1']; });
    unrelated.policyRuleIds = ['RYDE-V2.1-6.1'];
    expect(validatePolicyProposal(fixture.snapshot, fixture.assessment, unrelated).reasonCodes).toContain('MISSING_POLICY_GROUNDING');
  });

  it.each(['evidenceIds', 'policyRuleIds'] as const)('rejects uncited extra IDs in the top-level %s summary', field => {
    const fixture = loadReviewFixture('DISP-003');
    const extra = citedSurgeProposal();
    extra[field].push(field === 'evidenceIds' ? 'gps-001' : 'RYDE-V2.1-5.1');
    expect(validatePolicyProposal(fixture.snapshot, fixture.assessment, extra).reasonCodes).toContain('EXTRANEOUS_CITATION_SUMMARY');
  });

  it.each(['evidenceIds', 'policyRuleIds'] as const)('requires a unique union in top-level %s', field => {
    const fixture = loadReviewFixture('DISP-003');
    const duplicate = citedSurgeProposal();
    duplicate[field].push(duplicate[field][0]);
    expect(validatePolicyProposal(fixture.snapshot, fixture.assessment, duplicate).reasonCodes).toContain('DUPLICATE_CITATION_SUMMARY');
  });

  it('accepts a complete cited proposal regardless of citation order without mutating the response', () => {
    const fixture = loadReviewFixture('DISP-003');
    const complete = citedSurgeProposal();
    complete.evidenceIds.reverse();
    complete.policyRuleIds.reverse();
    const before = structuredClone(complete);
    expect(validatePolicyProposal(fixture.snapshot, fixture.assessment, complete))
      .toMatchObject({ status: 'validated', amountMinor: 450 });
    expect(complete).toEqual(before);
  });

  it.each(['raw_record', 'wrong_amount', 'missing_sources', 'unknown_source'] as const)('rejects monetary evidence without valid backend calculation provenance: %s', fault => {
    const fixture = loadReviewFixture('DISP-003');
    const monetary = fixture.snapshot.evidence.find(item => item.id === 'derived-ryde-v21-surge')!;
    if (fault === 'raw_record') monetary.kind = 'trip';
    else if (fault === 'wrong_amount') monetary.data = { ...monetary.data, fareDifferenceCents: 451 };
    else if (fault === 'missing_sources') monetary.data = { ...monetary.data, sourceEvidenceIds: [] };
    else monetary.data = { ...monetary.data, sourceEvidenceIds: ['unavailable-source'] };
    expect(validatePolicyProposal(fixture.snapshot, fixture.assessment, citedSurgeProposal()))
      .toMatchObject({ status: 'human_review', amountMinor: 0, reasonCodes: expect.arrayContaining(['UNCITED_VERIFIED_MONETARY_AMOUNT']) });
  });

  it('recognizes eligible monetary facts by their meaning, not fixture case or evidence identifiers', () => {
    const fixture = loadReviewFixture('DISP-003');
    fixture.snapshot.caseId = 'generated-case';
    const monetary = fixture.snapshot.evidence.find(item => item.id === 'derived-ryde-v21-surge')!;
    monetary.id = 'computed-fare-difference';
    const renamed = citedSurgeProposal();
    renamed.findings[1].evidenceIds = ['computed-fare-difference'];
    renamed.evidenceIds = ['surge-001', 'computed-fare-difference'];
    expect(validatePolicyProposal(fixture.snapshot, fixture.assessment, renamed))
      .toMatchObject({ status: 'validated', caseId: 'generated-case', amountMinor: 450 });
  });
});
