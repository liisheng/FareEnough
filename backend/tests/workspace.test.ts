import Database from 'better-sqlite3';
import Fastify from 'fastify';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { closeDb, setTestDb } from '../src/db/connection.js';
import { runMigrations } from '../src/db/migrate.js';
import { workspaceRoutes } from '../src/routes/workspace.js';
import { runRoutes } from '../src/routes/runs.js';
import { parseConfig } from '../src/config.js';
import { loadDisp002Fixture } from '../src/fixtures/loader.js';
import { ReplayModelProvider } from '../src/providers/replay-provider.js';
import { recoverInterruptedCases } from '../src/workspace.js';
import type { ModelProviderRequest } from '../src/providers/model-provider.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { caseRoutes } from '../src/routes/cases.js';

let app: ReturnType<typeof Fastify>, db: Database.Database;
let tokens: Record<string,string>, calls: ModelProviderRequest[], fail: boolean;
let hold: Promise<void> | undefined;
const trip = loadDisp002Fixture().trip_data.trip_id;
const headers = (role: string) => ({authorization:`Bearer ${tokens[role]}`});
const intake = (extra = {}) => ({tripReference:trip,category:'no-show',complaint:'RIDER_PRIVATE I waited at the lobby.',safety:false,requestKey:'submission-1',...extra});
async function create(extra = {}) {
  return app.inject({method:'POST',url:'/api/workspace/cases',headers:headers('rider'),payload:intake(extra)});
}
async function respond(id: string) {
  return app.inject({method:'POST',url:`/api/workspace/cases/${id}/driver-response`,headers:headers('driver'),payload:{account:'DRIVER_PRIVATE I waited near pickup.'}});
}
async function run(id: string, mode = 'live', role = 'support') {
  return app.inject({method:'POST',url:`/api/cases/${id}/runs`,headers:headers(role),payload:{mode}});
}
beforeEach(async()=>{
  db=new Database(':memory:');db.pragma('foreign_keys = ON');runMigrations(db);setTestDb(db);
  app=Fastify();tokens={};calls=[];fail=false;hold=undefined;
  await app.register(workspaceRoutes);
  await app.register(caseRoutes);
  await app.register(runRoutes,{env:parseConfig({AI_MODE:'live',MODEL_PROVIDER:'adp',ADP_RIDER_APP_KEY:'test',ADP_DRIVER_APP_KEY:'test',ADP_JUDGE_APP_KEY:'test'}),liveProviderFactory:()=>({id:'controlled-live-test',mode:'live',async generate(request){calls.push(request);if(hold)await hold;if(fail)throw Error('PRIVATE_PROVIDER_SECRET');return new ReplayModelProvider().generate(request);}})});
  for(const role of ['rider','driver','support']) tokens[role]=(await app.inject({method:'POST',url:'/api/workspace/session',payload:{role}})).json().token;
});
afterEach(async()=>{await app.close();closeDb();});

it('persists intake, scopes party accounts, executes all five stages with both submissions and restores the outcome',async()=>{
  const created=await create();expect(created.statusCode).toBe(201);const id=created.json().id;
  expect((await respond(id)).statusCode).toBe(200);
  const response=await run(id);expect(response.statusCode).toBe(201);expect(response.json().status).toBe('completed');
  expect(calls).toHaveLength(5);
  for(const call of calls){expect(JSON.stringify(call.evidence)).toContain('RIDER_PRIVATE');expect(JSON.stringify(call.evidence)).toContain('DRIVER_PRIVATE');expect(call.evidence.caseId).toBe(id);}
  expect(calls[0].priorOutputs).toEqual([]);expect(calls[1].priorOutputs).toEqual([]);
  const rider=await app.inject({url:`/api/workspace/cases/${id}`,headers:headers('rider')});
  expect(rider.body).not.toContain('DRIVER_PRIVATE');expect(rider.body).not.toContain('riderBrief');expect(rider.json().outcome.mode).toBe('live');
  const driver=await app.inject({url:`/api/workspace/cases/${id}`,headers:headers('driver')});expect(driver.body).not.toContain('RIDER_PRIVATE');
  const support=(await app.inject({url:`/api/workspace/cases/${id}`,headers:headers('support')})).json();
  expect(support.events).toHaveLength(10);expect(support.result.riderBrief.role).toBe('rider_advocate');
  expect(db.prepare('SELECT count(*) AS n FROM agent_artifacts WHERE run_id = ?').get(support.runId)).toEqual({n:5});
  // Repeating finalization cannot execute another model run or another action.
  expect((await run(id)).statusCode).toBe(200);expect(calls).toHaveLength(5);
});

