import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, root), 'utf8'));
const claim = (text, evidenceIds, policyRuleIds = []) => ({ text, evidenceIds, policyRuleIds });
const brief = (role, position, claims, concessions = []) => ({ role, position, claims, adverseEvidence: [], concessions, unansweredQuestions: [] });
const rebuttal = (role, response, claims, preservedConcessions = []) => ({ role, response, challengedClaim: 'The opposing account and the recorded waiting period.', claims, preservedConcessions });
const stageOf = prompt => /^stage:\s*(\w+)/m.exec(prompt)?.[1];
const idsIn = prompt => ({
  evidenceIds: [...new Set([...prompt.matchAll(/^[- ]*([A-Z]+-E\d+):/gm)].map(match => match[1]))],
  policyIds: [...new Set([...prompt.matchAll(/^[- ]*([A-Z]+-P\d+):/gm)].map(match => match[1]))],
});
const raw = (stage, caseId, policy, evidence, submissions) => [
  `stage: ${stage}`, `caseId: ${caseId}`, '', 'Applicable test policy:',
  ...Object.entries(policy).map(([id, text]) => `- ${id}: ${text}`), '', 'Evidence:',
  ...Object.entries(evidence).map(([id, text]) => `- ${id}: ${text}`), '',
  'Advocate submissions (arguments, not independent incident evidence):', JSON.stringify(submissions, null, 2),
].join('\n');

