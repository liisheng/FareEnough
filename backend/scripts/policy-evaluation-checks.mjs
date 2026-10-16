// Evaluation-only: never imported by the application or included in model inputs.
export const REVIEW_STAGES = ['rider_brief', 'driver_brief', 'rider_rebuttal', 'driver_rebuttal', 'judge'];

export function evaluateRunChecks(events, judge, decision, expected) {
  return {
    allFiveStages: REVIEW_STAGES
      .every(stage => events.some(event => event.stage === stage && event.status === 'completed')),
    expectedOutcome: judge.outcome === expected.outcome,
    expectedAmount: judge.proposedAdjustmentCents === expected.adjustmentCents,
    backendDisposition: decision.status === (expected.outcome === 'human_review' ? 'human_review' : 'validated'),
    validProposal: !decision.reasonCodes.some(code => /^(INVALID_|UNKNOWN_)|^(INCOMPLETE_CITATION_SUMMARY|POLICY_OUTCOME_CONFLICT|AMOUNT_CONFLICT)$/.test(code)),
  };
}

const allChecksPassed = checks => checks && Object.keys(checks).length > 0 && Object.values(checks).every(value => value === true);
const claimList = output => output?.findings ?? [...(output?.claims ?? []), ...(output?.adverseEvidence ?? [])];

/** Structural/citation checks cannot establish that the cited source supports the prose. */
export function evaluateStageChecks(artifacts, snapshot, contract = {}, schemas) {
  if (!schemas?.AdvocateBriefSchema || !schemas?.RebuttalSchema || !schemas?.JudgeProposalSchema) {
    throw Error('Stage evaluation requires the production output schemas.');
  }
  const suppliedEvidence = new Set(snapshot.evidence.map(item => item.id));
  const suppliedPolicy = new Set(snapshot.policyRules.map(item => item.id));
  return Object.fromEntries(REVIEW_STAGES.map(stage => {
    const output = artifacts[stage];
    const schema = stage === 'judge' ? schemas.JudgeProposalSchema
      : stage.endsWith('_brief') ? schemas.AdvocateBriefSchema : schemas.RebuttalSchema;
    const validation = schema.safeParse(output);
    const role = stage.startsWith('rider') ? 'rider_advocate' : 'driver_advocate';
    const checks = {
      artifactPresent: output !== undefined,
      schema: validation.success,
      role: output !== undefined && (stage === 'judge' || output?.role === role),
      onlySuppliedEvidenceIds: false,
      onlySuppliedPolicyIds: false,
    };
    const requirements = (contract.requiredSupportingCitations ?? []).filter(item => item.stages.includes(stage));
    for (const requirement of requirements) checks['supportingCitation_' + requirement.id] = false;
    let concessionChanges;
    if (validation.success) {
      const value = validation.data;
      const claims = claimList(value);
      checks.onlySuppliedEvidenceIds = [...claims.flatMap(claim => claim.evidenceIds), ...(value.evidenceIds ?? [])]
        .every(id => suppliedEvidence.has(id));
      checks.onlySuppliedPolicyIds = [...claims.flatMap(claim => claim.policyRuleIds), ...(value.policyRuleIds ?? [])]
        .every(id => suppliedPolicy.has(id));
      // A restriction in adverseEvidence alone does not support the advocate's conclusion.
      const supportingClaims = value.findings ?? value.claims;
      for (const requirement of requirements) {
        checks['supportingCitation_' + requirement.id] = supportingClaims.some(claim =>
          (requirement.anyEvidenceIds ?? [...suppliedEvidence]).some(id => claim.evidenceIds.includes(id)) &&
          requirement.policyRuleIds.every(id => claim.policyRuleIds.includes(id)));
      }
      if (stage.endsWith('_rebuttal')) {
        const own = artifacts[stage.replace('_rebuttal', '_brief')];
        const prior = own?.concessions ?? [];
        concessionChanges = {
          ownBriefAvailable: Array.isArray(own?.concessions),
          omittedFromOwnBrief: prior.filter(text => !value.preservedConcessions.includes(text)),
          addedSinceOwnBrief: value.preservedConcessions.filter(text => !prior.includes(text)),
          requiresSemanticReview: true,
        };
      }
    }
    return [stage, { checks, passed: allChecksPassed(checks), ...(concessionChanges ? { concessionChanges } : {}) }];
  }));
}

export function pendingStageSemanticReview() {
  return {
    status: 'pending',
    scope: 'Each stage requires a source-grounded audit; machine checks do not establish semantic correctness.',
    stages: Object.fromEntries(REVIEW_STAGES.map(stage => [stage, { status: 'pending', summary: '', issues: [] }])),
  };
}

/**
 * Use in a companion review artifact, leaving the original raw report immutable.
 * Semantic entries are {status, summary, issues:[{severity:'material'|'minor', text}]}.
 * A green outcome, citation coverage, or prose keyword match is never a semantic audit.
 */
export function evaluateOverallAcceptance(finalChecks, stageChecks, semanticReviews = {}) {
  const finalDecisionChecksPassed = Boolean(allChecksPassed(finalChecks));
  const failedStageContracts = REVIEW_STAGES.filter(stage => !allChecksPassed(stageChecks?.[stage]?.checks));
  const failedSemanticStages = REVIEW_STAGES.filter(stage => semanticReviews[stage]?.status === 'failed' ||
    (Array.isArray(semanticReviews[stage]?.issues) && semanticReviews[stage].issues.some(issue => issue?.severity === 'material')));
  const pendingSemanticStages = REVIEW_STAGES.filter(stage => {
    const review = semanticReviews[stage];
    return !failedSemanticStages.includes(stage) && (review?.status !== 'passed' ||
      typeof review.summary !== 'string' || review.summary.trim().length === 0 || !Array.isArray(review.issues) ||
      review.issues.some(issue => !['minor', 'material'].includes(issue?.severity) || typeof issue.text !== 'string' || !issue.text.trim()));
  });
  const status = !finalDecisionChecksPassed || failedStageContracts.length || failedSemanticStages.length
    ? 'failed' : pendingSemanticStages.length ? 'pending' : 'passed';
  return { status, finalDecisionChecksPassed, stageContractChecksPassed: failedStageContracts.length === 0,
    semanticReviewPassed: failedSemanticStages.length === 0 && pendingSemanticStages.length === 0,
    failedStageContracts, failedSemanticStages, pendingSemanticStages };
}
