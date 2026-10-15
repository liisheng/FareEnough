const {test}=require('node:test');
const assert=require('node:assert/strict');
const ui=require('../scripts/app.js');

test('shared render helpers do not start the removed fixture walkthrough',()=>{
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert.doesNotMatch(html,/seeded-rider-view|seeded-support-view|id="review-mode"/);
  assert.match(html,/styles\/experience\.css/);
  assert.match(html,/vendor\/motion\.js/);
  assert.match(html,/scripts\/experience\.js/);
  assert.match(html,/data-scenario="no-show"/);
  const server=fs.readFileSync(path.join(__dirname,'../serve.mjs'),'utf8');
  assert.match(server,/experience\.css/);
  assert.match(server,/node_modules\/motion\/dist\/motion\.js/);
  const window={document:{},fetch(){throw new Error('Unexpected fixture request');}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../scripts/app.js'),'utf8'),{window});
  assert.equal(typeof window.FareEnoughUI.stageList,'function');
});

const evidencePayload={caseId:'DISP-002',gpsTelemetry:Array.from({length:8}),chatLogs:Array.from({length:6}),cancellationPolicy:{noShowThresholdMin:8},derivedFacts:[{id:'derived_wait_duration',value:480,unit:'seconds'}]};
const run={runId:'RUN-1',caseId:'DISP-002',mode:'replay',status:'completed',events:[{stage:'rider_brief',status:'completed'},{stage:'driver_brief',status:'completed'},{stage:'judge',status:'completed'}],riderBrief:{position:'The rider disputes the charge.',claims:[{text:'The pickup was unclear.',evidenceIds:['CHAT-01'],policyRuleIds:[]}],adverseEvidence:[{text:'The driver waited eight minutes.',evidenceIds:['GPS-05'],policyRuleIds:[]}]},driverBrief:{position:'The trip record supports the driver.',claims:[{text:'Arrival was recorded.',evidenceIds:['GPS-05'],policyRuleIds:[]}]},riderRebuttal:{response:'The rider acknowledges the wait record.',preservedConcessions:['Eight minutes were recorded.'],claims:[{text:'Location remains uncertain.',evidenceIds:['EVENT-03'],policyRuleIds:[]}]},driverRebuttal:{response:'The communication log corroborates contact.',claims:[{text:'A call was attempted.',evidenceIds:['CALL-01'],policyRuleIds:[]}]},judgeProposal:{outcome:'uphold_fee',proposedAdjustmentCents:0,policyRuleIds:['POL-1'],explanation:'The recorded wait met the case policy.'},validatedDecision:{disposition:'claim_rejected',dispositionLabel:'Rider claim not upheld',feeTreatment:'Existing fee upheld',action:'uphold_fee',amountMinor:0,confidence:1,decisiveFacts:['The recorded wait was 480 seconds.'],policyRuleIds:['POL-1'],explanation:'The recorded wait met the case policy.',validationStatus:'validated'}};

test('normalizes the seeded evidence projection and renders deterministic facts',()=>{
  const ev=ui.evidenceView(evidencePayload);
  assert.deepEqual({wait:ev.waitSeconds,gps:ev.gpsCount,comms:ev.communicationCount},{wait:480,gps:8,comms:6});
  assert.match(ui.factStrip(ev),/480 seconds/);
  assert.match(ui.factStrip(ev),/8 points/);
});

test('renders route differences, unsupported ERP and deterministic confidence',()=>{
  const payload={dispute:{disputeType:'route'},gpsTelemetry:Array.from({length:4}),chatLogs:[],projectedPolicyRules:Array.from({length:4}),derivedFacts:[
    {id:'derived_route_distance_difference',value:2300},{id:'derived_route_duration_difference',value:600},{id:'derived_supported_adjustment',value:325},
  ],additionalEvidence:[
    {id:'route-reference-001',data:{points:[[1.28,103.85],[1.30,103.83]]}},
    {id:'route-actual-001',data:{points:[[1.28,103.85],[1.27,103.84],[1.30,103.83]]}},
    {id:'route-consent-001',data:{verified:true}},
    {id:'gantry-coverage-001',data:{gantriesPassed:[]}},
  ]};
  const ev=ui.evidenceView(payload),routeRun={...run,validatedDecision:{...run.validatedDecision,amountMinor:325,feeTreatment:'Unsupported charge refunded',confidence:{score:1,completeness:1,corroboration:1,policyCoverage:1,citationValidity:1}}};
  assert.match(ui.factStrip(ev),/2300 metres/);
  assert.match(ui.factStrip(ev),/600 seconds/);
  assert.match(ui.factStrip(ev),/S\$3\.25/);
  const html=ui.supportReady(ev,routeRun);
  assert.match(html,/Route and additional charge review/);
  assert.match(html,/Reference and actual route comparison/);
  assert.match(html,/Detour consent checked/);
  assert.match(html,/No passage recorded/);
  assert.match(html,/Deterministic confidence: 100%/);
  assert.match(html,/not a truthfulness probability/);
});

test('turns no-show evidence into a readable four-step story',()=>{
  const story=ui.evidenceStory(ui.evidenceView(evidencePayload));
  assert.equal((story.match(/<li>/g)||[]).length,4);
  assert.match(story,/From arrival to fee/);
  assert.match(story,/480 seconds recorded/);
  assert.match(story,/derived_wait_duration/);
});

test('stage progress updates five items from queued through active to complete',()=>{
  const stages=['rider_brief','driver_brief','rider_rebuttal','driver_rebuttal','judge'];
  const idle=ui.stageList([]);
  assert.equal((idle.match(/<li class=/g)||[]).length,5);
  assert.match(idle,/aria-valuenow="0"/);
  const active=ui.stageList([{stage:'rider_brief',status:'started',sequence:1},{stage:'driver_brief',status:'started',sequence:2}],'running');
  assert.equal((active.match(/<li class="running"/g)||[]).length,2);
  assert.match(active,/Assessing the rider account/);
  const events=stages.flatMap((stage,i)=>[{stage,status:'started',sequence:i*2+1},{stage,status:'completed',sequence:i*2+2}]);
  const partial=ui.stageList(events.slice(0,5),'running');
  assert.match(partial,/aria-valuenow="40"/);
  assert.match(partial,/Reviewing and responding to the driver/);
  const done=ui.stageList(events,'human_review');
  assert.equal((done.match(/<li class=/g)||[]).length,5);
  assert.equal((done.match(/<li class="completed"/g)||[]).length,5);
  assert.match(done,/aria-valuenow="100"/);
  assert.match(done,/Judge proposal received/);
  assert.doesNotMatch(done,/Waiting to start|In progress/);
});

test('failed or interrupted work never appears fully complete or keeps animating',()=>{
  const html=ui.stageList([{stage:'rider_brief',status:'completed'},{stage:'driver_brief',status:'started'},{stage:'rider_rebuttal',status:'failed'}],'human_review');
  assert.match(html,/aria-valuenow="20"/);
  assert.match(html,/Agent review stopped/);
  assert.match(html,/This stage failed/);
  assert.doesNotMatch(html,/<li class="running"|100%/);
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

test('live mode is requested explicitly and health discovery makes no run request',async()=>{
  const requests=[];
  const fetcher=async(url,options={})=>{requests.push({url,options});return {ok:true,json:async()=>({mode:'replay',liveAvailable:true})};};
  assert.equal((await ui.fetchHealth(fetcher)).liveAvailable,true);
  assert.match(requests[0].url,/\/health$/);
  assert.equal(requests[0].options.method,undefined);
  await ui.startReview('live',fetcher);
  assert.deepEqual(JSON.parse(requests[1].options.body),{mode:'live'});
  await assert.rejects(ui.startReview('automatic',fetcher),/Unsupported review mode/);
  assert.equal(requests.length,2);
});

test('review failure messages do not expose provider responses or transport secrets',async()=>{
  let bodyRead=false;
  await assert.rejects(ui.startReview('live',async()=>({ok:false,status:502,json:async()=>{bodyRead=true;return {error:'SECRET_PROVIDER_KEY'};}})),{message:'The review could not be completed. Please try again.'});
  assert.equal(bodyRead,false);
  await assert.rejects(ui.startReview('live',async()=>{throw new Error('SECRET_PROVIDER_KEY');}),{message:'The review could not be completed. Please try again.'});
});

test('renders advocate separation, rebuttals, citations and a validated simulated outcome',()=>{
  const html=ui.supportReady(ui.evidenceView(evidencePayload),run);
  assert.match(html,/Rider Advocate/);assert.match(html,/Driver Advocate/);
  assert.match(html,/Rider Advocate rebuttal/);assert.match(html,/Driver Advocate rebuttal/);
  assert.match(html,/CHAT-01/);assert.match(html,/GPS-05/);assert.match(html,/POL-1/);
  assert.match(html,/VALIDATED DECISION/);assert.match(html,/S\$0\.00/);assert.match(html,/Checks passed/);
  assert.match(html,/Why automation was allowed/);assert.match(html,/Compare advocate briefs and rebuttals/);
  assert.match(html,/No real refund, charge or account action/);
});

test('rider outcome is concise and backend failure is explicit',()=>{
  const rider=ui.riderReady(ui.evidenceView(evidencePayload),run);
  assert.match(rider,/Rider claim not upheld/);assert.match(rider,/S\$0\.00 simulated adjustment/);assert.match(rider,/480 seconds/);
  const error=ui.errorCard('<offline>');assert.match(error,/BACKEND UNAVAILABLE/);assert.match(error,/&lt;offline&gt;/);assert.match(error,/No case action was taken/);
});

test('live results stay labeled live and human review never renders as resolution or validation success',()=>{
  const humanReview={...run,mode:'live',status:'human_review',judgeProposal:{...run.judgeProposal,outcome:'human_review'},validatedDecision:{...run.validatedDecision,status:'human_review',validationStatus:'human_review',action:'human_review',disposition:null,dispositionLabel:'Human review required'}};
  const evidence=ui.evidenceView(evidencePayload);
  for(const html of [ui.supportReady(evidence,humanReview,'live'),ui.riderReady(evidence,humanReview,'live')]){
    assert.match(html,/LIVE AI/);
    assert.match(html,/Human review required/);
    assert.doesNotMatch(html,/REPLAY|VALIDATED DECISION|Review complete|badge resolved|100%/);
  }
  assert.match(ui.riderReady(evidence,humanReview),/Fee validity remains unresolved/);
  assert.equal(ui.reviewState(humanReview).badge,'review');
  assert.equal(ui.reviewState({...run,validatedDecision:{...run.validatedDecision,validationStatus:'invalid'}}).validated,false);
  assert.equal(ui.reviewState({...run,validatedDecision:undefined}).validated,false);
});