it('requires roles and enforces assigned ownership on read and response endpoints',async()=>{
  expect((await app.inject({url:'/api/workspace/cases'})).statusCode).toBe(401);
  const id=(await create()).json().id;
  expect((await run(id,'live','rider')).statusCode).toBe(403);
  expect((await app.inject({method:'POST',url:`/api/workspace/cases/${id}/driver-response`,headers:headers('rider'),payload:{account:'Not the assigned driver'}})).statusCode).toBe(403);
  db.prepare("UPDATE demo_sessions SET actor_id = 'another-driver' WHERE token = ?").run(tokens.driver);
  expect((await respond(id)).statusCode).toBe(404);
  expect((await app.inject({url:`/api/workspace/cases/${id}`,headers:headers('driver')})).statusCode).toBe(404);
  expect((await app.inject({url:'/api/workspace/cases',headers:headers('driver')})).json()).toEqual([]);
});

it('deduplicates retries and semantic duplicates, and refuses modified submissions',async()=>{
  const id=(await create()).json().id;expect((await create()).json().id).toBe(id);
  expect((await create({complaint:'Changed rider account'})).statusCode).toBe(409);
  const duplicate=await create({requestKey:'another-key'});expect(duplicate.statusCode).toBe(409);expect(duplicate.json().caseId).toBe(id);
  await respond(id);expect((await respond(id)).statusCode).toBe(200);
  expect((await app.inject({method:'POST',url:`/api/workspace/cases/${id}/driver-response`,headers:headers('driver'),payload:{account:'Changed driver narrative'}})).statusCode).toBe(409);
});

it('issues unique evidence-backed demo trips, reuses allocation retries and rejects invented references',async()=>{
  const allocate=(requestKey:string)=>app.inject({method:'POST',url:'/api/workspace/trips',headers:headers('rider'),payload:{requestKey}});
  const key=crypto.randomUUID();
  const first=(await allocate(key)).json();
  expect((await allocate(key)).json().id).toBe(first.id);
  const second=(await allocate(crypto.randomUUID())).json();expect(second.id).not.toBe(first.id);
  const a=(await create({tripReference:first.id})).json();
  const b=(await create({tripReference:second.id,requestKey:'second-case'})).json();
  expect(a.supported).toBe(true);expect(b.supported).toBe(true);expect(a.id).not.toBe(b.id);
  await respond(b.id);expect((await run(b.id,'replay')).statusCode).toBe(201);
  const detail=(await app.inject({url:`/api/workspace/cases/${b.id}`,headers:headers('support')})).json();
  expect(detail.evidence.trip.tripId).toBe(second.id);expect(detail.evidence.dispute.tripId).toBe(second.id);
  expect((await create({tripReference:'DEMO-invented',requestKey:'invented'})).json().supported).toBe(false);
  expect((await app.inject({method:'POST',url:'/api/workspace/trips',headers:headers('driver'),payload:{requestKey:crypto.randomUUID()}})).statusCode).toBe(403);
});

it('blocks missing responses, unknown trips, route disputes and safety cases from automatic review',async()=>{
  const id=(await create()).json().id;expect((await run(id)).statusCode).toBe(409);
  for(const extra of [{tripReference:'UNKNOWN'}, {category:'route'}, {tripReference:'SAFETY',safety:true}]){
    const c=(await create({...extra,requestKey:JSON.stringify(extra)})).json();expect(c.status).toBe('human_review');
    expect((await run(c.id)).statusCode).toBe(409);
  }
  expect(calls).toHaveLength(0);
});

it('labels submitted-case replay honestly and retains all five artifacts without a financial decision',async()=>{
  const id=(await create()).json().id;await respond(id);
  const result=await run(id,'replay');expect(result.statusCode).toBe(201);expect(result.json().status).toBe('human_review');
  expect(result.json().events).toHaveLength(10);expect(result.json().judgeProposal.explanation).toContain('Replay');
  expect((await app.inject({url:`/api/workspace/cases/${id}`,headers:headers('support')})).json().technicalFailure).toBe(false);
  expect(calls).toHaveLength(0);expect(db.prepare('SELECT count(*) AS n FROM simulated_actions').get()).toEqual({n:0});
});

