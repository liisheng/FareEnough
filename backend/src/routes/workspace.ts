import { createHash, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/connection.js';
import { config } from '../config.js';
import { reviewHistory, currentEvidence } from '../review-audit.js';
import { loadDisp002Fixture } from '../fixtures/loader.js';
import { canRead, createSession, demoActors, findWorkspaceCase, publicCase, requireSession, type WorkspaceCase } from '../workspace.js';

const Intake = z.object({ tripReference: z.string().trim().min(1).max(80), category: z.enum(['no-show', 'route']),
  complaint: z.string().trim().min(10).max(2000), safety: z.boolean(), requestKey: z.string().min(1).max(100) }).strict();
export async function workspaceRoutes(app: FastifyInstance, options: {enqueueReview?: (id:string)=>void} = {}) {
  app.addHook('onRequest', async (request, reply) => {
    if (request.headers.origin && !['http://127.0.0.1:3000', 'http://localhost:3000'].includes(request.headers.origin)) return reply.code(403).send({ error: 'Origin is not allowed' });
  });
  app.post('/api/workspace/session', async (request, reply) => {
    if (config.APP_MODE !== 'demo') return reply.code(403).send({ error: 'Workspace sessions are disabled' });
    const body = z.object({ role: z.enum(['rider', 'driver', 'support', 'admin']) }).strict().safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Choose a workspace' });
    return createSession(body.data.role);
  });
  app.get('/api/workspace/trips', async (request, reply) => {
    const session = requireSession(request, reply, 'rider'); if (!session) return;
    if (session.actor_id !== demoActors.rider) return [];
    const trip = loadDisp002Fixture().trip_data;
    return [{ id: trip.trip_id, label: 'No-show trip · sample records', feeMinor: 500 }];
  });
  app.post('/api/workspace/trips', async (request, reply) => {
    const s = requireSession(request, reply, 'rider'); if (!s) return;
    if (config.APP_MODE !== 'demo' || s.actor_id !== demoActors.rider) return reply.code(403).send({error:'Trip reference creation is unavailable.'});
    const parsed = z.object({requestKey:z.string().uuid()}).strict().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({error:'A valid trip request key is required.'});
    const db = getDb();
    const existing = db.prepare('SELECT trip_reference FROM demo_trips WHERE rider_id = ? AND request_key = ?').get(s.actor_id,parsed.data.requestKey) as {trip_reference:string} | undefined;
    if (existing) return {id:existing.trip_reference};
    const id = `TRIP-${randomUUID()}`;
    db.prepare('INSERT INTO demo_trips VALUES (?, ?, ?, ?, ?)').run(id,s.actor_id,loadDisp002Fixture().trip_data.trip_id,parsed.data.requestKey,new Date().toISOString());
    return reply.code(201).send({id});
  });
  app.get('/api/workspace/cases', async (request, reply) => {
    const s = requireSession(request, reply); if (!s) return;
    const rows = getDb().prepare('SELECT * FROM workspace_cases ORDER BY filed_at DESC').all() as WorkspaceCase[];
    return rows.filter(c => canRead(c, s)).map(c => publicCase(c, s));
  });
  app.get('/api/workspace/cases/:id', async (request, reply) => {
    const s = requireSession(request, reply); if (!s) return;
    const c = findWorkspaceCase((request.params as {id:string}).id);
    if (!c || !canRead(c, s)) return reply.code(404).send({ error: 'Case not found' });
    return publicCase(c, s);
  });
  app.get('/api/workspace/cases/:id/audit', async (request,reply)=>{
    const s=requireSession(request,reply);if(!s)return;
    if(!['support','admin'].includes(s.role))return reply.code(403).send({error:'Review workspace or admin access required.'});
    const c=findWorkspaceCase((request.params as {id:string}).id);
    if(!c)return reply.code(404).send({error:'Case not found'});
    const projected=publicCase(c,s);
    return {caseId:c.case_id,evidence:currentEvidence(c),runs:reviewHistory(c.case_id),finalDecision:'finalDecision' in projected?projected.finalDecision:null};
  });
  app.get('/api/workspace/cases/:id/export', async (request,reply)=>{
    const s=requireSession(request,reply);if(!s)return;
    const c=findWorkspaceCase((request.params as {id:string}).id);
    if(!c||!canRead(c,s))return reply.code(404).send({error:'Case not found'});
    const internal=['support','admin'].includes(s.role);
    return {schemaVersion:1,exportedAt:new Date().toISOString(),audience:s.role,simulationOnly:true,
      case:publicCase(c,s),...(internal?{evidence:currentEvidence(c),runs:reviewHistory(c.case_id)}:{})};
  });
  app.post('/api/workspace/cases', async (request, reply) => {
    const s = requireSession(request, reply, 'rider'); if (!s) return;
    const parsed = Intake.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Enter a trip, category and account of 10–2,000 characters.' });
    const { requestKey, ...data } = parsed.data;
    const db = getDb(), hash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
    const existingKey = db.prepare('SELECT * FROM workspace_cases WHERE rider_id = ? AND request_key = ?').get(s.actor_id, requestKey) as WorkspaceCase | undefined;
    if (existingKey) return existingKey.request_hash === hash ? publicCase(existingKey, s) : reply.code(409).send({ error: 'Submission key already used for different content.' });
    const existing = db.prepare('SELECT * FROM workspace_cases WHERE rider_id = ? AND trip_reference = ? AND category = ?').get(s.actor_id, data.tripReference, data.category) as WorkspaceCase | undefined;
    if (existing) return reply.code(409).send({ error: 'A case already exists for this trip and category.', caseId: existing.case_id });
    const sourceTrip = loadDisp002Fixture().trip_data.trip_id;
    const demoTrip = db.prepare('SELECT source_trip_id FROM demo_trips WHERE trip_reference = ? AND rider_id = ?').get(data.tripReference,s.actor_id) as {source_trip_id:string} | undefined;
    const knownTrip = s.actor_id === demoActors.rider && (data.tripReference === sourceTrip || demoTrip?.source_trip_id === sourceTrip);
    const supported = knownTrip && data.category === 'no-show' && !data.safety;
    const id = `CASE-${randomUUID()}`, now = new Date().toISOString();
    const status = supported ? 'awaiting_driver' : 'human_review';
    const reason = data.safety ? 'Safety concern requires human review.' : supported ? 'Awaiting the assigned driver account.' : 'Verified evidence or a supported policy is unavailable; human review is required.';
    db.transaction(() => {
      db.prepare('INSERT INTO cases (case_id, trip_id, filed_by, dispute_type, description, filed_at, status, policy_profile_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, data.tripReference, 'rider', data.category, data.complaint, now, status, supported ? 'organizer-disp002-v1' : null);
      db.prepare(`INSERT INTO workspace_cases (case_id,rider_id,driver_id,trip_reference,category,complaint,safety,supported,filed_at,status,reason,request_key,request_hash)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,s.actor_id,knownTrip?demoActors.driver:null,data.tripReference,data.category,data.complaint,Number(data.safety),Number(supported),now,status,reason,requestKey,hash);
    })();
    return reply.code(201).send(publicCase(findWorkspaceCase(id)!, s));
  });
  app.post('/api/workspace/cases/:id/driver-response', async (request, reply) => {
    const s = requireSession(request, reply, 'driver'); if (!s) return;
    const c = findWorkspaceCase((request.params as {id:string}).id);
    if (!c || !canRead(c, s)) return reply.code(404).send({ error: 'Case not found' });
    const parsed = z.object({ account: z.string().trim().min(10).max(2000) }).strict().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Enter an account of 10–2,000 characters.' });
    if (c.driver_account) return c.driver_account === parsed.data.account ? publicCase(c,s) : reply.code(409).send({ error: 'Submitted accounts cannot be changed.' });
    if(c.status==='completed') return reply.code(409).send({error:'This case has a final decision.'});
    const automatic=c.supported && Boolean(options.enqueueReview);
    getDb().prepare(`UPDATE workspace_cases SET driver_account = ?, driver_filed_at = ?, status = ?, reason = ? WHERE case_id = ?`).run(parsed.data.account,new Date().toISOString(),automatic?'queued':c.supported?'ready':'human_review',automatic?'Both accounts received. Live AI review will start automatically.':c.supported?'Both accounts received. Support can start review.':c.reason,c.case_id);
    if(automatic)options.enqueueReview!(c.case_id);
    return publicCase(findWorkspaceCase(c.case_id)!, s);
  });
  app.post('/api/workspace/cases/:id/final-decision', async (request, reply) => {
    const session=requireSession(request,reply,'admin');if(!session)return;
    const parsed=z.object({action:z.enum(['reverse_fee','close_no_adjustment']),amountMinor:z.number().int().min(0).max(500),currency:z.literal('SGD'),rationale:z.string().trim().min(10).max(2000)}).strict().safeParse(request.body);
    if(!parsed.success)return reply.code(400).send({error:'Choose an action, SGD amount and a rationale of 10?2,000 characters.'});
    const id=(request.params as {id:string}).id, db=getDb(), decision=parsed.data;
    const response=db.transaction(()=>{
      const c=findWorkspaceCase(id);
      if(!c)return {status:404,error:'Case not found'};
      const existing=db.prepare('SELECT action,amount_minor,currency,rationale FROM human_decisions WHERE case_id=?').get(id) as any;
      if(existing)return existing.action===decision.action && existing.amount_minor===decision.amountMinor && existing.currency===decision.currency && existing.rationale===decision.rationale ? {status:200} : {status:409,error:'A final decision is already recorded and cannot be overwritten.'};
      if(!['human_review','review_failed'].includes(c.status))return {status:409,error:'Only cases requiring human review can be finalized.'};
      if(decision.action==='reverse_fee' && (!c.supported || decision.amountMinor!==500))return {status:400,error:'Fee reversal requires verified organizer no-show evidence and an exact SGD 5.00 adjustment.'};
      if(decision.action==='close_no_adjustment' && decision.amountMinor!==0)return {status:400,error:'Closing without adjustment requires a zero amount.'};
      db.prepare('INSERT INTO human_decisions VALUES (?,?,?,?,?,?,?)').run(id,session.actor_id,decision.action,decision.amountMinor,decision.currency,decision.rationale,new Date().toISOString());
      db.prepare("UPDATE workspace_cases SET status='completed', reason='Final decision recorded by an administrator. No real payment was made.' WHERE case_id=?").run(id);
      db.prepare("UPDATE cases SET status='completed' WHERE case_id=?").run(id);
      return {status:201};
    })();
    if(response.error)return reply.code(response.status).send({error:response.error});
    return reply.code(response.status).send(publicCase(findWorkspaceCase(id)!,session));
  });

}
