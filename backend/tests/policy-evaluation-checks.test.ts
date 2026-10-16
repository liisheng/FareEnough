import { describe, expect, it } from 'vitest';
import { evaluateRunChecks, evaluateStageChecks, pendingStageSemanticReview, evaluateOverallAcceptance, REVIEW_STAGES } from '../scripts/policy-evaluation-checks.mjs';
import * as schemas from '../src/agents/schemas.js';
import { readFileSync } from 'node:fs';

const events = ['rider_brief', 'driver_brief', 'rider_rebuttal', 'driver_rebuttal', 'judge']
  .map(stage => ({ stage, status: 'completed' }));
const proposal = { outcome: 'human_review', proposedAdjustmentCents: 0 };
const expected = { outcome: 'human_review', adjustmentCents: 0 };

describe('live policy evaluation checks', () => {
  it('does not count validation failures as a successful expected human review', () => {
    for (const reason of ['INCOMPLETE_CITATION_SUMMARY', 'UNKNOWN_POLICY_CITATION', 'INVALID_PROPOSAL_SCHEMA', 'INVALID_POLICY_ASSESSMENT', 'AMOUNT_CONFLICT', 'POLICY_OUTCOME_CONFLICT']) {
      const checks = evaluateRunChecks(events, proposal, { status: 'human_review', reasonCodes: [reason] }, expected);
      expect(checks.expectedOutcome).toBe(true);
      expect(checks.backendDisposition).toBe(true);
      expect(checks.validProposal).toBe(false);
    }
  });

  it('accepts a fully completed review required by the selected policy', () => {
    const checks = evaluateRunChecks(events, proposal, { status: 'human_review', reasonCodes: ['AGENT_REQUESTED_HUMAN_REVIEW', 'ROUTE_DEVIATION_EXCEEDS_2KM', 'POLICY_REQUIRES_REVIEW'] }, expected);
    expect(Object.values(checks).every(Boolean)).toBe(true);
  });

  it('requires every distinct stage rather than five duplicate events', () => {
    const checks = evaluateRunChecks(Array(5).fill(events[0]), proposal, { status: 'human_review', reasonCodes: [] }, expected);
    expect(checks.allFiveStages).toBe(false);
  });
});

// Preserve coverage of the later strict experiment independently of the restored baseline.
const suite = JSON.parse(readFileSync(new URL('../../eval/experiments/checkpoint-successor/ryde-v21-suite.json', import.meta.url), 'utf8'));
const routeContract = suite.cases.find((item: {caseId: string}) => item.caseId === 'DISP-001').stageContract;
const snapshot = {
  evidence: [{ id: 'derived-ryde-v21-distance' }, { id: 'trip-001' }, { id: 'chat-001' }],
  policyRules: [{ id: 'RYDE-V2.1-6.2' }, { id: 'RYDE-V2.1-1.2' }, { id: 'RYDE-V2.1-7.1' }],
};
const distanceClaim = () => ({ text: 'The supplied 4.3 km deviation exceeds the 2 km automation limit and requires review.', evidenceIds: ['derived-ryde-v21-distance'], policyRuleIds: ['RYDE-V2.1-6.2'] });
const routeArtifacts = () => {
  const brief = (role: string) => ({ role, position: 'Human review is required.', claims: [distanceClaim()], adverseEvidence: [] as ReturnType<typeof distanceClaim>[], concessions: ['The traffic evidence supports rerouting.'], unansweredQuestions: [] });
  const rebuttal = (role: string) => ({ role, response: 'Human review is required.', challengedClaim: 'The low amount permits automatic determination.', claims: [distanceClaim()], preservedConcessions: ['The traffic evidence supports rerouting.'] });
  return {
    rider_brief: brief('rider_advocate'), driver_brief: brief('driver_advocate'),
    rider_rebuttal: rebuttal('rider_advocate'), driver_rebuttal: rebuttal('driver_advocate'),
    judge: { ...proposal, explanation: 'The category restriction requires review.', findings: [distanceClaim(), { text: 'Unlike the 1.8 km precedent, the current 4.3 km distance exceeds the category automation limit.', evidenceIds: ['derived-ryde-v21-distance'], policyRuleIds: ['RYDE-V2.1-6.2', 'RYDE-V2.1-7.1'] }], evidenceIds: ['derived-ryde-v21-distance'], policyRuleIds: ['RYDE-V2.1-6.2', 'RYDE-V2.1-7.1'], uncertainty: [] },
  };
};
const greenFinalChecks = () => evaluateRunChecks(events, proposal, { status: 'human_review', reasonCodes: [] }, expected);
const checkedStages = (artifacts = routeArtifacts()) => evaluateStageChecks(artifacts, snapshot, routeContract, schemas);
const reviewedStages = () => Object.fromEntries(REVIEW_STAGES.map((stage: string) => [stage, { status: 'passed', summary: 'Reviewed source facts, attribution, applicable restrictions, conclusion and concessions.', issues: [] }]));