it('makes in-flight events observable and prevents duplicate concurrent execution',async()=>{
  const id=(await create()).json().id;await respond(id);
  let release!:()=>void;hold=new Promise(resolve=>{release=resolve;});
  const pending=run(id);
  try {
    for(let i=0;i<20 && !calls.length;i++)await new Promise(resolve=>setTimeout(resolve,5));
    const c=(await app.inject({url:`/api/workspace/cases/${id}`,headers:headers('support')})).json();
    expect(c.status).toBe('running');expect(c.events.length).toBeGreaterThan(0);
    expect((await run(id)).statusCode).toBe(409);
  } finally {release();await pending;}
});

it('records provider failure safely and recovers interrupted cases without restarting agents',async()=>{
  const id=(await create()).json().id;await respond(id);fail=true;
  expect((await run(id)).statusCode).toBe(502);
  const c=await app.inject({url:`/api/workspace/cases/${id}`,headers:headers('support')});
  expect(c.json().status).toBe('human_review');expect(c.body).not.toContain('PRIVATE_PROVIDER_SECRET');
  expect(c.json().technicalFailure).toBe(true);
  fail=false;expect((await run(id)).statusCode).toBe(201);
  expect((await app.inject({url:`/api/workspace/cases/${id}`,headers:headers('support')})).json().technicalFailure).toBe(false);
  db.prepare("UPDATE workspace_cases SET status='running' WHERE case_id=?").run(id);
  const count=calls.length;recoverInterruptedCases();expect(calls).toHaveLength(count);
  expect((await app.inject({url:`/api/workspace/cases/${id}`,headers:headers('rider')})).json().reason).toContain('restarted');
});

it('rejects cross-origin session creation and invalid intake without writing cases',async()=>{
  expect((await app.inject({method:'POST',url:'/api/workspace/session',headers:{origin:'https://other.example'},payload:{role:'support'}})).statusCode).toBe(403);
  expect((await create({complaint:'tiny'})).statusCode).toBe(400);
  expect(db.prepare('SELECT count(*) AS n FROM workspace_cases').get()).toEqual({n:0});
});

