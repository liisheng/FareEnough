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

function browserHarness({liveAvailable=true,response=run}={}){
  const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
  const nodes=new Map(),listeners={},requests=[];
  const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{value:selector==='#review-mode'?'replay':'',disabled:selector==='#live-mode-option',textContent:'',innerHTML:'',listeners:{},setAttribute(){},addEventListener(name,fn){this.listeners[name]=fn;},insertAdjacentHTML(_position,html){this.innerHTML=html+this.innerHTML;}});return nodes.get(selector);};
  const document={querySelector:node,addEventListener:(name,fn)=>{(listeners[name]??=[]).push(fn);}};
  const fetch=async(url,options={})=>{requests.push({url,options});return {ok:true,json:async()=>url.endsWith('/health')?{mode:'live',liveAvailable}:url.endsWith('/evidence')?evidencePayload:response};};
  const window={document,fetch,addEventListener(){}};
  const location={hash:'#support'};
  const context=vm.createContext({window,document,location});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../scripts/app.js'),'utf8'),context);
  return {node,requests,select:async mode=>{const select=node('#review-mode');select.value=mode;await select.listeners.change({target:select});},click:()=>Promise.all(listeners.click.map(fn=>fn({target:{closest:selector=>selector==='#start-review'?node(selector):null}})))};
}

test('page startup and mode selection never start a model call; the explicit action uses live mode',async()=>{
  const harness=browserHarness({response:{...run,mode:'live'}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(harness.node('#review-mode').value,'replay');
  assert.equal(harness.node('#live-mode-option').disabled,false);
  assert.equal(harness.requests.filter(request=>request.options.method==='POST').length,0);
  await harness.select('live');
  assert.match(harness.node('#support-content').innerHTML,/Start live AI review/);
  assert.equal(harness.requests.filter(request=>request.options.method==='POST').length,0);
  await harness.click();
  const posts=harness.requests.filter(request=>request.options.method==='POST');
  assert.equal(posts.length,1);
  assert.deepEqual(JSON.parse(posts[0].options.body),{mode:'live'});
  assert.match(harness.node('#rider-content').innerHTML,/LIVE AI/);
});

test('unavailable live mode stays disabled and a human-review run is labeled for the queue',async()=>{
  const response={...run,status:'human_review',validatedDecision:{...run.validatedDecision,validationStatus:'human_review',action:'human_review'}};
  const harness=browserHarness({liveAvailable:false,response});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(harness.node('#live-mode-option').disabled,true);
  await harness.select('live');
  assert.equal(harness.node('#review-mode').value,'replay');
  await harness.click();
  assert.deepEqual(JSON.parse(harness.requests.find(request=>request.options.method==='POST').options.body),{mode:'replay'});
  assert.equal(harness.node('#queue-badge').textContent,'Human review required');
  assert.equal(harness.node('#queue-badge').className,'badge review');
});