describe('all-stage sample evaluation', () => {
  it('rejects a missing advocate even when every final-decision check passes', () => {
    const artifacts: Partial<ReturnType<typeof routeArtifacts>> = routeArtifacts();
    delete artifacts.rider_brief;
    const stages = evaluateStageChecks(artifacts, snapshot, routeContract, schemas);
    expect(greenFinalChecks()).toEqual(expect.objectContaining({ expectedOutcome: true, validProposal: true }));
    expect(stages.rider_brief.checks.artifactPresent).toBe(false);
    expect(evaluateOverallAcceptance(greenFinalChecks(), stages, reviewedStages())).toMatchObject({ status: 'failed', failedStageContracts: ['rider_brief'] });
  });

  it('checks schema, roles, and supplied identifiers for each advocate stage', () => {
    const artifacts = routeArtifacts();
    artifacts.rider_brief.role = 'driver_advocate';
    artifacts.driver_brief.claims[0].evidenceIds = [];
    artifacts.rider_rebuttal.claims[0].evidenceIds.push('OTHER-CASE-E1');
    artifacts.driver_rebuttal.claims[0].policyRuleIds.push('INVENTED-POLICY');
    const stages = checkedStages(artifacts);
    expect(stages.rider_brief.checks.role).toBe(false);
    expect(stages.driver_brief.checks.schema).toBe(false);
    expect(stages.rider_rebuttal.checks.onlySuppliedEvidenceIds).toBe(false);
    expect(stages.driver_rebuttal.checks.onlySuppliedPolicyIds).toBe(false);
    expect(stages.judge.passed).toBe(true);
  });

  it('does not count a route restriction buried only in adverse evidence as support for the position', () => {
    const artifacts = routeArtifacts();
    artifacts.rider_brief.position = 'The rider is entitled to the refund.';
    artifacts.rider_brief.adverseEvidence = [distanceClaim()];
    artifacts.rider_brief.claims = [{ text: 'The supplied chat has no specific reason for the deviation.', evidenceIds: ['chat-001'], policyRuleIds: ['RYDE-V2.1-1.2'] }];
    const stages = checkedStages(artifacts);
    expect(stages.rider_brief.checks.schema).toBe(true);
    expect(stages.rider_brief.checks.onlySuppliedEvidenceIds).toBe(true);
    expect(stages.rider_brief.checks.supportingCitation_mandatory_route_review).toBe(false);
    expect(stages.judge.passed).toBe(true);
  });

  it('requires the restriction and distance citation together, without prescribing prose or one exact evidence ID', () => {
    const artifacts = routeArtifacts();
    artifacts.driver_brief.claims = [
      { text: 'Route distances are recorded.', evidenceIds: ['trip-001'], policyRuleIds: [] },
      { text: 'The driver sent a message.', evidenceIds: ['chat-001'], policyRuleIds: ['RYDE-V2.1-6.2'] },
    ];
    expect(checkedStages(artifacts).driver_brief.checks.supportingCitation_mandatory_route_review).toBe(false);
    artifacts.driver_brief.claims[0].policyRuleIds = ['RYDE-V2.1-6.2'];
    expect(checkedStages(artifacts).driver_brief.checks.supportingCitation_mandatory_route_review).toBe(true);
    // Whether that prose actually applies the rule remains a semantic judgment.
  });

  it('records changed concessions for review without prohibiting an explained correction', () => {
    const artifacts = routeArtifacts();
    artifacts.driver_brief.concessions = ['Generic reassurance proves notification.'];
    artifacts.driver_rebuttal.preservedConcessions = ['The message provides generic reassurance.'];
    const stages = checkedStages(artifacts);
    expect(stages.driver_rebuttal.passed).toBe(true);
    expect(stages.driver_rebuttal.concessionChanges).toEqual({ ownBriefAvailable: true, omittedFromOwnBrief: ['Generic reassurance proves notification.'], addedSinceOwnBrief: ['The message provides generic reassurance.'], requiresSemanticReview: true });
  });

  it('requires the judge to compare the supplied precedent with current-case evidence', () => {
    const artifacts = routeArtifacts();
    artifacts.judge.findings = [distanceClaim()];
    expect(checkedStages(artifacts).judge.checks.supportingCitation_relevant_precedent).toBe(false);
    artifacts.judge.findings.push({ text: 'A previous case was refunded.', evidenceIds: ['OTHER-CASE-E1'], policyRuleIds: ['RYDE-V2.1-7.1'] });
    expect(checkedStages(artifacts).judge.checks.supportingCitation_relevant_precedent).toBe(false);
    artifacts.judge.findings[1].evidenceIds = ['trip-001'];
    expect(checkedStages(artifacts).judge.checks.supportingCitation_relevant_precedent).toBe(true);
    // Citation pairing is checkable; the adequacy of the comparison requires review.
  });

  it('does not mutate the incident snapshot or attach evaluator expectations to it', () => {
    const before = JSON.stringify(snapshot);
    checkedStages();
    expect(JSON.stringify(snapshot)).toBe(before);
    expect(snapshot).not.toHaveProperty('stageContract');
    expect(snapshot).not.toHaveProperty('expected');
  });
});