it('connects the actual frontend scripts to intake, driver response, live agent execution and refresh recovery',async()=>{
  function browser() {
    const nodes=new Map<string,any>(), listeners:Record<string,Function[]>={},hashListeners:Function[]=[];
    const node=(id:string):any=>{
      if(!nodes.has(id))nodes.set(id,{id:id.slice(1),value:'',innerHTML:'',textContent:'',checked:false,disabled:false,dataset:{},listeners:{} as Record<string,Function>,
        addEventListener(name:string,fn:Function){this.listeners[name]=fn;},setAttribute(){},removeAttribute(){},
        querySelector(){return node(id+'-button');},insertAdjacentHTML(_p:string,html:string){this.innerHTML=html+this.innerHTML;},hasAttribute(){return false;}});
      return nodes.get(id);
    };
    node('#category').value='no-show';node('#status-filter').value=node('#category-filter').value='all';node('#review-mode').value='replay';
    const location={hash:'#rider'};
    const document={hidden:false,querySelector:node,addEventListener(name:string,fn:Function){(listeners[name]??=[]).push(fn);}};
    const window:any={document,crypto:{randomUUID:()=>crypto.randomUUID()},setInterval(){},addEventListener(name:string,fn:Function){if(name==='hashchange')hashListeners.push(fn);},
      fetch:async(url:string,options:any={})=>{
        if(url.endsWith('/health'))return {ok:true,status:200,json:async()=>({liveAvailable:true})};
        const response=await app.inject({method:options.method||'GET',url:new URL(url).pathname,headers:options.headers,payload:options.body});
        return {ok:response.statusCode<400,status:response.statusCode,json:async()=>response.json()};
      }};
    const context=vm.createContext({window,document,location,URL,setTimeout});
    for(const file of ['app.js','participation.js'])vm.runInContext(readFileSync(resolve('..','frontend','scripts',file),'utf8'),context);
    const settle=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));};
    return {node,window,settle,async navigate(role:string){location.hash='#'+role;for(const fn of hashListeners)await fn();},
      async submit(id:string){await node(id).listeners.submit({preventDefault(){},target:node(id)});}};
  }
  const browser1=browser();await browser1.settle();
  const n=browser1.node;
  expect(n('#trip').value).toMatch(/^TRIP-/);
  const originalReference=n('#trip').value;
  n('#complaint').value='UI_RIDER_PRIVATE: I waited at the lobby.';
  await browser1.submit('#intake-form');expect(n('#rider-outcome').innerHTML).toContain('UI_RIDER_PRIVATE');
  expect(n('#trip').value).toMatch(/^TRIP-/);expect(n('#trip').value).not.toBe(originalReference);
  expect(n('#complaint').value).toBe('');
  await browser1.submit('#intake-form');expect(n('#form-message').textContent).toContain('Enter an account');
  expect(db.prepare('SELECT count(*) AS n FROM workspace_cases').get()).toEqual({n:1});
  expect(calls).toHaveLength(0);
  await browser1.navigate('driver');expect(n('#driver-view').hidden).toBe(false);expect(n('#driver-detail').innerHTML).not.toContain('UI_RIDER_PRIVATE');
  n('#driver-account').value='UI_DRIVER_PRIVATE: I waited at the pickup.';
  await browser1.submit('#driver-form');expect(n('#driver-detail').innerHTML).toContain('UI_DRIVER_PRIVATE');
  await browser1.navigate('support');expect(n('#workspace').innerHTML).toContain('UI_RIDER_PRIVATE');expect(n('#workspace').innerHTML).toContain('UI_DRIVER_PRIVATE');
  expect(n('#workspace').innerHTML).not.toContain('case-review-mode');expect(n('#workspace').innerHTML).toContain('Start AI review');expect(calls).toHaveLength(0);
  await n('#case-start-review').listeners.click({target:n('#case-start-review')});
  expect(calls).toHaveLength(5);expect(n('#workspace').innerHTML).toContain('VALIDATED DECISION');
  await browser1.navigate('rider');expect(n('#rider-outcome').innerHTML).toContain('Live AI');expect(n('#rider-outcome').innerHTML).not.toContain('UI_DRIVER_PRIVATE');
  const reloaded=browser();await reloaded.settle();
  expect(reloaded.node('#rider-outcome').innerHTML).toContain('Live AI');expect(reloaded.node('#rider-outcome').innerHTML).toContain('UI_RIDER_PRIVATE');
  expect(reloaded.node('#trip').value).not.toBe(n('#trip').value);
  expect(calls).toHaveLength(5);
});

it('requires admin, validates final decisions, preserves AI results and prevents duplicate adjustments',async()=>{
  tokens.admin=(await app.inject({method:'POST',url:'/api/workspace/session',payload:{role:'admin'}})).json().token;
  const id=(await create()).json().id;await respond(id);await run(id,'replay');
  const original=db.prepare('SELECT result FROM workspace_cases WHERE case_id=?').get(id);
  const decide=(role:string,payload:any)=>app.inject({method:'POST',url:`/api/workspace/cases/${id}/final-decision`,headers:headers(role),payload});
  const payload={action:'reverse_fee',amountMinor:500,currency:'SGD',rationale:'The evidence does not justify retaining this fee.'};
  expect((await decide('support',payload)).statusCode).toBe(403);
  expect((await decide('rider',payload)).statusCode).toBe(403);
  for(const change of [{amountMinor:501},{amountMinor:-1},{amountMinor:499},{currency:'USD'},{rationale:''},{action:'close_no_adjustment'}])expect((await decide('admin',{...payload,...change})).statusCode).toBe(400);
  expect((await decide('admin',payload)).statusCode).toBe(201);
  expect((await decide('admin',payload)).statusCode).toBe(200);
  expect((await decide('admin',{...payload,rationale:'A changed final rationale.'})).statusCode).toBe(409);
  expect(db.prepare('SELECT result FROM workspace_cases WHERE case_id=?').get(id)).toEqual(original);
  expect(db.prepare('SELECT count(*) AS n FROM human_decisions').get()).toEqual({n:1});
  const rider=(await app.inject({url:`/api/workspace/cases/${id}`,headers:headers('rider')})).json();
  expect(rider).toMatchObject({status:'completed',outcome:{mode:'human',amountMinor:500}});
  expect(rider.finalDecision).toBeUndefined();expect(JSON.stringify(rider)).not.toContain(payload.rationale);
  const before=calls.length;await run(id);expect(calls.length).toBe(before);
});

