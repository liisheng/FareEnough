import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AdpModelProvider } from '../src/providers/adp-provider.js';
import * as schemas from '../src/agents/schemas.js';
import { loadPromptRegressionCases, assessPromptRegression } from '../scripts/prompt-regression-cases.mjs';
import { createManualPromptFetch, envelopeFinalText, protocolSummary } from '../scripts/manual-prompt-transport.mjs';

const cases = loadPromptRegressionCases();
const finalSse = (request: Record<string, string>, text: string, wrongId = false) => [
  'event: response.completed',
  'data: ' + JSON.stringify({ Type:'response.completed',Response:{Role:'assistant',Status:'success',ConversationId:wrongId?'wrong':request.ConversationId,ExtraInfo:{RequestId:request.RequestId},Messages:[{Type:'reply',Status:'success',Contents:[{Type:'text',Text:text}]}]}}),
  '', 'event: done', 'data: [DONE]', '', '',
].join('\n');
const shim = {stage:'rider_brief' as const,conversationId:'test',systemPrompt:'Use the configured input gate.',evidence:{caseId:'TRANSPORT-SHIM',policyProfile:{profileId:'shim',version:'1'},evidence:[{id:'shim-evidence',kind:'dispute' as const,data:{}}],policyRules:[{id:'shim-policy',text:'Not forwarded',value:0}]},priorOutputs:[]};
const options = {riderAppKey:'synthetic-rider-key',driverAppKey:'synthetic-driver-key',judgeAppKey:'synthetic-judge-key'};

