const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let localCases = [];
let storageAvailable = true;
try {
  const saved = JSON.parse(localStorage.getItem('fareenough.requests.v1') || '[]');
  if (!Array.isArray(saved)) throw new Error('Invalid storage');
  localCases = saved.filter(c => typeof c.id === 'string' && /^LOCAL-/.test(c.id) && ['no-show','route'].includes(c.type) && typeof c.complaint === 'string' && c.complaint.length <= 2000 && ['pending','review'].includes(c.status)).map(c => ({id:c.id,type:c.type,complaint:c.complaint,tripReference:typeof c.tripReference === 'string' ? c.tripReference.slice(0,80) : '',driverAccount:typeof c.driverAccount === 'string' ? c.driverAccount.slice(0,2000) : '',driverFiled:typeof c.driverFiled === 'string' ? c.driverFiled : '',status:c.status,filed:typeof c.filed === 'string'?c.filed:'Unknown',example:false,title:c.type === 'route'?'Route / charge review':'No-show review',amount:0,evidence:[],reason:'Local request only. Backend not connected; no evidence has been retrieved or adjudication performed.',outcome:c.status === 'review'?'Human review requested; no adjustment applied.':'Backend unavailable; request saved locally.'}));
} catch { storageAvailable = false; }
let riderId = localCases[0]?.id || null;
let supportId = localCases[0]?.id || null;
let driverId = localCases[0]?.id || null;
const driverDrafts = new Map();
const allCases = () => localCases;
const getCase = (id) => allCases().find(c => c.id === id);
const statusText = (c) => c.status === 'resolved'?'Resolved example':c.status === 'review'?'Review required':!c.example && !c.driverAccount?'Awaiting driver response':'Both accounts received';
const badge = (c) => `<span class="badge ${c.status}">${statusText(c)}</span>`;
const policy = () => '<div class="policy">Policy not assigned. Trip records and charges have not been verified.</div>';
const citations = () => '';
function listButton(c, selected, target) { return `<button class="case-button" data-${target}="${escapeHtml(c.id)}" aria-pressed="${c.id === selected}"><span class="case-top"><strong>${escapeHtml(c.id)}</strong>${badge(c)}</span><small>${escapeHtml(c.title)} ? Local request</small><small>${escapeHtml(c.tripReference || 'Trip reference not provided')}</small></button>`; }
function caseOutcome(c) {
  if (c.example || c.status === 'review') return c.outcome;
  return c.driverAccount ? 'Both accounts received; review has not started.' : 'Awaiting driver response; no adjustment applied.';
}
function driverOutcome(c) {
  if (c.status === 'review') return 'Human review required; no decision against either party.';
  return c.driverAccount ? 'Your account is received. No ruling or earnings adjustment has been made.' : 'Your account is requested. No ruling has been made.';
}
function renderDriver() {
  $('#driver-cases').innerHTML = localCases.length ? localCases.map(c => listButton(c,driverId,'driver-case')).join('') : '<p class="empty">No disputes awaiting your response.</p>';
  const c = getCase(driverId);
  if (!c || c.example) { $('#driver-detail').innerHTML = '<span class="eyebrow">YOUR PERSPECTIVE</span><h2>One trip. Two accounts.</h2><p>Choose a request to see its trip details and submit your own account. You will see a neutral category summary, not the rider’s private narrative.</p>'; return; }

  $('#driver-detail').innerHTML = `<div class="case-top"><span class="eyebrow">${escapeHtml(c.id)}</span>${badge(c)}</div><h2>Share your side of the journey</h2><div class="trip-summary"><strong>${escapeHtml(c.tripReference || "Trip reference not provided")}</strong><p>Rider-entered reference; not verified.</p></div><h3>What needs reviewing</h3><p>${c.type === 'no-show'?'A no-show charge on this trip is disputed. Please describe your arrival, waiting time, pickup location, and contact attempts.':'The route or an additional charge on this trip is disputed. Please describe route changes, any rider agreement, and the basis for additional charges.'}</p><p class="small">This neutral summary does not establish fault. Support can review both independently submitted accounts.</p>${policy(c)}<div class="money-note">${driverOutcome(c)}</div>${c.driverAccount?`<h3>Your submitted account</h3><p class="account-text">${escapeHtml(c.driverAccount)}</p><p class="small">Saved ${escapeHtml(c.driverFiled)}. Editing after submission is not available in this demo.</p><button class="quiet" data-export="driver">Download driver summary</button>`:`<form id="driver-form"><label for="driver-account">Your perspective</label><textarea id="driver-account" rows="6" minlength="10" maxlength="2000" required placeholder="Describe the trip and the records that could support your account. ">${escapeHtml(driverDrafts.get(c.id)||'')}</textarea><div class="input-help"><span>10–2,000 characters</span><span id="driver-count">${(driverDrafts.get(c.id)||'').length} / 2000</span></div><button class="button" type="submit">Submit my account locally</button><p class="small">Links to this case in this browser only. No AI review or external message is triggered.</p></form>`}<p id="driver-message" role="status"></p>`;
  $('#driver-account')?.addEventListener('input', () => {
    const field = $('#driver-account'); field.setCustomValidity('');
    driverDrafts.set(c.id,field.value); $('#driver-count').textContent = `${field.value.length} / 2000`;
  });
  $('#driver-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const field = $('#driver-account'), text = field.value.trim();
    if (text.length < 10 || text.length > 2000) { field.setCustomValidity('Enter an account between 10 and 2,000 characters.'); field.reportValidity(); return; }
    if (c.driverAccount) return;
    c.driverAccount = text; c.driverFiled = new Date().toLocaleString('en-SG',{timeZone:'Asia/Singapore'})+' SGT';
    try { localStorage.setItem('fareenough.requests.v1',JSON.stringify(localCases)); storageAvailable=true; } catch { storageAvailable=false; }
    driverDrafts.delete(c.id);
    renderDriver(); renderRider(); renderSupport();
    $('#driver-message').textContent = storageAvailable ? 'Your account was saved to the same case. Backend review is not connected.' : 'Your account is in memory only because browser storage failed. Copy your submitted account before closing this tab.';
  });
}
function renderRider() {
  $('#rider-cases').innerHTML = allCases().map(c => listButton(c,riderId,'rider-case')).join('') || '<p class="empty">No requests submitted yet.</p>';
  const c = getCase(riderId);
  if (!c) { $('#rider-outcome').innerHTML = '<h2>No case selected</h2><p>Your request status will appear here after submission.</p>'; return; }
  $('#rider-outcome').innerHTML = `<div class="case-top"><span class="eyebrow">${c.example?'OUTCOME EXAMPLE':'REQUEST STATUS'} · ${escapeHtml(c.id)}</span>${badge(c)}</div><h2>${caseOutcome(c)}</h2><p>${c.reason}</p>${c.complaint?`<details><summary>Your submitted perspective</summary><p>${escapeHtml(c.complaint)}</p></details>`:''}${policy(c)}<h3>Supporting references</h3>${citations(c) || '<p class="small">No evidence retrieved. Waiting for backend integration.</p>'}<p class="small">${c.example?'Illustrative outcome only; no AI run or financial action occurred.':'Next step: this request needs the backend and a support reviewer before it can proceed.'}</p><button class="quiet" data-export="rider">Download rider summary</button>`;
}
function renderQueue() {
  const matches = allCases().filter(c => c.id.toLowerCase().includes($('#search').value.trim().toLowerCase()) && ($('#status-filter').value === 'all' || c.status === $('#status-filter').value) && ($('#category-filter').value === 'all' || c.type === $('#category-filter').value));
  $('#queue-list').innerHTML = matches.map(c => listButton(c,supportId,'support-case')).join('') || '<p class="empty">No cases match these filters.</p>';
}
function renderSupport() {
  renderQueue();
  const c = getCase(supportId);
  if (!c) { $('#workspace').innerHTML = '<section class="card"><h2>No case selected</h2><p>Submitted requests will appear in the queue.</p></section>'; return; }
  $('#workspace').innerHTML = `<section class="card"><div class="case-top"><h2>${escapeHtml(c.id)}</h2>${badge(c)}</div><p>Filed: ${escapeHtml(c.filed)}</p><div class="trip-summary">Trip reference: ${escapeHtml(c.tripReference || 'Not provided ? previous request used a removed demo trip')}<p>Unverified. No trip records connected.</p></div>${policy(c)}<h3>Rider account</h3><p>${escapeHtml(c.complaint)}</p><h3>Driver account</h3><p>${escapeHtml(c.driverAccount || 'Awaiting driver response. A missing response does not establish fault.')}</p></section><section class="card"><h2>Evidence & review</h2><p>No verified evidence, charges, policy, or route records are available.</p><p>Rider Advocate, Driver Advocate, and Judge have not run. No decision or financial adjustment has been made.</p><p>Human decisions require backend validation and verified records.</p><button class="quiet" data-export="support">Download support summary</button></section>`;
}
function renderView() {
  const active = ['#rider','#driver','#support'].includes(location.hash) ? location.hash.slice(1) : 'rider';
  for (const name of ['rider','driver','support']) {
    $(`#${name}-view`).hidden = name !== active;
    const link = $(`#${name}-link`);
    if(name === active) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
  }
}

