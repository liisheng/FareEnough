import Database from 'better-sqlite3';
import Fastify from 'fastify';
import { afterEach, expect, it } from 'vitest';
import { closeDb, setTestDb } from '../src/db/connection.js';
import { runMigrations } from '../src/db/migrate.js';
import { runRoutes, type ReviewRunner } from '../src/routes/runs.js';
import { workspaceRoutes } from '../src/routes/workspace.js';
import { createAutomaticReviews } from '../src/automatic-reviews.js';
import { parseConfig } from '../src/config.js';
import { ReplayModelProvider } from '../src/providers/replay-provider.js';
import { recoverInterruptedCases } from '../src/workspace.js';

let app: ReturnType<typeof Fastify>;
let queue: ReturnType<typeof createAutomaticReviews>;
afterEach(async()=>{await queue?.close();await app?.close();closeDb();});
async function setup({configured=true,fail=false,gate,failFirst=false,retryDelaysMs=[0,0]}:{configured?:boolean;fail?:boolean;gate?:Promise<void>;failFirst?:boolean;retryDelaysMs?:[number,number]}={}) {
  const db=new Database(':memory:');db.pragma('foreign_keys=ON');runMigrations(db);setTestDb(db);
  app=Fastify();let runner!: ReviewRunner;let calls=0;
  await app.register(runRoutes,{env:parseConfig({AI_MODE:configured?'live':'replay',MODEL_PROVIDER:'adp',ADP_RIDER_APP_KEY:'test',ADP_DRIVER_APP_KEY:'test',ADP_JUDGE_APP_KEY:'test'}),onReady:r=>{runner=r;},
    liveProviderFactory:()=>({id:'controlled-auto-test',mode:'live',async generate(request){calls++;if(gate)await gate;if(fail || (failFirst && calls<=2))throw Error('private upstream details');return new ReplayModelProvider().generate(request);}})});
  queue=createAutomaticReviews(runner,{retryDelaysMs});
  await app.register(workspaceRoutes,{enqueueReview:queue.enqueue});
  const tokens:Record<string,string>={};
  for(const role of ['rider','driver','support'])tokens[role]=(await app.inject({method:'POST',url:'/api/workspace/session',payload:{role}})).json().token;
  const headers=(role:string)=>({authorization:`Bearer ${tokens[role]}`});
  async function create(safety=false) {
    const trip=(await app.inject({method:'POST',url:'/api/workspace/trips',headers:headers('rider'),payload:{requestKey:crypto.randomUUID()}})).json();
    return (await app.inject({method:'POST',url:'/api/workspace/cases',headers:headers('rider'),payload:{tripReference:trip.id,category:'no-show',complaint:'I waited at the lobby.',safety,requestKey:crypto.randomUUID()}})).json();
  }
  const respond=(id:string)=>app.inject({method:'POST',url:`/api/workspace/cases/${id}/driver-response`,headers:headers('driver'),payload:{account:'I waited at the pickup point.'}});
  const get=async(id:string)=>(await app.inject({url:`/api/workspace/cases/${id}`,headers:headers('support')})).json();
  return {db,create,respond,get,headers,calls:()=>calls};
}

it('automatically executes one live review after the second account, without a Support request',async()=>{
  const test=await setup();const c=await test.create();expect(test.calls()).toBe(0);
  const response=await test.respond(c.id);expect(response.statusCode).toBe(200);
  await queue.idle();expect(test.calls()).toBe(5);expect((await test.get(c.id)).status).toBe('completed');
  await test.respond(c.id);await queue.idle();expect(test.calls()).toBe(5);
  expect(test.db.prepare('SELECT count(*) AS n FROM agent_runs').get()).toEqual({n:1});
});

it('queues simultaneous cases and prevents manual duplicate execution while queued',async()=>{
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  const test=await setup({gate});
  try {
    const a=await test.create(),b=await test.create();await test.respond(a.id);await test.respond(b.id);
    expect((await test.get(b.id)).status).toBe('queued');
    expect((await app.inject({method:'POST',url:`/api/cases/${b.id}/runs`,headers:test.headers('support'),payload:{mode:'live'}})).statusCode).toBe(409);
    release();await queue.idle();expect(test.calls()).toBe(10);
    expect((await test.get(a.id)).status).toBe('completed');expect((await test.get(b.id)).status).toBe('completed');
  } finally {release();await queue.idle();}
});

it('saves configuration failures for explicit retry and never falls back to replay',async()=>{
  const test=await setup({configured:false});const c=await test.create();await test.respond(c.id);await queue.idle();
  expect(await test.get(c.id)).toMatchObject({status:'review_failed',technicalFailure:true});expect(test.calls()).toBe(0);
  await test.respond(c.id);await queue.idle();expect(test.calls()).toBe(0);
  expect(test.db.prepare('SELECT count(*) AS n FROM agent_runs').get()).toEqual({n:0});
});

it('caps provider failures at three attempts and excludes safety cases',async()=>{
  const test=await setup({fail:true});const c=await test.create();await test.respond(c.id);await queue.idle();
  expect(await test.get(c.id)).toMatchObject({status:'review_failed',technicalFailure:true,automaticAttempts:3});
  expect(test.db.prepare('SELECT count(*) AS n FROM agent_runs').get()).toEqual({n:3});
  const before=test.calls();
  await test.respond(c.id);await queue.idle();expect(test.calls()).toBe(before);
  const safety=await test.create(true);await test.respond(safety.id);await queue.idle();expect(test.calls()).toBe(before);
  expect((await test.get(safety.id)).status).toBe('human_review');
  await app.inject({method:'POST',url:`/api/cases/${c.id}/runs`,headers:test.headers('support'),payload:{mode:'live'}});
  await queue.idle();
  expect(test.db.prepare('SELECT count(*) AS n FROM agent_runs').get()).toEqual({n:4});
});

it('recovers on the second attempt and blocks manual requests during backoff',async()=>{
  const test=await setup({failFirst:true,retryDelaysMs:[100,0]});const c=await test.create();
  await test.respond(c.id);
  for(let i=0;i<30 && (await test.get(c.id)).status!=='retrying';i++)await new Promise(resolve=>setTimeout(resolve,1));
  expect(await test.get(c.id)).toMatchObject({status:'retrying',automaticAttempts:1});
  expect((await app.inject({method:'POST',url:`/api/cases/${c.id}/runs`,headers:test.headers('support'),payload:{mode:'live'}})).statusCode).toBe(409);
  await queue.idle();expect(await test.get(c.id)).toMatchObject({status:'completed',automaticAttempts:2});
  expect(test.db.prepare('SELECT count(*) AS n FROM agent_runs').get()).toEqual({n:2});
});

it('marks queued work interrupted at startup without making calls',async()=>{
  const test=await setup();const c=await test.create();
  test.db.prepare("UPDATE workspace_cases SET status='queued' WHERE case_id=?").run(c.id);
  recoverInterruptedCases();expect(await test.get(c.id)).toMatchObject({status:'review_failed',technicalFailure:true});expect(test.calls()).toBe(0);
});