describe('historical prompt regression vectors', () => {
  it('keeps all six original advocate prompts and their structured rebuttal behavior', () => {
    const original = JSON.parse(readFileSync(new URL('../../eval/adp-manual-tests.json',import.meta.url),'utf8'));
    expect(cases).toHaveLength(12);
    expect(new Set(cases.map(test => test.id)).size).toBe(12);
    for (const test of original.tests) expect(cases.find(item => item.id===test.id)?.prompt).toBe(test.prompt);
    for(const role of ['rider','driver'])expect(cases.find(item=>item.id===role+'-rebuttal-location-uncertainty')?.expected.format).toBe('rebuttal');
  });
  it('keeps Judge missing input exact and clearly labels reconstructed Judge inputs', () => {
    const original = JSON.parse(readFileSync(new URL('../../eval/adp-judge-test-results.json',import.meta.url),'utf8'));
    expect(cases.find(item=>item.id==='judge-missing-input')?.prompt).toBe(original.tests.find(item=>item.id==='judge-missing-input').prompt);
    for(const id of ['judge-reverse-fee','judge-location-uncertainty','judge-uphold-fee'])expect(cases.find(item=>item.id===id)?.fidelity).toContain('reconstructed');
    for(const test of cases) {
      expect(test.prompt).not.toMatch(/expectedOutcome|expectedAmount|latestManualResult|observedResponse|pass_by_inspection/);
      if(test.expected.format!=='plain'){expect(test.expected.evidenceIds.length).toBeGreaterThan(0);expect(test.expected.policyIds.length).toBeGreaterThan(0);}
    }
  });
  it('accepts plain-language missing-input clarification but rejects partial JSON', () => {
    const test=cases.find(item=>item.id==='rider-missing-input');
    const good=assessPromptRegression(test,'Please provide case evidence with identifiers and applicable policy rules. This cannot yet be assessed.',schemas);
    expect(good.passed).toBe(true);
    expect(good.semanticReview.status).toBe('pending_manual_inspection');
    expect(assessPromptRegression(test,'{"claims":[],"position":"Please provide evidence identifiers and policy."}',schemas).passed).toBe(false);
  });
  it('rejects fabricated citations and records raw-JSON formatting separately from schema', () => {
    const test=cases.find(item=>item.id==='rider-brief-location-uncertainty');
    const output={role:'rider_advocate',position:'Human review is required.',claims:[{text:'Location is unavailable and requires review.',evidenceIds:['TEST-E5'],policyRuleIds:['TEST-P2']}],adverseEvidence:[],concessions:[],unansweredQuestions:['Was the driver at the designated pickup point throughout the required waiting period?']};
    expect(assessPromptRegression(test,JSON.stringify(output),schemas).passed).toBe(true);
    const fenced=assessPromptRegression(test,'```json\n'+JSON.stringify(output)+'\n```',schemas);
    expect(fenced.checks.rawJsonOnly).toBe(false);
    expect(fenced.checks.schema).toBe(true);
    expect(fenced.structuredContentChecksPassed).toBe(true);
    output.claims[0].evidenceIds=['EVID-002'];
    expect(assessPromptRegression(test,JSON.stringify(output),schemas).checks.onlySuppliedEvidenceIds).toBe(false);
    expect(assessPromptRegression(test,'```json\n'+JSON.stringify(output)+'\n```',schemas).checks.rawJsonOnly).toBe(false);
  });
  it('distinguishes standalone rebuttals from exact own-concession preservation', () => {
    const standalone=cases.find(item=>item.id==='driver-rebuttal-location-uncertainty');
    const augmented=cases.find(item=>item.id===standalone.id+'-with-own-brief');
    const output={role:'driver_advocate',response:'Human review is required.',challengedClaim:'Missing locations require reversal.',claims:[{text:'Location is unavailable and requires review.',evidenceIds:['TEST-E5'],policyRuleIds:['TEST-P2']}],preservedConcessions:[] as string[]};
    expect(assessPromptRegression(standalone,JSON.stringify(output),schemas).passed).toBe(true);
    expect(assessPromptRegression(augmented,JSON.stringify(output),schemas).passed).toBe(false);
    output.preservedConcessions=augmented.expected.ownConcessions;
    expect(assessPromptRegression(augmented,JSON.stringify(output),schemas).passed).toBe(true);
    const acknowledged=assessPromptRegression(standalone,JSON.stringify(output),schemas);
    expect(acknowledged.passed).toBe(true);
    expect(acknowledged.promptCompliance).not.toHaveProperty('standaloneConcessionsEmpty');
    expect(acknowledged.semanticReview.required).toContain('Standalone concessions are grounded in supplied opposing facts and do not claim an invented previous brief or prior history.');
  });
  it('requires material location uncertainty in brief and Judge gap arrays', () => {
    const claim={text:'Unavailable location records require review.',evidenceIds:['TEST-E5'],policyRuleIds:['TEST-P2']};
    for (const role of ['rider','driver']) {
      const test=cases.find(item=>item.id===role+'-brief-location-uncertainty');
      const output={role:role+'_advocate',position:'Human review is required.',claims:[claim],adverseEvidence:[],concessions:[],unansweredQuestions:[] as string[]};
      expect(assessPromptRegression(test,JSON.stringify(output),schemas).checks.recordsMaterialUncertainty).toBe(false);
      output.unansweredQuestions=['Was the driver physically present at the required pickup point?'];
      expect(assessPromptRegression(test,JSON.stringify(output),schemas).passed).toBe(true);
    }
    const judge=cases.find(item=>item.id==='judge-location-uncertainty');
    const output={outcome:'human_review',explanation:'Pickup location is unverified.',findings:[claim],evidenceIds:['TEST-E5'],policyRuleIds:['TEST-P2'],proposedAdjustmentCents:0,uncertainty:[] as string[]};
    expect(assessPromptRegression(judge,JSON.stringify(output),schemas).checks.recordsMaterialUncertainty).toBe(false);
    output.uncertainty=['Was the driver physically present at the required pickup point?'];
    expect(assessPromptRegression(judge,JSON.stringify(output),schemas).passed).toBe(true);
  });
  it('does not make a new rebuttal opening phrase a historical pass condition', () => {
    const test=cases.find(item=>item.id==='driver-rebuttal-location-uncertainty');
    const output={role:'driver_advocate',response:'The cited missing location requires human review, not automatic reversal.',challengedClaim:'The fee must be reversed.',claims:[{text:'Location is unavailable and policy requires review.',evidenceIds:['TEST-E5'],policyRuleIds:['TEST-P2']}],preservedConcessions:[]};
    const result=assessPromptRegression(test,JSON.stringify(output),schemas);
    expect(result.passed).toBe(true);
    expect(result.promptCompliance.reviewOpening).toBe(false);
  });
  it('requires monetary citation and complete summary for the old reversal test', () => {
    const test=cases.find(item=>item.id==='judge-reverse-fee');
    const output={outcome:'reverse_fee',explanation:'The verified short wait supports reversal.',findings:[{text:'The required duration was not met.',evidenceIds:['REV-E4'],policyRuleIds:['REV-P1','REV-P2']}],evidenceIds:['REV-E4'],policyRuleIds:['REV-P1','REV-P2'],proposedAdjustmentCents:500,uncertainty:[]};
    expect(assessPromptRegression(test,JSON.stringify(output),schemas).checks.monetaryEvidence).toBe(false);
    output.findings.push({text:'Verified reversal amount is 500 cents.',evidenceIds:['REV-E5'],policyRuleIds:[]});
    expect(assessPromptRegression(test,JSON.stringify(output),schemas).checks.completeCitationSummary).toBe(false);
    output.evidenceIds.push('REV-E5');
    expect(assessPromptRegression(test,JSON.stringify(output),schemas).passed).toBe(true);
  });
});