/** Test expectations never become part of the prompt sent to a provider. */
export function loadPromptRegressionCases() {
  const manual = read('eval/adp-manual-tests.json');
  const judge = read('eval/adp-judge-test-results.json');
  const cases = [];
  for (const entry of manual.tests) {
    const stage = stageOf(entry.prompt);
    const legacyRebuttal = stage.endsWith('_rebuttal');
    const missing = entry.id.includes('missing-input');
    cases.push({ id: entry.id, stage, prompt: entry.prompt,
      source: 'eval/adp-manual-tests.json', fidelity: 'original_prompt_verbatim',
      compatibilityNote: legacyRebuttal ? 'Original standalone rebuttal input requests valid concessions without supplying an own prior brief. Supported opposing facts may be acknowledged, but invented prior history is not allowed. An augmented vector additionally tests preservation when an own brief is supplied.' : null,
      historicalFormat: entry.expected.format,
      expected: { format: missing ? 'plain' : legacyRebuttal ? 'rebuttal' : 'brief', role: entry.role, ...idsIn(entry.prompt),
        standaloneRebuttal: legacyRebuttal,
        materialLocationGap: !missing && !legacyRebuttal,
        missingConcepts: missing ? ['evidence', 'policy', 'identifiers'] : [],
        reviewTrigger: missing ? null : { evidenceId: 'TEST-E5', policyId: 'TEST-P2' },
      },
    });
    if (legacyRebuttal) {
      const rider = entry.role === 'rider_advocate';
      const own = brief(entry.role, 'The pickup location remains unverified; the elapsed interval alone does not resolve the case.', [
        claim('The backend verified an elapsed interval of 480 seconds, without independently verifying the pickup location.', ['TEST-E4']),
        claim('Location records are unavailable.', ['TEST-E5']),
      ], rider ? ['The driver reports waiting at the designated pickup point.', 'The backend verified the recorded elapsed interval as 480 seconds.']
        : ['The rider reports being at the pickup point and unable to find the vehicle.', 'Elapsed time alone does not verify the pickup location.']);
      const prompt = entry.prompt + '\n\nYour original ' + (rider ? 'Rider' : 'Driver') + ' Advocate brief:\n' + JSON.stringify(own, null, 2);
      cases.push({ id: entry.id + '-with-own-brief', stage, prompt,
        source: 'eval/adp-manual-tests.json', fidelity: 'original_prompt_plus_explicit_own_brief',
        expected: { format: 'rebuttal', role: entry.role, ...idsIn(prompt), ownConcessions: own.concessions,
          reviewTrigger: { evidenceId: 'TEST-E5', policyId: 'TEST-P2' } },
      });
    }
  }
  const missingJudge = judge.tests.find(item => item.id === 'judge-missing-input');
  cases.push({ id: missingJudge.id, stage: 'judge', prompt: missingJudge.prompt,
    source: 'eval/adp-judge-test-results.json', fidelity: 'original_prompt_verbatim',
    expected: { format: 'plain', evidenceIds: [], policyIds: [], missingConcepts: ['evidence', 'policy', 'advocates'] },
  });
  const reverse = judge.tests.find(item => item.id === 'judge-reverse-fee');
  const reverseFact = claim('The backend verified the waiting duration as 240 seconds, below the stated requirement.', ['REV-E4'], ['REV-P1']);
  const submissions = [
    brief('rider_advocate', 'The verified early cancellation supports the rider request.', [reverseFact, claim('A charge is recorded and the verified reversal amount is 500 cents; no reversal has been executed.', ['REV-E5'])], ['The driver was at the correct location.']),
    brief('driver_advocate', 'The driver reports sufficient waiting, but the verified duration is insufficient.', [claim('The driver reports waiting long enough.', ['REV-E2']), reverseFact], ['The verified duration was insufficient.', 'Correct pickup location is established.']),
    rebuttal('rider_advocate', 'The recorded duration does not support the reported sufficient wait.', [reverseFact], ['The driver was at the correct location.']),
    rebuttal('driver_advocate', 'The verified short duration remains a valid opposing point.', [reverseFact], ['The verified duration was insufficient.', 'Correct pickup location is established.']),
  ];
  const reversePrompt = raw('judge', reverse.caseId, reverse.inputSummary.policy, reverse.inputSummary.evidence, submissions);
  cases.push({ id: reverse.id, stage: 'judge', prompt: reversePrompt, source: 'eval/adp-judge-test-results.json',
    fidelity: 'reconstructed_from_saved_inputSummary_not_original_full_prompt',
    expected: { format: 'judge', ...idsIn(reversePrompt), outcome: 'reverse_fee', amount: 500, monetaryEvidenceId: 'REV-E5', noUncertainty: true },
  });
  // Earlier conversation tested these Judge scenarios but did not retain their
  // full input strings. These are explicit reconstructions, not claimed exact reruns.
  const basePrompt = manual.tests.find(item => item.id === 'rider-brief-location-uncertainty').prompt;
  const getLines = marker => Object.fromEntries([...basePrompt.matchAll(new RegExp(`^- (TEST-${marker}\\d+): (.+)$`, 'gm'))].map(match => [match[1], match[2]]));
  const uncertaintyClaims = [claim('The elapsed interval is 480 seconds, but location is not independently verified.', ['TEST-E4', 'TEST-E5'])];
  const uncertaintyPrior = [brief('rider_advocate', 'The rider disputes the charge and location remains unresolved.', uncertaintyClaims),
    brief('driver_advocate', 'The driver reports waiting, but location remains unresolved.', uncertaintyClaims),
    rebuttal('rider_advocate', 'Elapsed time does not establish location.', uncertaintyClaims),
    rebuttal('driver_advocate', 'Unavailable location records do not prove wrongdoing.', uncertaintyClaims)];
  const uncertaintyPrompt = raw('judge', 'TEST-003', getLines('P'), getLines('E'), uncertaintyPrior);
  cases.push({ id: 'judge-location-uncertainty', stage: 'judge', prompt: uncertaintyPrompt,
    source: 'Earlier conversation plus TEST-001 evidence/policy saved in eval/adp-manual-tests.json', fidelity: 'reconstructed_historical_scenario',
    expected: { format: 'judge', ...idsIn(uncertaintyPrompt), outcome: 'human_review', amount: 0, materialLocationGap: true,
      reviewTrigger: { evidenceId: 'TEST-E5', policyId: 'TEST-P2' } },
  });
  const upholdPolicy = { 'UP-P1': 'A no-show fee requires at least 480 seconds of verified waiting at the designated pickup point; retain the existing fee when this condition is met.', 'UP-P2': 'Material uncertainty about required location or waiting duration requires human review.' };
  const upholdEvidence = { 'UP-E1': 'The rider disputes the S$5 charge.', 'UP-E2': 'The driver reports waiting at the designated pickup point.', 'UP-E3': 'Authenticated complete records verify continuous correct-location presence from 08:43:00 to recorded cancellation at 08:51:00 +08:00, with no gaps.', 'UP-E4': 'The backend verified waiting duration at the required location is 480 seconds.', 'UP-E5': 'The ledger records an existing charge of 500 SGD cents; the backend verified that retaining it requires zero additional adjustment.' };
  const upholdClaim = claim('Verified records establish the required location and a waiting duration of 480 seconds.', ['UP-E3', 'UP-E4'], ['UP-P1']);
  const upholdPrior = [brief('rider_advocate', 'The rider disputes the charge but the supplied waiting records support the driver.', [upholdClaim]), brief('driver_advocate', 'The recorded wait supports the driver account.', [upholdClaim]), rebuttal('rider_advocate', 'The waiting records are a valid opposing point.', [upholdClaim]), rebuttal('driver_advocate', 'The supplied records establish the required wait.', [upholdClaim])];
  const upholdPrompt = raw('judge', 'TEST-UPHOLD-RECONSTRUCTED', upholdPolicy, upholdEvidence, upholdPrior);
  cases.push({ id: 'judge-uphold-fee', stage: 'judge', prompt: upholdPrompt,
    source: 'Earlier conversation uphold scenario; full original input was not retained', fidelity: 'reconstructed_historical_scenario',
    expected: { format: 'judge', ...idsIn(upholdPrompt), outcome: 'uphold_fee', amount: 0, noUncertainty: true },
  });
  return cases;
}

