// No external call occurs without --live. Expected behavior stays in this script.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loadPromptRegressionCases, assessPromptRegression } from './prompt-regression-cases.mjs';
import { createManualPromptFetch } from './manual-prompt-transport.mjs';
import * as schemas from '../dist/agents/schemas.js';

const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const allCases = loadPromptRegressionCases();
const ids = option('--cases', allCases.map(test => test.id).join(',')).split(',');
if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !allCases.some(test => test.id === id))) throw Error('Choose unique listed test IDs with --cases.');
const selected = ids.map(id => allCases.find(test => test.id === id));
const maxCalls = Number(option('--max-calls', String(selected.length)));
if (!Number.isSafeInteger(maxCalls) || maxCalls < selected.length || maxCalls > 24) throw Error('Budget must cover one call per selected test and may not exceed 24.');
const interCallDelayMs = Number(option('--delay-ms', '0'));
if (!Number.isSafeInteger(interCallDelayMs) || interCallDelayMs < 0 || interCallDelayMs > 30000) throw Error('Inter-call delay must be an integer from 0 to 30000 milliseconds.');
if (!args.includes('--live')) {
  console.log(JSON.stringify({ mode: 'dry_run', externalCalls: 0, plannedCalls: selected.length, interCallDelayMs,
    tests: selected.map(({id,stage,fidelity,expected,compatibilityNote}) => ({id,stage,fidelity,expectedFormat:expected.format,compatibilityNote})),
    limitations: ['Original standalone rebuttal vectors retain JSON expectations with no invented prior concessions; augmented vectors test own-brief concession preservation.', 'Three Judge scenarios are reconstructed because their complete historical inputs were not retained.', 'Machine checks do not certify semantic correctness.'] }, null, 2));
  process.exit(0);
}

process.env.AI_MODE = 'live';
process.env.MODEL_PROVIDER = 'adp';
const { config, isAdpConfigured } = await import('../dist/config.js');
const { AdpModelProvider, AdpProviderError } = await import('../dist/providers/adp-provider.js');
if (!isAdpConfigured()) throw Error('Configure all three published ADP applications before a live regression run.');
const promptNames = { rider_advocate: 'rider-advocate', driver_advocate: 'driver-advocate', judge: 'judge' };
const hash = value => 'sha256:' + createHash('sha256').update(value).digest('hex');
const prompts = Object.fromEntries(Object.entries(promptNames).map(([role,name]) => [role,readFileSync(new URL('../prompts/'+name+'.md',import.meta.url),'utf8')]));
const report = { suite: 'Historical manual prompt regressions', startedAt:new Date().toISOString(),
  limits:{maxCalls,automaticRetries:0,interCallDelayMs}, callsStarted:0, systemPromptHashes:Object.fromEntries(Object.entries(prompts).map(([key,value])=>[key,hash(value)])),
  systemPrompts:prompts, limitations:['Tests exercise exact manual user text and local system prompts via the ADP transport. They do not use the production JSON responseContract envelope or coordinator appendix.', 'Evaluation-only transport wrapping permits inspection of plain-language responses; production rejects them.', 'Reconstructed historical inputs are explicitly labeled.', 'Semantic review remains separate and pending even when every machine check passes.'], tests:[] };
const directory = new URL('../../eval/live-reports/',import.meta.url);
mkdirSync(directory,{recursive:true});
const reportUrl = new URL('prompt-regressions-'+report.startedAt.replaceAll(':','-')+'.json',directory);
const save = () => writeFileSync(reportUrl,JSON.stringify(report,null,2)+'\n');
save();
for (const test of selected) {
  if (report.tests.length > 0 && interCallDelayMs > 0) await new Promise(resolve => setTimeout(resolve, interCallDelayMs));
  const role = test.stage === 'judge' ? 'judge' : test.stage.startsWith('rider') ? 'rider_advocate' : 'driver_advocate';
  const capture = {};
  const result = { ...test, promptHash:hash(test.prompt), startedAt:new Date().toISOString(), status:'running' };
  report.tests.push(result); save();
  const provider = new AdpModelProvider({ riderAppKey:config.ADP_RIDER_APP_KEY,driverAppKey:config.ADP_DRIVER_APP_KEY,judgeAppKey:config.ADP_JUDGE_APP_KEY,chatUrl:config.ADP_CHAT_URL,
    callTimeoutMs:Math.min(Number(config.MODEL_CALL_TIMEOUT_MS)||60000,120000),runTimeoutMs:Math.min(Number(config.RUN_TIMEOUT_MS)||240000,480000),fetch:createManualPromptFetch(test.prompt,capture) });
  try {
    if (report.callsStarted >= maxCalls) throw Error('EVALUATION_CALL_BUDGET');
    report.callsStarted++; save();
    const output = await provider.generate({ stage:test.stage,conversationId:'unused-fresh-provider',systemPrompt:prompts[role],
      evidence:{caseId:'EVALUATION-TRANSPORT-SHIM',policyProfile:{profileId:'evaluation-only',version:'1'},evidence:[{id:'shim-evidence',kind:'dispute',data:{}}],policyRules:[{id:'shim-policy',text:'Never forwarded',value:0}]},priorOutputs:[] });
    if (typeof output?.evaluationFinalText !== 'string' || output.evaluationFinalText !== capture.finalText) throw Error('EVALUATION_CAPTURE_INVALID');
    result.rawOutput=capture.finalText;
    const assessment=assessPromptRegression(test,capture.finalText,schemas);
    Object.assign(result,assessment);
    result.status=assessment.passed?'machine_checks_passed':'machine_checks_failed';
  } catch(error) {
    provider.abort();
    if(typeof capture.finalText==='string')result.rawOutput=capture.finalText;
    result.status='failed';result.errorCode=error instanceof AdpProviderError?error.code:'EVALUATION_FAILURE';
    result.semanticReview={status:'not_completed'};
  }
  result.protocol=capture.protocol??{responseObserved:false};
  result.completedAt=new Date().toISOString();save();
  console.log(JSON.stringify({id:test.id,status:result.status,errorCode:result.errorCode}));
}
report.completedAt=new Date().toISOString();
report.machineChecksPassed=report.tests.every(test=>test.status==='machine_checks_passed');
report.semanticReview='pending_manual_inspection';save();
console.log(JSON.stringify({report:fileURLToPath(reportUrl),callsStarted:report.callsStarted,machineChecksPassed:report.machineChecksPassed,semanticReview:report.semanticReview}));
if(!report.machineChecksPassed)process.exitCode=1;
