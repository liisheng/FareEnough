(function (global) {
  'use strict';
  const BASE = 'http://127.0.0.1:3001', $ = s => document.querySelector(s);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const tokens = {}, selected = {}, drafts = new Map();
  let role = 'rider', cases = [], sequence = 0, liveAvailable = false, mode = 'replay', submitting = false, pendingSubmission, runError = '';
  const activeRole = () => ['rider','driver','support'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'rider';
  const labels = {awaiting_driver:'Awaiting driver',ready:'Ready for review',running:'Review in progress',completed:'Review complete',human_review:'Human review required'};
  function badge(c) { return `<span class="badge ${c.status === 'completed' ? 'resolved' : c.status === 'human_review' ? 'review' : 'pending'}">${esc(labels[c.status] || c.status)}</span>`; }
  async function api(path, options = {}, persona = role, retry = true) {
    if (!tokens[persona]) {
      const response = await global.fetch(`${BASE}/api/workspace/session`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:persona})});
      if (!response.ok) throw new Error('Could not open a demo session. Check the backend.');
      tokens[persona] = (await response.json()).token;
    }
    const response = await global.fetch(`${BASE}${path}`, {...options, headers:{'Content-Type':'application/json',Authorization:`Bearer ${tokens[persona]}`}});
    if(response.status === 401 && retry) { delete tokens[persona]; return api(path, options, persona, false); }
    const data = await response.json();
    if (!response.ok) { const error = new Error(data.error || 'The request could not be completed.'); error.caseId = data.caseId; throw error; }
    return data;
  }
  const post = (path, data, persona) => api(path,{method:'POST',body:JSON.stringify(data)},persona);
  let tripRequestKey, creatingTrip=false;
  async function fillTrip() {
    if(creatingTrip || submitting)return;
    creatingTrip=true;$('#new-demo-trip').disabled=true;
    tripRequestKey ||= global.crypto.randomUUID();
    try {
      const trip=await post('/api/workspace/trips',{requestKey:tripRequestKey},'rider');
      $('#trip').value=trip.id;tripRequestKey=undefined;pendingSubmission=undefined;
      $('#trip-message').textContent='Unique demo reference ready. Uses a separate copy of the organizer trip evidence.';
    } catch { $('#trip-message').textContent='Could not generate a trip reference. Check the backend, then click New demo trip to retry.'; }
    finally {creatingTrip=false;$('#new-demo-trip').disabled=false;}
  }
  function list(items) {
    return items.map(c=>`<button class="case-button" data-case-id="${esc(c.id)}" aria-pressed="${selected[role] === c.id}"><span class="case-top"><strong>${esc(c.tripReference)}</strong>${badge(c)}</span><small>${esc(c.type)} · ${esc(c.id)}</small></button>`).join('') || '<p class="empty">No cases found.</p>';
  }
  function outcome(c) {
    if (!c.outcome) return `<p>${esc(c.reason)}</p>`;
    return `<section class="money-note"><strong>${esc(c.outcome.disposition)} · ${esc(c.outcome.mode === 'live' ? 'Live AI' : 'Replay')}</strong><p>${esc(c.outcome.explanation)}</p><p>${esc(c.outcome.feeTreatment)} · S$${(c.outcome.amountMinor/100).toFixed(2)} simulated adjustment</p></section>`;
  }
  function render() {
    const c = cases.find(item=>item.id === selected[role]);
    const target = role === 'rider' ? '#rider-cases' : role === 'driver' ? '#driver-cases' : '#queue-list';
    let shown = cases;
    if(role === 'support') shown = cases.filter(c => `${c.id} ${c.tripReference}`.toLowerCase().includes($('#search').value.trim().toLowerCase()) && ($('#status-filter').value === 'all' || c.status === $('#status-filter').value) && ($('#category-filter').value === 'all' || c.type === $('#category-filter').value));
    $(target).innerHTML = list(shown);
    const detail = role === 'rider' ? '#rider-outcome' : role === 'driver' ? '#driver-detail' : '#workspace';
    if(!c) { $(detail).innerHTML = '<section class="card"><h2>No case selected</h2><p>Choose a request from the list.</p></section>'; return; }
    const head = `<div class="case-top"><h2>${esc(c.tripReference)}</h2>${badge(c)}</div><p class="small">${esc(c.id)} · ${esc(c.type)}</p>`;
    if(role === 'rider') $(detail).innerHTML = `${head}${outcome(c)}<h3>Your submitted account</h3><p class="account-text">${esc(c.ownAccount)}</p><p>${c.driverResponded?'Driver account received.':c.driverAssigned?'Awaiting a driver account; absence of a response does not establish fault.':'No verified driver assignment is available. Support must review this case.'}</p><button class="quiet" data-case-export>Download your summary</button>`;
    if(role === 'driver') {
      $(detail).innerHTML = `${head}<p>A ${c.type === 'route'?'route or additional charge':'no-show charge'} is disputed. Describe your arrival, waiting, contact and any relevant trip events.</p>${outcome(c)}${c.driverResponded ? `<h3>Your submitted account</h3><p class="account-text">${esc(c.ownAccount)}</p><p class="small">Saved on the backend. Submitted accounts cannot be edited.</p><button class="quiet" data-case-export>Download your summary</button>` : `<form id="driver-form"><label for="driver-account">Your perspective</label><textarea id="driver-account" rows="6" minlength="10" maxlength="2000" required>${esc(drafts.get(c.id)||'')}</textarea><div class="input-help"><span>10–2,000 characters</span><span id="driver-count">${(drafts.get(c.id)||'').length} / 2000</span></div><button class="button" type="submit">Submit my account</button><p class="small">Saved to this case. Support starts the AI review explicitly after both accounts arrive.</p></form>`}<p id="driver-message" role="status"></p>`;
      $('#driver-account')?.addEventListener('input', e=>{drafts.set(c.id,e.target.value);$('#driver-count').textContent=`${e.target.value.length} / 2000`;});
      $('#driver-form')?.addEventListener('submit', async e=>{
        e.preventDefault(); const account = $('#driver-account').value.trim();
        if(account.length<10 || account.length>2000) { $('#driver-message').textContent='Enter 10–2,000 characters.'; return; }
        const button=e.target.querySelector('button');button.disabled=true;
        try { await post(`/api/workspace/cases/${encodeURIComponent(c.id)}/driver-response`,{account},'driver');drafts.delete(c.id);await refresh(); }
        catch(error) { $('#driver-message').textContent=error.message;button.disabled=false; }
      });
    }
    if(role === 'support') {
      const ui = global.FareEnoughUI;
      const ready = c.supported && c.driverResponded && !['running','completed'].includes(c.status);
      const controls = ready ? `<label for="case-review-mode">Review mode</label><select id="case-review-mode"><option value="replay" ${mode==='replay'?'selected':''}>Replay · offline pipeline check</option><option value="live" ${mode==='live'?'selected':''} ${liveAvailable?'':'disabled'}>Live AI · Tencent ADP</option></select><p class="small">Live AI sends both submitted accounts and the demo trip evidence to Tencent ADP (up to five calls). Replay cannot decide new statements and will request human review.</p><button class="button" id="case-start-review">Start ${mode==='live'?'Live AI':'replay'} review</button>` : '';
      const result = c.result ? ui.supportReady(ui.evidenceView(c.evidence),c.result,c.mode).replace(/<button id="start-review"[\s\S]*?<\/button>/,'').replaceAll('DISP-002',esc(c.id)) : '';
      $(detail).innerHTML = `<section class="card">${head}<p>${esc(c.reason)}</p><h3>Rider account</h3><p class="account-text">${esc(c.complaint)}</p><h3>Driver account</h3><p class="account-text">${esc(c.driverAccount || 'Awaiting assigned driver response. Missing responses do not establish fault.')}</p>${controls}<p id="case-run-message" role="status"></p></section>${(c.status==='running'||(!c.result&&c.events?.length))?`<section class="card"><h3>Agent progress · ${esc(c.mode)}</h3>${ui.stageList(c.events,c.status)}</section>`:''}${result}<button class="quiet" data-case-export>Download support summary</button>`;
      $('#case-review-mode')?.addEventListener('change',e=>{mode=e.target.value;render();});
      $('#case-start-review')?.addEventListener('click',async e=>{
        e.target.disabled=true;runError='';const id=c.id, chosen=mode;
        c.status='running';c.mode=chosen;c.events=[];render();
        try { await post(`/api/cases/${encodeURIComponent(id)}/runs`,{mode:chosen},'support'); }
        catch(error) { runError=error.message; }
        finally { await refresh();if(role==='support' && selected.support===id)$('#case-run-message').textContent=runError; }
      });
    }
  }
  async function refresh() {
    const requestedRole=role, version=++sequence;
    try {
      const data=await api('/api/workspace/cases',{},requestedRole);
      if(version!==sequence || requestedRole!==role)return;
      const changed=JSON.stringify(cases)!==JSON.stringify(data);
      cases=data;if(!cases.some(c=>c.id===selected[role]))selected[role]=cases[0]?.id;
      $('#connection-status').textContent='Connected · accounts and outcomes saved on the backend';if(changed)render();
    } catch(error) { if(version===sequence)$('#connection-status').textContent=`Backend unavailable: ${error.message} Your form text has been kept.`; }
  }
  async function navigate() { role=activeRole();cases=[];render();await refresh(); }
  async function boot() {
    $('#new-demo-trip').addEventListener('click',fillTrip);
    $('#complaint').addEventListener('input',()=>{$('#count').textContent=`${$('#complaint').value.length} / 2000`;});
    $('#intake-form').addEventListener('submit',async e=>{
      e.preventDefault();if(submitting||creatingTrip)return;
      const data={tripReference:$('#trip').value.trim(),category:$('#category').value,complaint:$('#complaint').value.trim(),safety:$('#safety').checked};
      if(!data.tripReference){$('#form-message').textContent='Generate a demo trip reference first.';return;}
      const existing=role==='rider' && cases.find(c=>c.tripReference===data.tripReference && c.type===data.category);
      if(existing){selected.rider=existing.id;render();$('#form-message').textContent='Opened the existing case. Choose New demo trip to test a separate scenario.';return;}
      if(data.complaint.length<10 || data.complaint.length>2000){$('#form-message').textContent='Enter an account of 10–2,000 characters.';return;}
      const signature=JSON.stringify(data);
      if(pendingSubmission?.signature!==signature)pendingSubmission={signature,key:global.crypto.randomUUID()};
      submitting=true;const button=e.target.querySelector('button[type="submit"]');button.disabled=true;
      try { const c=await post('/api/workspace/cases',{...data,requestKey:pendingSubmission.key},'rider');selected.rider=c.id;pendingSubmission=null;$('#form-message').textContent=c.driverAssigned?'Case saved. The assigned demo driver can now respond from Driver.':'Case saved for human review; no verified driver assignment is available.';await refresh(); }
      catch(error){$('#form-message').textContent=error.message;if(error.caseId){selected.rider=error.caseId;await refresh();}}
      finally{submitting=false;button.disabled=false;}
    });
    for(const id of ['search','status-filter','category-filter'])$(`#${id}`).addEventListener('input',render);
    document.addEventListener('click',e=>{
      const button=e.target.closest('button');if(!button)return;
      if(button.dataset.caseId){selected[role]=button.dataset.caseId;render();}
      if(button.hasAttribute('data-case-export')){
        const c=cases.find(c=>c.id===selected[role]);if(!c)return;
        const url=URL.createObjectURL(new Blob([JSON.stringify(c,null,2)],{type:'application/json'}));
        const a=document.createElement('a');a.href=url;a.download=`${c.id}-${role}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      }
    });
    global.addEventListener('hashchange',navigate);
    await navigate();
    await fillTrip();
    try { liveAvailable=(await global.FareEnoughUI.fetchHealth()).liveAvailable===true;render(); }catch{}
    global.setInterval(()=>{if(!document.hidden && document.activeElement?.id!=='driver-account')refresh();},2500);
  }
  global.FareEnoughWorkspace={api,refresh};
  if(global.document)boot();
})(typeof window!=='undefined'?window:globalThis);
