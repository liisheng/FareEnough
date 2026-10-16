import Database from 'better-sqlite3';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, setTestDb } from '../src/db/connection.js';
import { runMigrations } from '../src/db/migrate.js';
import { runRoutes } from '../src/routes/runs.js';
import { parseConfig } from '../src/config.js';
import { ReplayModelProvider } from '../src/providers/replay-provider.js';
import type { ModelProviderRequest } from '../src/providers/model-provider.js';
import { workspaceRoutes } from '../src/routes/workspace.js';
import { loadDisp002Fixture } from '../src/fixtures/loader.js';

describe('POST case run', () => {
  let db: Database.Database;
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
    setTestDb(db);
    app = Fastify({ logger: false });
    await app.register(runRoutes);
  });

  afterEach(async () => {
    await app.close();
    closeDb();
  });

  it('runs the five-call replay, validates it, and persists the audit trail', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/cases/DISP-002/runs',
      payload: { mode: 'replay' },
    });
    const body = response.json();

    expect(response.statusCode).toBe(201);
    expect(body.mode).toBe('replay');
    expect(body.events).toHaveLength(10);
    expect(body.riderBrief.role).toBe('rider_advocate');
    expect(body.driverBrief.role).toBe('driver_advocate');
    expect(body.judgeProposal.outcome).toBe('uphold_fee');
    expect(body.validatedDecision).toMatchObject({
      validationStatus: 'validated',
      disposition: 'claim_rejected',
      dispositionLabel: 'Rider claim not upheld',
      amountMinor: 0,
    });
    expect((db.prepare('SELECT count(*) AS count FROM agent_runs').get() as any).count).toBe(1);
    expect((db.prepare('SELECT count(*) AS count FROM agent_artifacts').get() as any).count).toBe(5);
    expect((db.prepare('SELECT count(*) AS count FROM run_events').get() as any).count).toBe(10);
    expect((db.prepare('SELECT count(*) AS count FROM decisions').get() as any).count).toBe(1);
    expect((db.prepare('SELECT count(*) AS count FROM simulated_actions').get() as any).count).toBe(0);
  });

  it('rejects live execution when it has not been configured', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/cases/DISP-002/runs',
      payload: { mode: 'live' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('rate-limits repeated review-start attempts by caller', async () => {
    await app.close();
    app = Fastify({ logger: false });
    await app.register(runRoutes, {
      env: parseConfig({ RUN_RATE_LIMIT_MAX_STARTS: '1' }),
    });

    const first = await app.inject({
      method: 'POST',
      url: '/api/cases/DISP-002/runs',
      payload: { mode: 'invalid' },
    });
    expect(first.statusCode).toBe(400);
    expect(first.headers['ratelimit-limit']).toBe('1');
    expect(first.headers['ratelimit-remaining']).toBe('0');

    const limited = await app.inject({
      method: 'POST',
      url: '/api/cases/DISP-002/runs',
      payload: { mode: 'replay' },
    });
    expect(limited.statusCode).toBe(429);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('exposes neutral fixture progress for one run without starting another review', async () => {
    const progressId = '11111111-1111-4111-8111-111111111111';
    const url = `/api/cases/DISP-002/progress/${progressId}`;
    expect((await app.inject({url})).statusCode).toBe(404);
    const response = await app.inject({method:'POST',url:'/api/cases/DISP-002/runs',payload:{mode:'replay',progressId}});
    expect(response.statusCode).toBe(201);
    const progress = (await app.inject({url})).json();
    expect(progress.status).toBe('completed');
    expect(progress.events).toHaveLength(10);
    expect(Object.keys(progress).sort()).toEqual(['events','mode','status']);
    expect((await app.inject({method:'POST',url:'/api/cases/DISP-002/runs',payload:{mode:'replay',progressId}})).statusCode).toBe(409);
    expect(db.prepare('SELECT count(*) AS n FROM agent_runs').get()).toEqual({n:1});
  });

  async function enableLive(factory: () => any, sessionLimit = '60') {
    await app.close();
    app = Fastify({ logger: false });
    await app.register(runRoutes, {
      env: parseConfig({ AI_MODE: 'live', MODEL_PROVIDER: 'adp', ADP_RIDER_APP_KEY: 'test-rider', ADP_DRIVER_APP_KEY: 'test-driver', ADP_JUDGE_APP_KEY: 'test-judge', MAX_MODEL_CALLS_PER_SESSION: sessionLimit }),
      liveProviderFactory: factory,
    });
  }

  it('persists explicit live mode and enforces the server session call budget', async () => {
    await enableLive(() => {
      const replay = new ReplayModelProvider();
      return { id: 'test-adp', mode: 'live', generate: replay.generate.bind(replay) };
    }, '5');
    const response = await app.inject({ method: 'POST', url: '/api/cases/DISP-002/runs', payload: { mode: 'live' } });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ mode: 'live', provider: { mode: 'live' } });
    expect(db.prepare('SELECT mode FROM agent_runs').get()).toEqual({ mode: 'live' });
    const again = await app.inject({ method: 'POST', url: '/api/cases/DISP-002/runs', payload: { mode: 'live' } });
    expect(again.statusCode).toBe(429);
  });

  it('records failed live runs without leaking upstream errors or creating decisions', async () => {
    await enableLive(() => ({ id: 'test-adp', mode: 'live', async generate() { throw new Error('secret-upstream-value'); } }));
    const response = await app.inject({ method: 'POST', url: '/api/cases/DISP-002/runs', payload: { mode: 'live' } });
    expect(response.statusCode).toBe(502);
    expect(response.json().status).toBe('human_review');
    expect(response.body).not.toContain('secret-upstream-value');
    const row = db.prepare('SELECT status, error_message FROM agent_runs').get() as any;
    expect(row.status).toBe('failed');
    expect(row.error_message).not.toContain('secret-upstream-value');
    expect(db.prepare('SELECT count(*) AS n FROM decisions').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT count(*) AS n FROM simulated_actions').get()).toEqual({ n: 0 });
  });

  it('rejects browser requests from another website without invoking a provider', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/cases/DISP-002/runs', headers: { origin: 'https://other.example' }, payload: { mode: 'replay' } });
    expect(response.statusCode).toBe(403);
    expect(db.prepare('SELECT count(*) AS n FROM agent_runs').get()).toEqual({ n: 0 });
  });

  it('uses the explicitly selected v2.1 snapshot for all five live stages and saves its policy version', async () => {
    await app.close();
    app=Fastify({logger:false});
    const calls: ModelProviderRequest[]=[];
    await app.register(workspaceRoutes);
    await app.register(runRoutes,{
      env:parseConfig({AI_MODE:'live',MODEL_PROVIDER:'adp',REVIEW_POLICY_PROFILE:'ryde-v2.1',ADP_RIDER_APP_KEY:'test-rider',ADP_DRIVER_APP_KEY:'test-driver',ADP_JUDGE_APP_KEY:'test-judge'}),
      liveProviderFactory:()=>({id:'controlled-v21',mode:'live',async generate(request){
        calls.push(request);
        const claim={text:'The scheduled-time wait and both contact requirements are supported.',evidenceIds:['derived-ryde-v21-wait','derived-ryde-v21-contact'],policyRuleIds:['RYDE-V2.1-2.1','RYDE-V2.1-2.3']};
        if(request.stage==='judge')return {outcome:'uphold_fee',explanation:claim.text,findings:[claim],evidenceIds:claim.evidenceIds,policyRuleIds:claim.policyRuleIds,proposedAdjustmentCents:0,uncertainty:[]};
        const role=request.stage.startsWith('rider')?'rider_advocate':'driver_advocate';
        return request.stage.endsWith('brief')
          ? {role,position:claim.text,claims:[claim],adverseEvidence:[],concessions:[],unansweredQuestions:[]}
          : {role,response:claim.text,challengedClaim:claim.text,claims:[claim],preservedConcessions:[]};
      }}),
    });
    const response=await app.inject({method:'POST',url:'/api/cases/DISP-002/runs',payload:{mode:'live'}});
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({status:'completed',policyProfile:{profileId:'ryde-v2.1',version:'2.1'},validatedDecision:{action:'uphold_fee',amountMinor:0,contractAction:'no_change',contractDisposition:'claim_rejected',feeTreatment:'Existing fee upheld',confidence:{score:1}}});
    expect(calls).toHaveLength(5);
    for(const call of calls){
      expect(call.evidence.policyProfile.profileId).toBe('ryde-v2.1');
      expect(call.evidence.policyRules.every(rule=>rule.id.startsWith('RYDE-V2.1-'))).toBe(true);
      expect(call.evidence.evidence.find(item=>item.id==='derived-ryde-v21-wait')?.data.policyEligibleWaitSeconds).toBe(360);
    }
    const checkpoint=db.prepare('SELECT evidence FROM review_checkpoints').get() as {evidence:string};
    expect(JSON.parse(checkpoint.evidence)).toEqual(calls[0].evidence);
    // Historical replay keeps its original threshold and policy references.
    const replay=await app.inject({method:'POST',url:'/api/cases/DISP-002/runs',payload:{mode:'replay'}});
    expect(replay.statusCode).toBe(201);
    expect(replay.json().policyProfile.profileId).toBe('organizer-disp002-v1');

    const tokens: Record<string,string> = {};
    for (const role of ['rider','driver','support']) tokens[role] = (await app.inject({method:'POST',url:'/api/workspace/session',payload:{role}})).json().token;
    const headers = (role: string) => ({authorization:`Bearer ${tokens[role]}`});
    const created = await app.inject({method:'POST',url:'/api/workspace/cases',headers:headers('rider'),payload:{tripReference:loadDisp002Fixture().trip_data.trip_id,category:'no-show',complaint:'I could not locate the driver at pickup.',safety:false,requestKey:'v21-workspace'}});
    const id = created.json().id;
    await app.inject({method:'POST',url:`/api/workspace/cases/${id}/driver-response`,headers:headers('driver'),payload:{account:'I waited at the designated pickup point.'}});
    expect((await app.inject({method:'POST',url:`/api/cases/${id}/runs`,headers:headers('support'),payload:{mode:'live'}})).statusCode).toBe(201);
    const publicView = (await app.inject({url:`/api/workspace/cases/${id}`,headers:headers('rider')})).json();
    expect(publicView.outcome).toMatchObject({action:'no_change',confidence:{score:1}});
    expect(publicView.outcome.explanation).toContain('Policy v2.1');
    expect(publicView.outcome.explanation).not.toContain('organizer rule');
    expect(publicView.explanationDetails).toMatchObject({policyProfile:'ryde-v2.1',policyVersion:'2.1'});
    expect(publicView.explanationDetails.policyRuleIds.every((id: string) => id.startsWith('RYDE-V2.1-'))).toBe(true);
  });

  it('keeps synthetic route ERP on its own policy when live no-show review uses v2.1', async () => {
    await app.close();
    app = Fastify({logger:false});
    const calls: ModelProviderRequest[] = [];
    await app.register(workspaceRoutes);
    await app.register(runRoutes, {
      env:parseConfig({AI_MODE:'live',MODEL_PROVIDER:'adp',REVIEW_POLICY_PROFILE:'ryde-v2.1',ADP_RIDER_APP_KEY:'test-rider',ADP_DRIVER_APP_KEY:'test-driver',ADP_JUDGE_APP_KEY:'test-judge'}),
      liveProviderFactory:() => ({id:'controlled-route',mode:'live',async generate(request) {
        calls.push(request);
        return new ReplayModelProvider().generate(request);
      }}),
    });
    const tokens: Record<string,string> = {};
    for (const role of ['rider','driver','support']) tokens[role] = (await app.inject({method:'POST',url:'/api/workspace/session',payload:{role}})).json().token;
    const headers = (role: string) => ({authorization:`Bearer ${tokens[role]}`});
    const created = await app.inject({method:'POST',url:'/api/workspace/cases',headers:headers('rider'),payload:{tripReference:loadDisp002Fixture().trip_data.trip_id,category:'route',complaint:'I dispute the separate ERP charge.',safety:false,requestKey:'route-v21'}});
    const id = created.json().id;
    await app.inject({method:'POST',url:`/api/workspace/cases/${id}/driver-response`,headers:headers('driver'),payload:{account:'The rider agreed to the detour.'}});
    const response = await app.inject({method:'POST',url:`/api/cases/${id}/runs`,headers:headers('support'),payload:{mode:'live'}});
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({status:'completed',policyProfile:{profileId:'demo-route-erp-v1'},validatedDecision:{contractAction:'simulate_refund',amountMinor:325,feeTreatment:'Unsupported charge refunded'}});
    expect(calls).toHaveLength(5);
    for (const call of calls) {
      expect(call.evidence.policyProfile.profileId).toBe('demo-route-erp-v1');
      expect(call.evidence.policyRules.some(rule => rule.id.startsWith('RYDE-V2.1-'))).toBe(false);
    }
    const publicView = (await app.inject({url:`/api/workspace/cases/${id}`,headers:headers('rider')})).json();
    expect(publicView.explanationDetails.policyProfile).toBe('demo-route-erp-v1');
    expect(publicView.explanationDetails.policyRuleIds).toContain('DEMO-ERP-01');
    expect(publicView.outcome.explanation).toContain('325-cent');
  });
});