export function assessPromptRegression(test, rawText, schemas) {
  const text = rawText.trim();
  const fence = /^```json\s*\r?\n([\s\S]*?)\r?\n```$/i.exec(text);
  const jsonText = fence ? fence[1].trim() : text;
  let parsed;
  try { parsed = JSON.parse(jsonText); } catch { /* Plain language is examined separately. */ }
  const expected = test.expected;
  if (expected.format === 'plain') {
    const checks = { plainLanguage: parsed === undefined && !!text && !text.startsWith('```') && !text.startsWith('{') };
    const patterns = { evidence: /evidence|records/i, policy: /polic(?:y|ies)|rules/i, identifiers: /identif|\bIDs?\b/i, advocates: /advocate|brief|rebuttal/i, own_brief: /(?:own|original|previous|prior|rider advocate|driver advocate).{0,100}brief|brief.{0,100}(?:own|original|previous|prior)/i };
    for (const concept of expected.missingConcepts) checks['requests_' + concept] = patterns[concept].test(text);
    const declaredCitationIds = [];
    const collect = value => { if(Array.isArray(value))value.forEach(collect);else if(value && typeof value==='object')for(const [key,nested] of Object.entries(value)){if((key==='evidenceIds'||key==='policyRuleIds')&&Array.isArray(nested))declaredCitationIds.push(...nested);else collect(nested);} };
    collect(parsed);
    checks.noInventedTestCitations = !/\b(?:TEST|REV|UP|EVID)-[A-Z]?\d+\b/.test(text) && declaredCitationIds.length===0;
    return { checks, passed: Object.values(checks).every(Boolean), parsedOutput: parsed ?? null,
      semanticReview: { status: 'pending_manual_inspection', required: ['Actually requests the missing input rather than merely mentioning it.', 'No unsupported verdict, execution claim, or implication that missing input invalidates the request.'] } };
  }
  const schema = expected.format === 'judge' ? schemas.JudgeProposalSchema : expected.format === 'brief' ? schemas.AdvocateBriefSchema : schemas.RebuttalSchema;
  const validation = schema.safeParse(parsed);
  const checks = { rawJsonOnly: !fence && text.startsWith('{') && text.endsWith('}') && parsed !== undefined, schema: validation.success };
  const promptCompliance = {};
  if (validation.success) {
    const output = validation.data;
    if (expected.role) checks.role = output.role === expected.role;
    // Standalone factual concessions are allowed. Their grounding and any
    // invented prior history require semantic review, not an empty-array check.
    if (expected.ownConcessions) checks.preservesOwnConcessionsExactly = output.preservedConcessions.length === expected.ownConcessions.length && expected.ownConcessions.every(text => output.preservedConcessions.includes(text));
    const claims = output.findings ?? [...output.claims, ...(output.adverseEvidence ?? [])];
    const allEvidence = [...claims.flatMap(item => item.evidenceIds), ...(output.evidenceIds ?? [])];
    const allPolicies = [...claims.flatMap(item => item.policyRuleIds), ...(output.policyRuleIds ?? [])];
    checks.onlySuppliedEvidenceIds = allEvidence.every(id => expected.evidenceIds.includes(id));
    checks.onlySuppliedPolicyIds = allPolicies.every(id => expected.policyIds.includes(id));
    if (expected.reviewTrigger) {
      checks.citesReviewTrigger = claims.some(item => item.evidenceIds.includes(expected.reviewTrigger.evidenceId) && item.policyRuleIds.includes(expected.reviewTrigger.policyId));
      if (expected.format === 'brief') checks.reviewOpening = /^(Human review is required\.)/i.test(output.position);
      if (expected.format === 'rebuttal') promptCompliance.reviewOpening = /^(Human review is required\.)/i.test(output.response);
    }
    if (expected.materialLocationGap) {
      const questions = expected.format === 'judge' ? output.uncertainty : output.unansweredQuestions;
      checks.recordsMaterialUncertainty = questions.some(question => question.trim().length > 0);
    }
    if (expected.format === 'judge') {
      checks.outcome = output.outcome === expected.outcome;
      checks.adjustment = output.proposedAdjustmentCents === expected.amount;
      checks.completeCitationSummary = claims.every(item => item.evidenceIds.every(id => output.evidenceIds.includes(id)) && item.policyRuleIds.every(id => output.policyRuleIds.includes(id)));
      if (expected.monetaryEvidenceId) checks.monetaryEvidence = output.evidenceIds.includes(expected.monetaryEvidenceId) && claims.some(item => item.evidenceIds.includes(expected.monetaryEvidenceId));
      if (expected.noUncertainty) checks.noUncertainty = output.uncertainty.length === 0;
    }
  }
  return { checks, passed: Object.values(checks).every(Boolean), structuredContentChecksPassed: Object.entries(checks).filter(([key])=>key!=='rawJsonOnly').every(([,value])=>value),
    promptCompliance, normalization: fence ? 'complete_enclosing_json_fence' : 'none', parsedOutput: parsed ?? null,
    schemaIssues: validation.success ? [] : validation.error.issues.map(issue => ({path: issue.path, code: issue.code})),
    semanticReview: { status: 'pending_manual_inspection', required: ['Facts and policy meanings are supported by the cited records.', 'Reported accounts remain attributed; elapsed time is not relabeled as verified location.', 'No automatic remedy inferred from missing records; no executed-action claims.', ...(expected.standaloneRebuttal ? ['Standalone concessions are grounded in supplied opposing facts and do not claim an invented previous brief or prior history.'] : []), ...(expected.ownConcessions ? ['Own concessions are preserved in meaning; opposing concessions are not substituted.'] : []), ...(expected.materialLocationGap ? ['The unresolved question identifies the required pickup-location fact, not an unrelated or already resolved issue.'] : [])] } };
}
