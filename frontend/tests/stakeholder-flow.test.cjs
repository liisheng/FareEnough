const {test}=require('node:test');
const assert=require('node:assert/strict');
const ui=require('../scripts/app.js');

const evidencePayload={caseId:'DISP-002',gpsTelemetry:Array.from({length:8}),chatLogs:Array.from({length:6}),cancellationPolicy:{noShowThresholdMin:8},derivedFacts:[{id:'derived_wait_duration',value:480,unit:'seconds'}]};
const run={runId:'RUN-1',caseId:'DISP-002',mode:'replay',status:'completed',events:[{stage:'rider_brief',status:'completed'},{stage:'driver_brief',status:'completed'},{stage:'judge',status:'completed'}],riderBrief:{position:'The rider disputes the charge.',claims:[{text:'The pickup was unclear.',evidenceIds:['CHAT-01'],policyRuleIds:[]}],adverseEvidence:[{text:'The driver waited eight minutes.',evidenceIds:['GPS-05'],policyRuleIds:[]}]},driverBrief:{position:'The trip record supports the driver.',claims:[{text:'Arrival was recorded.',evidenceIds:['GPS-05'],policyRuleIds:[]}]},riderRebuttal:{response:'The rider acknowledges the wait record.',preservedConcessions:['Eight minutes were recorded.'],claims:[{text:'Location remains uncertain.',evidenceIds:['EVENT-03'],policyRuleIds:[]}]},driverRebuttal:{response:'The communication log corroborates contact.',claims:[{text:'A call was attempted.',evidenceIds:['CALL-01'],policyRuleIds:[]}]},judgeProposal:{outcome:'uphold_fee',proposedAdjustmentCents:0,policyRuleIds:['POL-1'],explanation:'The recorded wait met the case policy.'},validatedDecision:{disposition:'claim_rejected',dispositionLabel:'Rider claim not upheld',feeTreatment:'Existing fee upheld',action:'uphold_fee',amountMinor:0,confidence:1,decisiveFacts:['The recorded wait was 480 seconds.'],policyRuleIds:['POL-1'],explanation:'The recorded wait met the case policy.',validationStatus:'validated'}};

test('normalizes the seeded evidence projection and renders deterministic facts',()=>{
  const ev=ui.evidenceView(evidencePayload);
  assert.deepEqual({wait:ev.waitSeconds,gps:ev.gpsCount,comms:ev.communicationCount},{wait:480,gps:8,comms:6});
  assert.match(ui.factStrip(ev),/480 seconds/);
  assert.match(ui.factStrip(ev),/8 points/);
});

test('API helpers request the evidence and replay endpoints with the expected contract',async()=>{
  const requests=[];
  const fetcher=async(url,options={})=>{requests.push({url,options});return {ok:true,json:async()=>({ok:true})};};
  await ui.fetchEvidence(fetcher);await ui.startReplay(fetcher);
  assert.match(requests[0].url,/\/api\/cases\/DISP-002\/evidence$/);
  assert.match(requests[1].url,/\/api\/cases\/DISP-002\/runs$/);
  assert.equal(requests[1].options.method,'POST');
  assert.deepEqual(JSON.parse(requests[1].options.body),{mode:'replay'});
});

test('renders advocate separation, rebuttals, citations and a validated simulated outcome',()=>{
  const html=ui.supportReady(ui.evidenceView(evidencePayload),run);
  assert.match(html,/Rider Advocate/);assert.match(html,/Driver Advocate/);
  assert.match(html,/Rider Advocate rebuttal/);assert.match(html,/Driver Advocate rebuttal/);
  assert.match(html,/CHAT-01/);assert.match(html,/GPS-05/);assert.match(html,/POL-1/);
  assert.match(html,/VALIDATED DECISION/);assert.match(html,/S\$0\.00/);assert.match(html,/100%/);
  assert.match(html,/No real refund, charge or account action/);
});

test('rider outcome is concise and backend failure is explicit',()=>{
  const rider=ui.riderReady(ui.evidenceView(evidencePayload),run);
  assert.match(rider,/Rider claim not upheld/);assert.match(rider,/S\$0\.00 simulated adjustment/);assert.match(rider,/480 seconds/);
  const error=ui.errorCard('<offline>');assert.match(error,/BACKEND UNAVAILABLE/);assert.match(error,/&lt;offline&gt;/);assert.match(error,/No case action was taken/);
});
