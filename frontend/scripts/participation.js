(function (global) {
  'use strict';
  const BASE = 'http://127.0.0.1:3001', $ = s => document.querySelector(s);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const tokens = {}, selected = {}, drafts = new Map();
  const reviewErrors = new Map();
  let auditContext, inspectedRunId;
  let role = 'rider', cases = [], sequence = 0, liveAvailable = false, connectionKnown = false, submitting = false, pendingSubmission;
  const activeRole = () => ['rider','driver','support','admin'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'rider';
  const labels = {awaiting_driver:'Awaiting driver',ready:'Ready for review',queued:'Queued for AI review',retrying:'Retry scheduled',review_failed:'AI review unavailable',running:'Review in progress',completed:'Review complete',human_review:'Human review required'};
  function badge(c) { return `<span class="badge ${c.status === 'completed' ? 'resolved' : c.status === 'human_review' ? 'review' : 'pending'}">${esc(labels[c.status] || c.status)}</span>`; }
  async function api(path, options = {}, persona = role, retry = true) {
    if (!tokens[persona]) {
      const response = await global.fetch(`${BASE}/api/workspace/session`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:persona})});
      if (!response.ok) throw new Error('Could not open your workspace. Check the connection.');
      tokens[persona] = (await response.json()).token;
    }
    const response = await global.fetch(`${BASE}${path}`, {...options, headers:{'Content-Type':'application/json',Authorization:`Bearer ${tokens[persona]}`}});
    if(response.status === 401 && retry) { delete tokens[persona]; return api(path, options, persona, false); }
    const data = await response.json();
    if (!response.ok) { const error = new Error(data.error || 'The request could not be completed.'); error.caseId = data.caseId; error.status=response.status; error.code=data.code; throw error; }
    return data;
  }
  const post = (path, data, persona) => api(path,{method:'POST',body:JSON.stringify(data)},persona);
  let tripRequestKey, creatingTrip=false;
  async function fillTrip() {
    if(creatingTrip || submitting)return;
    creatingTrip=true;
    tripRequestKey ||= global.crypto.randomUUID();
    try {
      const trip=await post('/api/workspace/trips',{requestKey:tripRequestKey},'rider');
      $('#trip').value=trip.id;tripRequestKey=undefined;pendingSubmission=undefined;
      $('#trip-message').textContent='Your unique trip reference is ready. This case uses sample trip evidence.';
    } catch { $('#trip-message').textContent='Waiting for a connection to create your reference. Retrying automatically.'; }
    finally {creatingTrip=false;}
  }
  function list(items) {
    return items.map(c=>`<button class="case-button" data-case-id="${esc(c.id)}" aria-pressed="${selected[role] === c.id}"><span class="case-top"><strong>${esc(c.tripReference)}</strong>${badge(c)}</span><small>${esc(c.type)} · ${esc(c.id)}</small></button>`).join('') || '<p class="empty">No cases found.</p>';
  }
  function outcome(c) {
    if (!c.outcome) return `<p>${esc(c.reason)}</p>`;
    return `<section class="money-note"><strong>${esc(c.outcome.disposition)} · ${esc(c.outcome.mode === 'human' ? 'Admin decision' : c.outcome.mode === 'live' ? 'Live AI' : 'Replay')}</strong><p>${esc(c.outcome.explanation)}</p>${c.explanationDetails?`<details><summary>Evidence and policy behind this outcome</summary><ul>${c.explanationDetails.facts.map(f=>`<li>${esc(f)}</li>`).join('')}</ul><p>Policy: ${esc(c.explanationDetails.policyProfile)} · ${esc(c.explanationDetails.policyVersion)}</p><p>${esc(c.explanationDetails.opposingEvidence)}</p><p class="small">${esc(c.explanationDetails.limitation)}</p></details>`:''}<p>${esc(c.outcome.feeTreatment)} · S$${(c.outcome.amountMinor/100).toFixed(2)} simulated adjustment</p></section>`;
  }
  function reviewControls(c, available, connected, error='') {
    const eligible=c.supported && c.driverResponded && c.status!=='completed';
    const needsHuman=c.status==='human_review' && c.result && c.mode==='live';
    const retry=c.technicalFailure || Boolean(error);
    const limitNotice=c.technicalFailure && c.automaticAttempts>=c.automaticAttemptLimit?'Automatic retry limit reached after 3 attempts. Click Retry AI review to try once more.':'';
    const notice=!connected?'Connection lost. The review may still be running. Check status before retrying.':error || limitNotice || (c.status==='retrying'?c.reason:'') || (c.technicalFailure?'AI review could not finish because of a technical issue. No automatic financial action was taken.':!available && eligible && !needsHuman?'AI review is unavailable. Check the provider configuration or contact the service operator.':'');
    return `${notice?`<div class="notice" role="alert">${esc(notice)} <button type="button" class="quiet" id="case-check-status">Check service status</button></div>`:''}${eligible&&!needsHuman&&!['running','queued','retrying'].includes(c.status)?`<p class="small">Both accounts and case evidence will be sent to Tencent ADP. Each attempt uses up to five AI calls.</p><button class="button" id="case-start-review" ${!available||!connected?'disabled':''}>${retry?'Retry AI review':'Start AI review'}</button>`:''}${needsHuman?'<p class="notice">The AI review completed and requested human judgment. A reviewer must assess this case.</p>':''}`;
  }
  function reviewErrorMessage(error) {
    if(error.status===429)return 'AI review has reached its usage limit. Contact the service operator before retrying.';
    if(error.status===409)return 'Another review may already be running. Check the latest status before starting again.';
    if(error.status===400)return 'AI review is not available with the current provider configuration. Contact the service operator.';
    if(error.status===401||error.status===403)return 'Your review session is unavailable. Reopen the Review workspace.';
    if(error.code==='CALL_TIMEOUT'||error.code==='RUN_TIMEOUT'||/TIMEOUT/.test(error.code||''))return 'The AI service timed out. No automatic financial action was taken. You can retry once the service is available.';
    if(error.status>=500)return 'The AI service could not complete this review. No automatic financial action was taken. Check the service status, then retry.';
    return 'The connection was interrupted. The review may still be running; check its status before retrying.';
  }
  function render() {
    auditContext=undefined;
    const c = cases.find(item=>item.id === selected[role]);
    const target = role === 'rider' ? '#rider-cases' : role === 'driver' ? '#driver-cases' : role === 'admin' ? '#admin-cases' : '#queue-list';
    let shown = role==='admin'?cases.filter(c=>['human_review','review_failed'].includes(c.status)||c.finalDecision):cases;
    if(role === 'support') shown = cases.filter(c => `${c.id} ${c.tripReference}`.toLowerCase().includes($('#search').value.trim().toLowerCase()) && ($('#status-filter').value === 'all' || c.status === $('#status-filter').value) && ($('#category-filter').value === 'all' || c.type === $('#category-filter').value));
    $(target).innerHTML = list(shown);
    const detail = role === 'rider' ? '#rider-outcome' : role === 'driver' ? '#driver-detail' : role === 'admin' ? '#admin-detail' : '#workspace';
    if(!c) { $(detail).innerHTML = '<section class="card"><h2>No case selected</h2><p>Choose a request from the list.</p></section>'; return; }
    const head = `<div class="case-top"><h2>${esc(c.tripReference)}</h2>${badge(c)}</div><p class="small">${esc(c.id)} · ${esc(c.type)}</p>`;
    if(role === 'rider') $(detail).innerHTML = `${head}${outcome(c)}<h3>Your submitted account</h3><p class="account-text">${esc(c.ownAccount)}</p><p>${c.driverResponded?'Driver account received.':c.driverAssigned?'Awaiting a driver account; absence of a response does not establish fault.':'No verified driver assignment is available. An administrator must review this case.'}</p><button class="quiet" data-case-export>Download your summary</button>`;
    if(role === 'driver') {
      $(detail).innerHTML = `${head}<p>A ${c.type === 'route'?'route or additional charge':'no-show charge'} is disputed. Describe your arrival, waiting, contact and any relevant trip events.</p>${outcome(c)}${c.driverResponded ? `<h3>Your submitted account</h3><p class="account-text">${esc(c.ownAccount)}</p><p class="small">Saved on the backend. Submitted accounts cannot be edited.</p><button class="quiet" data-case-export>Download your summary</button>` : `<form id="driver-form"><label for="driver-account">Your perspective</label><textarea id="driver-account" rows="6" minlength="10" maxlength="2000" required>${esc(drafts.get(c.id)||'')}</textarea><div class="input-help"><span>10–2,000 characters</span><span id="driver-count">${(drafts.get(c.id)||'').length} / 2000</span></div><button class="button" type="submit">Submit my account</button><p class="small">Saved to this case. Submitting your account starts Live AI review automatically once both accounts are received. Both accounts and trip evidence are sent to Tencent ADP.</p></form>`}<p id="driver-message" role="status"></p>`;
      $('#driver-account')?.addEventListener('input', e=>{drafts.set(c.id,e.target.value);$('#driver-count').textContent=`${e.target.value.length} / 2000`;});
      $('#driver-form')?.addEventListener('submit', async e=>{
        e.preventDefault(); const account = $('#driver-account').value.trim();
        if(account.length<10 || account.length>2000) { $('#driver-message').textContent='Enter 10–2,000 characters.'; return; }
        const button=e.target.querySelector('button');button.disabled=true;
        try { await post(`/api/workspace/cases/${encodeURIComponent(c.id)}/driver-response`,{account},'driver');drafts.delete(c.id);await refresh(); }
        catch(error) { $('#driver-message').textContent=error.message;button.disabled=false; }
      });
    }
    if(role === 'admin') {
      const saved=c.finalDecision, draft=drafts.get('admin:'+c.id)||{};
      $(detail).innerHTML = adminPanel(c,head,draft)+auditPanel()+ '<button class="quiet" data-case-export>Download admin audit</button>';
      loadAudit(c.id);
      const form=$('#admin-decision-form');
      form?.addEventListener('input',()=>{drafts.set('admin:'+c.id,{action:$('#admin-action').value,rationale:$('#admin-rationale').value});});
      form?.addEventListener('submit',async e=>{
        e.preventDefault();const button=form.querySelector('button');button.disabled=true;
        const action=$('#admin-action').value;
        try {await post('/api/workspace/cases/'+encodeURIComponent(c.id)+'/final-decision',{action,amountMinor:action==='reverse_fee'?(c.type==='route'?325:500):0,currency:'SGD',rationale:$('#admin-rationale').value.trim()},'admin');drafts.delete('admin:'+c.id);await refresh();}
        catch(error){$('#admin-message').textContent=error.message;button.disabled=false;}
      });
    }
    if(role === 'support') {
      const ui = global.FareEnoughUI;
      const controls = reviewControls(c,liveAvailable,connectionKnown,reviewErrors.get(c.id));
      const result = c.result ? ui.supportReady(ui.evidenceView(c.evidence),c.result,c.mode).replace(/<button id="start-review"[\s\S]*?<\/button>/,'').replaceAll('DISP-002',esc(c.id)) : '';
      $(detail).innerHTML = `<section class="card">${head}<p>${esc(c.reason)}</p><h3>Rider account</h3><p class="account-text">${esc(c.complaint)}</p><h3>Driver account</h3><p class="account-text">${esc(c.driverAccount || 'Awaiting assigned driver response. Missing responses do not establish fault.')}</p>${controls}${['human_review','review_failed'].includes(c.status)?'<p><a href="#admin">Open Admin decisions to record a final decision</a></p>':''}${c.finalDecision?outcome(c):''}<p id="case-run-message" role="status"></p></section>${(['running','queued','retrying'].includes(c.status)||(!c.result&&c.events?.length))?`<section class="card"><h3>Agent progress · ${esc(c.mode)}</h3>${ui.stageList(c.events,c.status)}</section>`:''}${result}${auditPanel()}<button class="quiet" data-case-export>Download review summary</button>`;
      loadAudit(c.id);
      $('#case-check-status')?.addEventListener('click',async()=>{await refresh();});
      $('#case-start-review')?.addEventListener('click',async e=>{
        if(!liveAvailable||!connectionKnown||['running','queued','retrying'].includes(c.status))return;
        e.target.disabled=true;const id=c.id;reviewErrors.delete(id);
        c.status='running';c.mode='live';c.events=[];render();
        try { await post(`/api/cases/${encodeURIComponent(id)}/runs`,{mode:'live'},'support'); }
        catch(error) { reviewErrors.set(id,reviewErrorMessage(error)); }
        finally { await refresh();if(role==='support'&&selected.support===id)render(); }
      });
    }
  }
  function adminPanel(c,head='',draft={}) {
    const decision=c.finalDecision;
    return '<section class="card">'+head+'<p>'+esc(c.reason)+'</p><h3>Rider account</h3><p class="account-text">'+esc(c.complaint)+'</p><h3>Driver account</h3><p class="account-text">'+esc(c.driverAccount||'No driver account received. Missing evidence does not establish fault.')+'</p>'+
      (c.result?'<details><summary>Original AI proposal and validation</summary><pre class="account-text">'+esc(JSON.stringify({proposal:c.result.judgeProposal,validation:c.result.validatedDecision},null,2))+'</pre></details>':'<p>No completed AI proposal is available.</p>')+
      (decision?'<h3>Final admin decision</h3>'+outcome(c)+'<h4>Reviewer rationale</h4><p class="account-text">'+esc(decision.rationale)+'</p><p class="small">Recorded '+esc(decision.decided_at)+'</p>':!['human_review','review_failed'].includes(c.status)?'<p>This case is not awaiting an admin decision.</p>':'<form id="admin-decision-form"><label for="admin-action">Final decision</label><select id="admin-action" required><option value="close_no_adjustment">Close without financial adjustment - SGD 0.00</option>'+(c.supported?'<option value="reverse_fee" '+(draft.action==='reverse_fee'?'selected':'')+'>'+(c.type==='route'?'Refund unsupported ERP - SGD 3.25 simulated':'Reverse no-show fee - SGD 5.00 simulated')+'</option>':'')+'</select><label for="admin-rationale">Decision rationale (internal)</label><textarea id="admin-rationale" rows="6" minlength="10" maxlength="2000" required>'+esc(draft.rationale||'')+'</textarea><p class="small">Explain the evidence and policy supporting your decision. The final decision cannot be overwritten. All adjustments are simulated. Leave the case open if evidence is insufficient.</p><button class="button" type="submit">Submit final decision</button><p id="admin-message" role="status"></p></form>')+'</section>';
  }

  function auditPanel(){return '<section class="card" id="audit-panel"><h2>Evidence and review history</h2><div id="audit-content" role="status">Loading saved audit records?</div></section>';}
  function citationButton(id){return '<button type="button" class="citation" data-citation="'+esc(id)+'">'+esc(id)+'</button>';}
  function historyMarkup(audit){
    const records=[...(audit.evidence?.evidence||[]),...(audit.evidence?.policyRules||[])];
    return '<details><summary>Inspect current evidence and policy ('+records.length+')</summary><div class="citation-row">'+records.map(r=>citationButton(r.id)).join('')+'</div></details>'+
      (audit.runs.length?audit.runs.map(run=>'<details data-run-id="'+esc(run.runId)+'"><summary>'+esc(run.startedAt)+' · '+esc(run.mode)+' · '+esc(run.status)+'</summary><p class="small">'+esc(run.runId)+'</p>'+(run.error?'<p class="notice">'+esc(run.error)+'</p>':'')+global.FareEnoughUI.stageList(run.events,run.status)+Object.entries(run.artifacts).map(([stage,value])=>'<details><summary>'+esc(stage.replaceAll('_',' '))+'</summary><pre>'+esc(JSON.stringify(value,null,2))+'</pre><div class="citation-row">'+[...new Set([...(value.evidenceIds||[]),...(value.policyRuleIds||[]),...[...(value.claims||[]),...(value.findings||[]),...(value.adverseEvidence||[])].flatMap(v=>[...(v.evidenceIds||[]),...(v.policyRuleIds||[])])])].map(citationButton).join('')+'</div></details>').join('')+(run.decision?'<h3>Validated outcome</h3><pre>'+esc(JSON.stringify(run.decision,null,2))+'</pre>':'<p>No final machine decision was recorded.</p>')+(!run.evidence?'<p>Evidence snapshot was not retained for this older run.</p>':'')+'</details>').join(''):'<p>No AI attempts have been recorded.</p>')+
      (audit.finalDecision?'<details><summary>Final administrator decision</summary><pre>'+esc(JSON.stringify(audit.finalDecision,null,2))+'</pre></details>':'');
  }
  async function loadAudit(id){
    const requestedRole=role;
    try{const audit=await api('/api/workspace/cases/'+encodeURIComponent(id)+'/audit');if(role!==requestedRole||selected[role]!==id)return;auditContext=audit;const panel=$('#audit-content');if(panel)panel.innerHTML=historyMarkup(audit);}
    catch{if(role===requestedRole&&selected[role]===id&&$('#audit-content'))$('#audit-content').innerHTML='<p>Audit records could not load.</p><button type="button" id="reload-audit">Retry loading history</button>';}
  }
  function openCitation(id,runId){
    inspectedRunId=runId;
    const snapshot=runId?auditContext?.runs.find(r=>r.runId===runId)?.evidence:auditContext?.evidence;
    const record=snapshot?.evidence.find(r=>r.id===id)||snapshot?.policyRules.find(r=>r.id===id);
    const dialog=$('#evidence-dialog');if(!dialog)return;
    $('#evidence-content').innerHTML='<h2 id="evidence-title">'+esc(id)+'</h2>'+(record?'<p>Source: '+esc(record.kind==='chat'&&record.data?.type==='unverified_party_submission'?'Submitted party account (unverified)':'Organizer sample evidence / policy')+'</p><p>Visibility: internal review and admin</p><p>Policy: '+esc(snapshot.policyProfile.profileId)+' · '+esc(snapshot.policyProfile.version)+'</p><p>Timestamp: '+esc(record.timestamp||'Not recorded')+'</p><pre>'+esc(JSON.stringify(record,null,2))+'</pre>'+(record.kind==='derived_fact'?'<p>Calculation inputs and version are retained in this derived fact; its cited source records are available above.</p>'+(record.data.sourceEvidenceIds||[]).map(citationButton).join(''):''):'<p>This citation cannot be resolved from the saved evidence. No replacement record has been assumed.</p>');
    if(!dialog.open)dialog.showModal();
  }
  async function refresh() {
    const requestedRole=role, version=++sequence;
    try {
      const [data,health]=await Promise.all([api('/api/workspace/cases',{},requestedRole),global.FareEnoughUI.fetchHealth().catch(()=>null)]);
      if(version!==sequence || requestedRole!==role)return;
      const available=health?.liveAvailable===true;
      const changed=!connectionKnown||liveAvailable!==available||JSON.stringify(cases)!==JSON.stringify(data);
      connectionKnown=true;liveAvailable=available;
      for(const c of data)if(c.status==='completed'||(c.result&&c.mode==='live'))reviewErrors.delete(c.id);
      cases=data;if(!cases.some(c=>c.id===selected[role]))selected[role]=cases[0]?.id;
      $('#connection-status').textContent='Connected · accounts and outcomes saved';if(changed)render();
    } catch(error) { if(version===sequence){connectionKnown=false;$('#connection-status').textContent='Connection interrupted. Saved cases will reload when the service returns. Your form text has been kept.';render();} }
  }
  async function navigate() {
    role=activeRole();
    for(const name of ['rider','driver','support','admin']) {
      $(`#${name}-view`).hidden=name!==role;
      if(name===role)$(`#${name}-link`).setAttribute('aria-current','page');
      else $(`#${name}-link`).removeAttribute('aria-current');
    }
    cases=[];render();await refresh();
  }
  async function boot() {
    $('#complaint').addEventListener('input',()=>{$('#count').textContent=`${$('#complaint').value.length} / 2000`;});
    $('#intake-form').addEventListener('submit',async e=>{
      e.preventDefault();if(submitting||creatingTrip)return;
      const data={tripReference:$('#trip').value.trim(),category:$('#category').value,complaint:$('#complaint').value.trim(),safety:$('#safety').checked};
      if(!data.tripReference){$('#form-message').textContent='Your reference is being generated. Please wait.';await fillTrip();return;}
      const existing=role==='rider' && cases.find(c=>c.tripReference===data.tripReference && c.type===data.category);
      if(existing){selected.rider=existing.id;render();$('#form-message').textContent='Opened the existing case. Preparing a fresh reference.';$('#trip').value='';await fillTrip();return;}
      if(data.complaint.length<10 || data.complaint.length>2000){$('#form-message').textContent='Enter an account of 10–2,000 characters.';return;}
      const signature=JSON.stringify(data);
      if(pendingSubmission?.signature!==signature)pendingSubmission={signature,key:global.crypto.randomUUID()};
      submitting=true;let saved=false;const button=e.target.querySelector('button[type="submit"]');button.disabled=true;
      try { const c=await post('/api/workspace/cases',{...data,requestKey:pendingSubmission.key},'rider');selected.rider=c.id;pendingSubmission=null;saved=true;$('#complaint').value='';$('#count').textContent='0 / 2000';$('#safety').checked=false;$('#trip').value='';$('#form-message').textContent=c.driverAssigned?'Case saved. The assigned driver can now respond from Driver.':'Case saved for human review; no verified driver assignment is available.';await refresh(); }
      catch(error){$('#form-message').textContent=error.message;if(error.caseId){selected.rider=error.caseId;await refresh();}}
      finally{submitting=false;if(saved)await fillTrip();button.disabled=false;}
    });
    for(const id of ['search','status-filter','category-filter'])$(`#${id}`).addEventListener('input',render);
    document.addEventListener('click',async e=>{
      const button=e.target.closest('button');if(!button)return;
      if(button.dataset.citation){openCitation(button.dataset.citation,button.closest('#evidence-dialog')?inspectedRunId:button.closest('[data-run-id]')?.dataset.runId);return;}
      if(button.id==='close-evidence'){$('#evidence-dialog').close();return;}
      if(button.id==='reload-audit'){loadAudit(selected[role]);return;}
      if(button.dataset.caseId){selected[role]=button.dataset.caseId;render();}
      if(button.hasAttribute('data-case-export')){
        const c=cases.find(c=>c.id===selected[role]);if(!c)return;
        let exported;button.disabled=true;
        try{exported=await api('/api/workspace/cases/'+encodeURIComponent(c.id)+'/export');}catch(error){button.disabled=false;button.textContent='Export failed - click to retry';return;}
        button.disabled=false;
        const url=URL.createObjectURL(new Blob([JSON.stringify(exported,null,2)],{type:'application/json'}));
        const a=document.createElement('a');a.href=url;a.download=`${c.id}-${role}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      }
    });
    global.addEventListener('hashchange',navigate);
    await navigate();
    await fillTrip();
    global.setInterval(()=>{if(!document.hidden){if(role==='rider'&&!$('#trip').value)fillTrip();if(!$('#evidence-dialog')?.open&&!document.activeElement?.closest('#audit-panel')&&!['driver-account','admin-rationale','admin-action'].includes(document.activeElement?.id))refresh();}},2500);
  }
  global.FareEnoughWorkspace={api,refresh,reviewControls,reviewErrorMessage,adminPanel,historyMarkup};
  if(typeof module!=='undefined'&&module.exports)module.exports=global.FareEnoughWorkspace;
  if(global.document)boot();
})(typeof window!=='undefined'?window:globalThis);