$('#complaint').addEventListener('input',() => { $('#count').textContent=`${$('#complaint').value.length} / 2000`; $('#complaint').setCustomValidity(''); });
$('#intake-form').addEventListener('submit',event => {
  event.preventDefault();
  const complaint = $('#complaint').value.trim(), type = $('#category').value, tripReference = $('#trip').value.trim();
  if (!tripReference || tripReference.length > 80) { $('#form-message').textContent='Enter a trip reference of up to 80 characters.'; return; }
  if (!['no-show','route'].includes(type)) { $('#form-message').textContent='Choose a concern.'; return; }
  if (complaint.length < 10) { $('#complaint').setCustomValidity('Please describe your concern in at least 10 characters.'); $('#complaint').reportValidity(); return; }
  const existing = localCases.find(c => c.type === type && c.tripReference === tripReference);
  if (existing) { riderId=existing.id; renderRider(); $('#form-message').textContent=`A local request already exists: ${existing.id}. It is selected in Your cases.`; return; }
  const review = $('#safety').checked;
  const c = {id:`LOCAL-${Date.now()}`,type,tripReference,complaint,status:review?'review':'pending',example:false,title:type==='route'?'Route / charge review':'No-show review',filed:new Date().toLocaleString('en-SG',{timeZone:'Asia/Singapore'})+' SGT',amount:0,evidence:[],reason:review?'Safety or another unsupported concern was flagged. A person must review this; no automated ruling is available.':'Local request only. Backend not connected; no evidence has been retrieved or adjudication performed.',outcome:review?'Human review requested; no adjustment applied.':'Backend unavailable; request saved locally.'};
  localCases.unshift(c);
  try { localStorage.setItem('fareenough.requests.v1',JSON.stringify(localCases)); storageAvailable=true; } catch { storageAvailable=false; }
  riderId=c.id; driverId=c.id; supportId=c.id; renderRider(); renderDriver(); renderSupport();
  $('#form-message').textContent=storageAvailable?'Saved in this browser. No AI run has started.':'Browser storage unavailable. Request is in memory only; keep this tab open. Your input has been preserved.';
});
for (const id of ['search','status-filter','category-filter']) $(`#${id}`).addEventListener('input',renderQueue);
document.addEventListener('click',event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.riderCase) { riderId=button.dataset.riderCase; renderRider(); }
  if (button.dataset.driverCase) { driverId=button.dataset.driverCase; renderDriver(); }
  if (button.dataset.supportCase) { supportId=button.dataset.supportCase; renderSupport(); }
  if (button.dataset.export) {
    const role=button.dataset.export, support=role==='support', c=getCase(support?supportId:role==='driver'?driverId:riderId);
    const report={caseId:c.id,mode:'local-preview',tripReference:c.tripReference || null,tripVerified:false,status:c.status,category:c.type,policy:null,explanation:role==='driver'?driverOutcome(c):caseOutcome(c),reason:c.reason,evidenceReferences:c.evidence,adjustmentCents:null,ownAccount:role==='driver'?c.driverAccount || null:c.complaint || null};
    if(support) Object.assign(report,{riderAccount:c.complaint || null,driverAccount:c.driverAccount || null,arguments:[],judgeProposal:null,validation:'not-run',confidence:null,humanOverride:null,events:[],provider:null});
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})); const a=document.createElement('a');a.href=url;a.download=`${c.id}-${role}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
});

window.addEventListener('hashchange',renderView);
renderRider();renderDriver();renderSupport();renderView();
if(!storageAvailable) $('#form-message').textContent='Saved data could not be loaded. New requests can still be previewed; your form remains available.';