describe('reviewed sample acceptance', () => {
  it('keeps internally contradictory prose pending despite green machine checks', () => {
    const artifacts = routeArtifacts();
    artifacts.rider_brief.position = 'Human review is required, and the rider is entitled to an automatic refund.';
    const stages = checkedStages(artifacts);
    expect(stages.rider_brief.passed).toBe(true);
    const review = pendingStageSemanticReview();
    const acceptance = evaluateOverallAcceptance(greenFinalChecks(), stages, review.stages);
    expect(acceptance).toMatchObject({ status: 'pending', finalDecisionChecksPassed: true, stageContractChecksPassed: true, semanticReviewPassed: false });
    expect(acceptance.pendingSemanticStages).toEqual(REVIEW_STAGES);
  });

  it('cannot hide a material advocate failure behind a correct judge or a passed audit label', () => {
    const reviews = reviewedStages();
    reviews.rider_brief = { status: 'passed', summary: 'Correct citations but contradictory refund entitlement.', issues: [{ severity: 'material', text: 'Position contradicts the mandatory review restriction.' }] };
    expect(evaluateOverallAcceptance(greenFinalChecks(), checkedStages(), reviews)).toMatchObject({ status: 'failed', failedSemanticStages: ['rider_brief'] });
  });

  it('requires explicit substantive audit entries for all five stages', () => {
    const reviews = reviewedStages();
    reviews.driver_rebuttal.summary = '';
    expect(evaluateOverallAcceptance(greenFinalChecks(), checkedStages(), reviews)).toMatchObject({ status: 'pending', pendingSemanticStages: ['driver_rebuttal'] });
    delete reviews.driver_rebuttal;
    expect(evaluateOverallAcceptance(greenFinalChecks(), checkedStages(), reviews).status).toBe('pending');
    expect(evaluateOverallAcceptance(greenFinalChecks(), checkedStages(), reviewedStages()).status).toBe('passed');
  });

  it('keeps a real backend failure red even with positive semantic reviews', () => {
    expect(evaluateOverallAcceptance({ ...greenFinalChecks(), validProposal: false }, checkedStages(), reviewedStages()).status).toBe('failed');
  });
});