it('rejects active-case finalization and unsupported financial adjustments',async()=>{
  tokens.admin=(await app.inject({method:'POST',url:'/api/workspace/session',payload:{role:'admin'}})).json().token;
  const id=(await create()).json().id;
  const payload={action:'close_no_adjustment',amountMinor:0,currency:'SGD',rationale:'No supported financial adjustment can be established.'};
  const decide=(caseId:string,body:any)=>app.inject({method:'POST',url:`/api/workspace/cases/${caseId}/final-decision`,headers:headers('admin'),payload:body});
  expect((await decide(id,payload)).statusCode).toBe(409);
  const other=(await create({category:'route',requestKey:'route-case'})).json().id;
  expect((await decide(other,{...payload,action:'reverse_fee',amountMinor:500})).statusCode).toBe(400);
  expect((await decide(other,payload)).statusCode).toBe(201);
  expect((await respond(other)).statusCode).toBe(409);
});

it('retains grounded partial artifacts and isolates audit history and exports from parties',async()=>{
  const id=(await create()).json().id;await respond(id);
  // Force failure only after the briefs have completed and been persisted.
  const provider=new ReplayModelProvider();
  const original=provider.generate.bind(provider);
  // The existing provider fixture can be replaced through its prototype for this run.
  const saved=ReplayModelProvider.prototype.generate;
  ReplayModelProvider.prototype.generate=async function(request){if(request.stage==='rider_rebuttal')throw Error('DO_NOT_EXPORT_PROVIDER_SECRET');return original(request);};
  try{expect((await run(id)).statusCode).toBe(502);}finally{ReplayModelProvider.prototype.generate=saved;}
  const audit=(await app.inject({url:`/api/workspace/cases/${id}/audit`,headers:headers('support')})).json();
  expect(audit.runs).toHaveLength(1);expect(audit.runs[0].status).toBe('failed');
  expect(Object.keys(audit.runs[0].artifacts).sort()).toEqual(['driver_brief','rider_brief']);
  expect(audit.runs[0].evidence.evidence.some((r:any)=>r.id==='gps-005')).toBe(true);
  expect(JSON.stringify(audit)).not.toContain('DO_NOT_EXPORT_PROVIDER_SECRET');
  expect((await app.inject({url:`/api/workspace/cases/${id}/audit`,headers:headers('rider')})).statusCode).toBe(403);
  await run(id);
  const full=(await app.inject({url:`/api/workspace/cases/${id}/export`,headers:headers('support')})).json();
  expect(full.runs).toHaveLength(2);expect(full.simulationOnly).toBe(true);
  const party=(await app.inject({url:`/api/workspace/cases/${id}/export`,headers:headers('rider')})).json();
  expect(party.runs).toBeUndefined();expect(party.evidence).toBeUndefined();
  expect(JSON.stringify(party)).not.toContain('DRIVER_PRIVATE');
  expect(party.case.explanationDetails.policyProfile).toBe('organizer-disp002-v1');
});

it('keeps checkpoint evidence and artifacts after startup recovery',async()=>{
  const id=(await create()).json().id;
  db.prepare('INSERT INTO review_checkpoints (run_id,case_id,mode,started_at,evidence,artifacts) VALUES (?,?,?,?,?,?)').run('interrupted-test',id,'live',new Date().toISOString(),'{}','{"rider_brief":{"position":"Saved validated brief"}}');
  db.prepare("UPDATE workspace_cases SET status='running',run_id='interrupted-test' WHERE case_id=?").run(id);
  recoverInterruptedCases();
  const audit=(await app.inject({url:`/api/workspace/cases/${id}/audit`,headers:headers('support')})).json();
  expect(audit.runs[0]).toMatchObject({status:'interrupted',artifacts:{rider_brief:{position:'Saved validated brief'}}});
});
