// Evaluation is deliberately outside runtime source. No call without --live.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { loadReviewFixture } from '../dist/policies/ryde-v21.js';
import { runThreeAgentReview } from '../dist/agents/run-coordinator.js';
import { validatePolicyProposal } from '../dist/decisions/policy-validator.js';
import { evaluateRunChecks, evaluateStageChecks, pendingStageSemanticReview, evaluateOverallAcceptance } from './policy-evaluation-checks.mjs';
import * as schemas from '../dist/agents/schemas.js';

const args = process.argv.slice(2);
const option = (key, fallback) => {
  const i = args.indexOf(key);
  return i < 0 ? fallback : args[i + 1];
};
const live = args.includes('--live');
const suite = JSON.parse(readFileSync(new URL('../../eval/expectations/ryde-v21-suite.json', import.meta.url), 'utf8'));
const selected = option('--cases', suite.cases.map(item => item.caseId).join(',')).split(',');
if (!selected.length || new Set(selected).size !== selected.length || selected.some(id => !suite.cases.some(item => item.caseId === id))) {
  throw Error('Choose unique supported case IDs with --cases DISP-002,DISP-003,DISP-001.');
}
const maxCalls = Number(option('--max-calls', '15'));
if (!Number.isSafeInteger(maxCalls) || maxCalls < selected.length * 5 || maxCalls > 30) {
  throw Error('The call budget must cover five calls per case and cannot exceed 30 per invocation.');
}
const sha = value => 'sha256:' + createHash('sha256').update(value).digest('hex');
const fixtures = selected.map(caseId => ({ ...loadReviewFixture(caseId), expected: suite.cases.find(item => item.caseId === caseId) }));
for (const fixture of fixtures) {
  if (fixture.snapshot.policyProfile.profileId !== suite.policyProfile) throw Error('Selected policy mismatch.');
  if (fixture.assessment.outcome !== fixture.expected.outcome || fixture.assessment.adjustmentCents !== fixture.expected.adjustmentCents) {
    throw Error('Deterministic evaluation disagrees with the test contract for ' + fixture.snapshot.caseId);
  }
}
if (!live) {
  console.log(JSON.stringify({ mode: 'offline', externalCalls: 0, cases: fixtures.map(item => ({caseId:item.snapshot.caseId,policyProfile:item.snapshot.policyProfile.profileId,outcome:item.assessment.outcome,adjustmentCents:item.assessment.adjustmentCents})) }, null, 2));
  process.exit(0);
}

