(function (global) {
  'use strict';
  const API_BASE='http://127.0.0.1:3001', CASE_ID='DISP-002';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=minor=>`S$${((Number(minor)||0)/100).toFixed(2)}`;
  const list=values=>(Array.isArray(values)?values:[]).map(value=>`<li>${esc(typeof value==='string'?value:value.text||value.claim||JSON.stringify(value))}</li>`).join('');
  const citations=values=>(Array.isArray(values)?values:[]).map(value=>`<span class="citation">${esc(typeof value==='string'?value:value.id||value.evidenceId||value.ref||'Evidence')}</span>`).join('');
  const claimCitations=value=>[...new Set((value?.claims||[]).flatMap(claim=>[...(claim.evidenceIds||[]),...(claim.policyRuleIds||[])]).concat(value?.citations||[]))];
  const pick=(obj,paths,fallback)=>{for(const path of paths){let value=obj;for(const key of path.split('.'))value=value&&value[key];if(value!==undefined&&value!==null)return value;}return fallback;};
  function evidenceView(payload){
    const root=payload&&(payload.case||payload.evidence||payload.data||payload);
    const derived=pick(root,['derivedFacts','derived_facts'],[]);
    const waitFact=Array.isArray(derived)?derived.find(item=>item.id==='derived_wait_duration'||item.unit==='seconds'):null;
    const wait=Number(waitFact?.value??pick(root,['derivedFacts.waitDurationSeconds','derived_facts.wait_duration_seconds','derivedFacts.waitingDurationSeconds','waitDurationSeconds'],480));
    const gps=pick(root,['telemetry','gps','gpsTelemetry','evidence.telemetry'],[]), comms=pick(root,['communications','chat','chatLogs','messages','evidence.communications'],[]), policies=pick(root,['policy.rules','policies','policyRules','cancellationPolicy','evidence.policy'],[]);
    return {raw:root,waitSeconds:wait,gpsCount:Array.isArray(gps)?gps.length:0,communicationCount:Array.isArray(comms)?comms.length:0,policyCount:Array.isArray(policies)?policies.length:(policies?1:0)};
  }
  async function fetchEvidence(fetcher=global.fetch){if(!fetcher)throw new Error('Fetch is unavailable');const response=await fetcher(`${API_BASE}/api/cases/${CASE_ID}/evidence`);if(!response.ok)throw new Error(`Evidence request failed (${response.status})`);return response.json();}
  async function fetchHealth(fetcher=global.fetch){if(!fetcher)throw new Error('Fetch is unavailable');const response=await fetcher(`${API_BASE}/health`);if(!response.ok)throw new Error('Service status is unavailable');return response.json();}
  async function startReview(mode='replay',fetcher=global.fetch,progressId){
    if(!['replay','live'].includes(mode))throw new Error('Unsupported review mode');
    try{if(!fetcher)throw new Error();const response=await fetcher(`${API_BASE}/api/cases/${CASE_ID}/runs`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,...(progressId?{progressId}:{})})});if(!response.ok)throw new Error();return await response.json();}
    catch{throw new Error('The review could not be completed. Please try again.');}
  }
  const startReplay=fetcher=>startReview('replay',fetcher);
  const modeName=mode=>mode==='live'?'Live AI':'Replay';
  const runMode=(run,fallback='replay')=>run?.mode||run?.provider?.mode||fallback;
  function reviewState(run){
    if(run?.status==='running')return {requiresReview:false,validated:false,label:'Review in progress',badge:'pending'};
    const d=run?.validatedDecision||run?.judgeProposal;
    const requiresReview=[run?.status,d?.status,d?.validationStatus,d?.action,d?.outcome,run?.judgeProposal?.outcome].includes('human_review');
    const validated=Boolean(run?.validatedDecision)&&!requiresReview&&(d.validationStatus==='validated'||d.status==='validated');
    return {requiresReview,validated,label:requiresReview?'Human review required':validated?'Review complete':'Decision proposed',badge:requiresReview?'review':validated?'resolved':'pending'};
  }
  function factStrip(ev){return `<div class="facts"><div><small>WAITING DURATION</small><strong>${esc(ev.waitSeconds)} seconds</strong></div><div><small>GPS RECORDS</small><strong>${esc(ev.gpsCount)} points</strong></div><div><small>COMMUNICATIONS</small><strong>${esc(ev.communicationCount)} records</strong></div><div><small>FINANCIAL EFFECT</small><strong>Simulation only</strong></div></div>`;}
  function agentCard(title,label,brief){if(!brief)return `<article class="agent-card waiting"><span>${esc(label)}</span><h3>${esc(title)}</h3><p>Waiting to run.</p></article>`;const opposing=brief.strongestOpposingPoint||brief.adverseEvidence?.[0]?.text;return `<article class="agent-card"><span>${esc(label)}</span><h3>${esc(title)}</h3><p>${esc(brief.position||brief.summary||brief.response||'Structured response received.')}</p>${brief.claims?.length?`<h4>Claims</h4><ul>${list(brief.claims)}</ul>`:''}${opposing?`<div class="opposing"><b>Strongest opposing point</b><p>${esc(opposing)}</p></div>`:''}<div class="citation-row">${citations(claimCitations(brief))}</div></article>`;}
  function rebuttal(title,value){if(!value)return '';const concessions=value.preservedConcessions||value.concessions;return `<details><summary>${esc(title)}</summary><p>${esc(value.response||'')}</p>${concessions?.length?`<b>Concessions preserved</b><ul>${list(concessions)}</ul>`:''}<div class="citation-row">${citations(claimCitations(value))}</div></details>`;}
  const reviewStages = [
    {id:'rider_brief',title:'Rider Advocate',active:'Assessing the rider account against the evidence…',done:'Rider argument prepared.'},
    {id:'driver_brief',title:'Driver Advocate',active:'Assessing the driver account against the evidence…',done:'Driver argument prepared.'},
    {id:'rider_rebuttal',title:'Rider response',active:'Reviewing and responding to the driver’s argument…',done:'Rider response completed.'},
    {id:'driver_rebuttal',title:'Driver response',active:'Reviewing and responding to the rider’s argument…',done:'Driver response completed.'},
    {id:'judge',title:'Judge',active:'Weighing both arguments and checking policy…',done:'Judge proposal received.'},
  ];
  function stageList(events,runStatus){
    const latest=new Map();
    for(const event of [...(Array.isArray(events)?events:[])].sort((a,b)=>(a.sequence||0)-(b.sequence||0)))latest.set(event.stage,event.status);
    const stopped=['failed','human_review','interrupted','retrying','review_failed'].includes(runStatus);
    const rows=reviewStages.map(stage=>{
      const status=latest.get(stage.id);
      const state=['complete','completed','succeeded'].includes(status)?'completed':status==='failed'?'failed':stopped?'stopped':['started','running'].includes(status)?'running':'waiting';
      const description=state==='completed'?stage.done:state==='running'?stage.active:state==='failed'?'This stage failed. A reviewer is needed.':state==='stopped'?'Review stopped before this stage completed.':'Waiting to start.';
      return {...stage,state,description};
    });
    const completed=rows.filter(row=>row.state==='completed').length,percent=completed*20;
    const summary=completed===5?'Agent review finished':rows.some(row=>row.state==='failed'||row.state==='stopped')?'Agent review stopped':rows.some(row=>row.state==='running')?'Agents are reviewing the case':'Ready to begin';
    return `<div class="review-progress"><div class="progress-caption"><strong>${percent}%</strong><span>${summary} · ${completed} of 5 stages complete</span></div><div class="review-progress-track" role="progressbar" aria-label="Agent review progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%"></span></div></div><ol class="stages">${rows.map((row,index)=>`<li class="${row.state}"><div class="stage-track" aria-hidden="true"><span></span></div><div class="stage-heading"><span class="stage-number">${String(index+1).padStart(2,'0')}</span><b>${row.title}</b><span class="stage-state">${row.state==='completed'?'Complete':row.state==='running'?'In progress':row.state==='failed'?'Failed':row.state==='stopped'?'Stopped':'Queued'}</span></div><small>${row.description}</small></li>`).join('')}</ol>`;
  }
  function decisionCard(run){
    const d=run.validatedDecision||run.judgeProposal;if(!d)return '';
    const state=reviewState(run);
    return `<section class="card ${state.validated?'decision':'unavailable'}"><div class="case-top"><span class="eyebrow">${state.requiresReview?'HUMAN REVIEW REQUIRED':state.validated?'VALIDATED DECISION':'DECISION PROPOSAL'} · ${modeName(runMode(run)).toUpperCase()}</span><span class="badge ${state.badge}">${state.validated?'Validated':state.label}</span></div><div class="decision-grid"><div><small>DISPOSITION</small><strong>${esc(state.requiresReview?'Human review required':d.dispositionLabel||d.disposition||d.outcome||d.action||'Decision proposed')}</strong></div><div><small>FEE TREATMENT</small><strong>${esc(state.requiresReview?'No automatic change':d.feeTreatment||'No change')}</strong></div><div><small>SIMULATED ADJUSTMENT</small><strong>${money(state.requiresReview?0:d.amountMinor??d.proposedAdjustmentCents)}</strong></div><div><small>VALIDATION</small><strong>${state.validated?'Checks passed':state.requiresReview?'Review required':'Pending'}</strong></div></div><p class="decision-copy">${esc(d.explanation||'')}</p>${d.decisiveFacts?.length?`<h3>Decisive facts</h3><ul>${list(d.decisiveFacts)}</ul>`:''}<div class="citation-row">${citations(d.policyRuleIds||d.policyCitations)}</div><p class="simulation">No real refund, charge or account action was performed.</p></section>`;
  }
  function supportReady(ev,run,mode='replay'){
    const label=modeName(runMode(run,mode)).toUpperCase();
    return `<section class="card workspace-head"><div><span class="eyebrow">${label} ${run?'RUN':'READY'} · ${esc(run?.caseId||'Case review')}</span><h2>No-show charge review</h2><p>Case evidence</p></div></section><section class="card"><div class="case-top"><h2>Evidence snapshot</h2><span class="replay-label">${label}</span></div>${factStrip(ev)}<p class="small">Deterministic code calculates the waiting duration. Agents interpret the record; they do not calculate or execute money.</p></section><section class="card"><div class="case-top"><h2>Review stages</h2><span class="run-status">${esc(run?reviewState(run).label:'Ready')}</span></div>${stageList(run?.events,run?.status)}</section><section class="card"><h2>Independent advocate briefs</h2><div class="role-grid">${agentCard('Rider Advocate','RIDER',run?.riderBrief)}${agentCard('Driver Advocate','DRIVER',run?.driverBrief)}</div>${rebuttal('Rider Advocate rebuttal',run?.riderRebuttal)}${rebuttal('Driver Advocate rebuttal',run?.driverRebuttal)}</section>${run?.judgeProposal?`<section class="card judge"><span class="eyebrow">JUDGE PROPOSAL</span><h2>${esc(run.judgeProposal.outcome||run.judgeProposal.disposition||run.judgeProposal.action||'Proposed ruling')}</h2><p>${esc(run.judgeProposal.explanation||'')}</p><div class="citation-row">${citations(run.judgeProposal.policyRuleIds)}</div></section>`:''}${decisionCard(run||{})}`;
  }
  function riderReady(ev,run,mode='replay'){
    const d=run&&(run.validatedDecision||run.judgeProposal),label=modeName(runMode(run,mode)).toUpperCase();
    if(!d)return `<div class="rider-grid"><section class="card"><span class="eyebrow">CASE DISP-002 · ${label}</span><h2>No-show charge under review</h2>${factStrip(ev)}<p>The evidence is ready. Start ${mode==='live'?'the live AI review':'the three-agent replay'} from the Support review view.</p><a class="button inline-button" href="#support">Open support review <span>→</span></a></section><section class="card"><h2>What we will check</h2><ul class="friendly-list"><li>Driver arrival and waiting timestamps</li><li>Contact attempts and app events</li><li>The policy active for this seeded case</li><li>Whether the proposed outcome passes deterministic checks</li></ul></section></div>`;
    const state=reviewState(run);
    return `<div class="rider-grid"><section class="card outcome"><div class="case-top"><span class="eyebrow">CASE DISP-002 · ${label}</span><span class="badge ${state.badge}">${state.label}</span></div><h2>${esc(state.requiresReview?'Human review required':d.dispositionLabel||d.disposition||d.outcome||'Decision proposed')}</h2><p>${esc(d.explanation||'')}</p><div class="amount">${money(state.requiresReview?0:d.amountMinor??d.proposedAdjustmentCents)} simulated adjustment</div><p class="money-note">${esc(state.requiresReview?'Fee validity remains unresolved':d.feeTreatment||'No fare change')} · No real payment action occurred.</p></section><section class="card"><h2>Why this outcome?</h2><ul class="friendly-list">${list(d.decisiveFacts||[`The recorded waiting duration was ${ev.waitSeconds} seconds.`])}</ul><h3>Policy references</h3><div class="citation-row">${citations(d.policyRuleIds||d.policyCitations)}</div><p class="small">If evidence is incomplete or contradictory, FareEnough sends the case to a person instead of automating an outcome.</p></section></div>`;
  }
  function errorCard(message){return `<section class="card unavailable"><span class="eyebrow">BACKEND UNAVAILABLE</span><h2>The review service is not responding.</h2><p>${esc(message)}</p><p>Start the backend on port 3001, then reload. No case action was taken.</p><button class="quiet" onclick="location.reload()">Try again</button></section>`;}
  const api={esc,money,evidenceView,fetchEvidence,fetchHealth,startReview,startReplay,reviewState,factStrip,agentCard,stageList,decisionCard,supportReady,riderReady,errorCard};global.FareEnoughUI=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