describe('evaluation-only plain-text ADP transport capture', () => {
  it('sends only the manual prompt and captures exact prose through the existing provider', async () => {
    let sent: Record<string, any> = {};
    const capture: {finalText?:string}={};
    const prompt='stage: rider_brief\nNo evidence or policy supplied.';
    const answer='Please provide evidence with IDs and policy rules.\nNo decision has been made.';
    const fetcher=createManualPromptFetch(prompt,capture,async (_url:unknown,init:RequestInit)=>{
      sent=JSON.parse(init.body as string);return new Response(finalSse(sent as Record<string,string>,answer),{headers:{'Content-Type':'text/event-stream'}});
    });
    const provider=new AdpModelProvider({...options,fetch:fetcher});
    expect(await provider.generate(shim)).toEqual({evaluationFinalText:answer});
    expect(capture.finalText).toBe(answer);
    expect(sent.Contents).toEqual([{Type:'text',Text:prompt}]);
    expect(sent.SystemRole).toBe(shim.systemPrompt);
    expect(JSON.stringify(sent.Contents)).not.toContain('shim');
    expect(sent.SearchNetwork).toBe('disable');
  });
  it('does not bypass response conversation validation', async () => {
    const fetcher=createManualPromptFetch('stage: rider_brief',{},async (_url:unknown,init:RequestInit)=>new Response(finalSse(JSON.parse(init.body as string),'Please provide evidence.',true),{headers:{'Content-Type':'text/event-stream'}}));
    await expect(new AdpModelProvider({...options,fetch:fetcher}).generate(shim)).rejects.toMatchObject({code:'ADP_STREAM_INVALID'});
  });
  it('does not capture error or reasoning messages as final answers', () => {
    const capture: {finalText?:string}={};
    const input='event: error\ndata: {"Type":"error","Error":{"Message":"private upstream detail"}}\n\n';
    expect(envelopeFinalText(input,capture)).toBe(input);
    expect(capture.finalText).toBeUndefined();
  });
  it('captures safe metadata for an incomplete response without logging prose, thoughts or keys', async () => {
    const capture: {protocol?:unknown}={};
    const secret=options.riderAppKey;
    const sse='event: response.delta\ndata: '+JSON.stringify({Type:'response.delta',Response:{Status:'processing',Messages:[{Type:'thought',Status:'processing',Contents:[{Type:'text',Text:'Private thought: '+secret}]}]}})+'\n\n';
    const fetcher=createManualPromptFetch('stage: rider_brief',capture,async()=>new Response(sse,{headers:{'Content-Type':'text/event-stream'}}));
    await expect(new AdpModelProvider({...options,fetch:fetcher}).generate(shim)).rejects.toMatchObject({code:'ADP_STREAM_INCOMPLETE'});
    expect(capture.protocol).toMatchObject({streamEnded:true,eventNames:['response.delta'],types:['response.delta'],responseStatuses:['processing'],messages:[{type:'thought',status:'processing'}],doneObserved:false,completedObserved:false});
    expect(JSON.stringify(capture.protocol)).not.toContain('Private thought');
    expect(JSON.stringify(capture.protocol)).not.toContain(secret);
  });
  it('redacts nonnumeric upstream codes and credential echoes without logging error prose', () => {
    const sse='event: error\ndata: '+JSON.stringify({Type:'error',Error:{Code:'ResourceInsufficient',Message:'Secret prose'},Response:{Error:{Code:options.riderAppKey,Message:'Private detail'}}})+'\n\n';
    const protocol=protocolSummary(sse,{eof:true,secrets:[options.riderAppKey]});
    expect(protocol.errorCodes).toEqual(['[redacted]']);
    expect(JSON.stringify(protocol)).not.toMatch(/Secret prose|Private detail|synthetic-rider-key/);
  });
});