process.env.AI_MODE = 'live';
process.env.MODEL_PROVIDER = 'adp';
const { config, isAdpConfigured } = await import('../dist/config.js');
const { AdpModelProvider, AdpProviderError } = await import('../dist/providers/adp-provider.js');
if (!isAdpConfigured()) throw Error('Three published ADP applications must be configured.');
let calls = 0;
const report = {
  scope: 'Evaluation artifact only; never imported as runtime evidence.',
  startedAt: new Date().toISOString(), policyProfile:suite.policyProfile,
  promptHashes:Object.fromEntries(['rider-advocate','driver-advocate','judge'].map(name => [name,sha(readFileSync(new URL('../prompts/'+name+'.md',import.meta.url)))])),
  systemPrompts:{},
  providerCodeHash:sha(readFileSync(new URL('../dist/providers/adp-provider.js',import.meta.url))),
  limits: { maxCalls, automaticRetries: 0 }, callsStarted:0,
  limitations:['One live run per selected case is not a repeatability or semantic-quality certification.', 'Expected outcomes and stage contracts remain exclusively in this evaluator. No real financial action is executed.', 'expectationsPassed is retained as a final-decision-only compatibility field; overallAcceptance requires a separate source-grounded audit of every stage.'],
  cases: [],
};
const directory = new URL('../../eval/live-reports/', import.meta.url);
mkdirSync(directory, { recursive:true });
const reportUrl = new URL('ryde-v21-'+report.startedAt.replaceAll(':','-')+'.json',directory);
const save = () => { report.callsStarted=calls; writeFileSync(reportUrl, JSON.stringify(report,null,2)+'\n'); };
save();
for (const fixture of fixtures) {
  const caseId = fixture.snapshot.caseId;
  const run = { caseId, expected:fixture.expected, assessment:fixture.assessment, evidenceHash:sha(JSON.stringify(fixture.snapshot)), input:fixture.snapshot, status:'running', events:[], artifacts:{}, unvalidatedProviderResponses:{}, startedAt:new Date().toISOString() };
  report.cases.push(run);
  const adp = new AdpModelProvider({riderAppKey:config.ADP_RIDER_APP_KEY,driverAppKey:config.ADP_DRIVER_APP_KEY,judgeAppKey:config.ADP_JUDGE_APP_KEY,chatUrl:config.ADP_CHAT_URL,callTimeoutMs:Math.min(Number(config.MODEL_CALL_TIMEOUT_MS)||60000,120000),runTimeoutMs:Math.min(Number(config.RUN_TIMEOUT_MS)||240000,480000)});
  const provider = {id:adp.id,mode:'live',abort:()=>adp.abort(),generate(request){
    if (calls >= maxCalls) { adp.abort(); throw Error('EVALUATION_CALL_BUDGET'); }
    report.systemPrompts[request.stage]=request.systemPrompt;
    calls++; save();
    return adp.generate(request).then(output => {
      // Keep rejected model JSON available for diagnosis, separate from accepted artifacts.
      // Never save requests/credentials or raw upstream error messages.
      run.unvalidatedProviderResponses[request.stage]=output; save(); return output;
    });
  }};
  console.log(JSON.stringify({caseId,status:'started'}));
  try {
    const result = await runThreeAgentReview(fixture.snapshot,provider,{runId:'eval-'+randomUUID(),onArtifact(stage,artifact){run.artifacts[stage]=artifact;delete run.unvalidatedProviderResponses[stage];save();},onEvent(event){run.events.push(event);save();}});
    run.judge = result.judgeProposal;
    run.validatedDecision = validatePolicyProposal(fixture.snapshot,fixture.assessment,result.judgeProposal);
    run.checks = evaluateRunChecks(run.events,result.judgeProposal,run.validatedDecision,fixture.expected);
    run.finalDecisionChecksPassed=Object.values(run.checks).every(Boolean);
  } catch(error) {
    adp.abort();
    run.status='failed';
    run.errorCode=error instanceof AdpProviderError?error.code:error?.name==='ZodError'?'INVALID_AGENT_SCHEMA':error?.message?.startsWith('Ungrounded agent citations:')?'UNKNOWN_AGENT_CITATION':error?.message==='Agent role does not match requested stage'?'AGENT_ROLE_MISMATCH':'INVALID_OR_INCOMPLETE_REVIEW';
  }
  // Retain useful checks even when the coordinator stopped on a malformed stage.
  // Contracts and expected decisions are never attached to fixture.snapshot.
  run.stageChecks=evaluateStageChecks(run.artifacts,fixture.snapshot,fixture.expected.stageContract,schemas);
  run.stageContractChecksPassed=Object.values(run.stageChecks).every(stage=>stage.passed);
  run.semanticReview=pendingStageSemanticReview();
  run.overallAcceptance=evaluateOverallAcceptance(run.checks,run.stageChecks,run.semanticReview.stages);
  if(run.status!=='failed')run.status=run.finalDecisionChecksPassed&&run.stageContractChecksPassed?'machine_checks_passed':'machine_checks_failed';
  run.completedAt=new Date().toISOString();
  save();
  console.log(JSON.stringify({caseId,status:run.status,outcome:run.judge?.outcome,adjustmentCents:run.judge?.proposedAdjustmentCents,errorCode:run.errorCode}));
}
report.completedAt=new Date().toISOString();
report.finalDecisionChecksPassed=report.cases.every(item=>item.finalDecisionChecksPassed===true);
report.expectationsPassed=report.finalDecisionChecksPassed;
report.stageContractChecksPassed=report.cases.every(item=>item.stageContractChecksPassed);
report.machineChecksPassed=report.finalDecisionChecksPassed&&report.stageContractChecksPassed;
report.overallAcceptance=report.cases.some(item=>item.overallAcceptance.status==='failed')?'failed':'pending';
save();
console.log(JSON.stringify({report:fileURLToPath(reportUrl),callsStarted:calls,finalDecisionChecksPassed:report.finalDecisionChecksPassed,stageContractChecksPassed:report.stageContractChecksPassed,overallAcceptance:report.overallAcceptance}));
if(!report.machineChecksPassed)process.exitCode=1;
