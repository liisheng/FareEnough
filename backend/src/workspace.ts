import { randomUUID } from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { getDb } from './db/connection.js';
import { loadDisp002Fixture, loadRouteFixture } from './fixtures/loader.js';
import { projectCaseEvidence } from './projections/case-projection.js';
import { projectRouteEvidence } from './projections/route-projection.js';

export type DemoRole = 'rider' | 'driver' | 'support' | 'admin';
export interface Session { role: DemoRole; actor_id: string }
export interface WorkspaceCase {
  automatic_attempts: number;
  case_id: string; rider_id: string; driver_id: string | null; trip_reference: string;
  category: string; complaint: string; safety: number; supported: number;
  driver_account: string | null; driver_filed_at: string | null; filed_at: string;
  status: string; reason: string; request_key: string; request_hash: string;
  run_id: string | null; run_mode: string | null; events: string; result: string | null;
}
export const demoActors = { rider: 'demo-rider-a', driver: 'demo-driver-a', support: 'demo-support', admin: 'demo-admin' };
export function createSession(role: DemoRole) {
  getDb().prepare('DELETE FROM demo_sessions WHERE expires_at <= ?').run(Date.now());
  const token = randomUUID();
  getDb().prepare('INSERT INTO demo_sessions VALUES (?, ?, ?, ?)').run(token, role, demoActors[role], Date.now() + 86400000);
  return { token, role };
}
export function requireSession(request: FastifyRequest, reply: FastifyReply, role?: DemoRole): Session | null {
  const token = request.headers.authorization?.replace(/^Bearer /, '') ?? '';
  const session = getDb().prepare('SELECT role, actor_id FROM demo_sessions WHERE token = ? AND expires_at > ?').get(token, Date.now()) as Session | undefined;
  if (!session) { reply.code(401).send({ error: 'Select your workspace again.' }); return null; }
  if (role && session.role !== role) { reply.code(403).send({ error: 'This action requires another role.' }); return null; }
  return session;
}
export function findWorkspaceCase(id: string): WorkspaceCase | undefined {
  return getDb().prepare('SELECT * FROM workspace_cases WHERE case_id = ?').get(id) as WorkspaceCase | undefined;
}
export function canRead(c: WorkspaceCase, s: Session) {
  return s.role === 'support' || s.role === 'admin' || (s.role === 'rider' ? c.rider_id === s.actor_id : c.driver_id === s.actor_id);
}
// Party responses deliberately exclude model prose, opposing accounts and internal artifacts.
export function publicCase(c: WorkspaceCase, session: Session) {
  const result = c.result ? JSON.parse(c.result) : null;
  const d = result?.validatedDecision;
  const finalDecision = getDb().prepare('SELECT * FROM human_decisions WHERE case_id=?').get(c.case_id) as {action:string;amount_minor:number;rationale:string;decided_at:string} | undefined;
  const isRoute = c.category === 'route';
  const policyProfile = result?.policyProfile?.profileId ?? (isRoute ? 'demo-route-erp-v1' : 'organizer-disp002-v1');
  const isV21 = policyProfile === 'ryde-v2.1';
  const audience = session.role === 'driver' ? 'driver' : 'rider';
  const safeExplanation = d?.validationStatus === 'validated'
    ? isRoute
      ? audience === 'rider'
        ? 'The recorded detour was agreed, so no distance-based refund was calculated. The separate ERP line was checked against the complete synthetic gantry and payment records. No supporting gantry was recorded, so the verified 325-cent line is proposed for simulated refund.'
        : 'The recorded rider agreement resolves the detour allegation. The separate ERP line was unsupported by the complete synthetic gantry record, so only that verified 325-cent line is proposed for simulated refund. This does not imply misconduct by either party.'
      : isV21
        ? 'Policy v2.1 was checked against the scheduled pickup time, verified driver presence, and the required message and call before cancellation. The outcome reflects those policy checks without a finding of dishonesty. Any adjustment is simulated.'
      : audience === 'rider'
        ? `The selected organizer rule was checked against the corroborated ${workspaceProjection(c).derivedFacts.find(f=>f.id==='derived_wait_duration')?.value}-second wait. The operational records support arrival and contact attempts; this does not determine your exact position or imply dishonesty.`
        : `The selected organizer rule was checked against the corroborated ${workspaceProjection(c).derivedFacts.find(f=>f.id==='derived_wait_duration')?.value}-second wait. Arrival and contact records support the outcome, while the rider's account remains acknowledged without any finding of dishonesty.`
    : 'A person must review the unresolved evidence or policy issue. No automatic financial adjustment was made.';
  const outcome = finalDecision ? {
    status:'validated', disposition:finalDecision.action==='reverse_fee'?'Fee reversed':'Closed without adjustment',
    amountMinor:finalDecision.amount_minor, feeTreatment:finalDecision.action==='reverse_fee'?'Simulated fee reversal':'No financial adjustment',
    mode:'human', explanation:'An administrator reviewed this case and recorded a final decision. Any adjustment is simulated.'
  } : d ? {
    status: d.validationStatus, disposition: d.dispositionLabel, amountMinor: d.amountMinor,
    feeTreatment: d.feeTreatment, mode: result.mode,
    explanation: safeExplanation,
    action: d.contractAction, confidence: d.confidence,
  } : null;
  const explanationDetails = c.supported && d ? {
    policyProfile, policyVersion:result.policyProfile?.version ?? '1.0.0',
    facts:isRoute ? ['Actual route was 2,300 metres and 600 seconds above the reference route.', 'The detour was recorded as rider-approved.', 'Paid fare was SGD 21.25; supported total was SGD 18.00; unsupported ERP line was SGD 3.25.']
      : isV21 ? ['Policy v2.1 checks five minutes from scheduled pickup, verified driver presence, and both a message and a call before cancellation.']
      : [`Recorded waiting duration: ${workspaceProjection(c).derivedFacts.find(f=>f.id==='derived_wait_duration')?.value} seconds.`, 'The organizer rule uses a corroborated wait start and a threshold of at least 480 seconds.'],
    evidenceIds:d.evidenceCitations ?? [],
    policyRuleIds:d.policyCitations ?? [],
    opposingEvidence:isRoute?'The longer route was considered, but verified consent resolves the route allegation. The ERP line was assessed separately and is unsupported by the complete synthetic gantry record.':d.validationStatus==='validated'?'Conflicting accounts were assessed against the recorded waiting evidence. The automated outcome passed the selected policy checks; this does not establish that either party was dishonest.':'The review did not establish a supported automatic outcome. Conflicting or incomplete evidence requires a person to decide.',
    limitation:isRoute?'This is a fully synthetic RydeX scenario and uses a labelled demo refund interpretation; it is not a real tariff or payment.':'This case uses organizer sample records, not independently retrieved trip telemetry.',
    confidence:d.confidence,
  } : null;
  const shared = {
    id: c.case_id, tripReference: c.trip_reference, type: c.category, filed: c.filed_at,
    status: c.status, reason: c.reason, supported: Boolean(c.supported), driverAssigned: Boolean(c.driver_id),
    driverResponded: Boolean(c.driver_account), explanationDetails, mode: c.run_mode ?? (c.status === 'queued' ? 'live' : null), outcome,
    automaticAttempts: c.automatic_attempts, automaticAttemptLimit: 3,
    technicalFailure: c.status === 'review_failed' || (c.status === 'human_review' && Boolean(c.run_id) && !result),
    ownAccount: session.role === 'driver' ? c.driver_account : c.complaint,
  };
  return ['support','admin'].includes(session.role) ? { ...shared, finalDecision, complaint: c.complaint, driverAccount: c.driver_account,
    events: JSON.parse(c.events), result, runId: c.run_id, evidence: c.supported ? workspaceProjection(c) : null } : shared;
}
export function workspaceProjection(c: WorkspaceCase) {
  if (!c.supported) throw new Error('Unsupported evidence profile');
  const p = c.category === 'route' ? projectRouteEvidence(loadRouteFixture()) : projectCaseEvidence(loadDisp002Fixture());
  p.caseId = c.case_id;
  p.trip.tripId = c.trip_reference;
  const payment = p.additionalEvidence.find((item) => item.id === 'payment-001');
  if (payment) payment.data.paymentId = `PAY-${c.trip_reference}`;
  p.dispute = { ...p.dispute, disputeId: c.case_id, tripId: c.trip_reference, description: c.complaint, filedAt: c.filed_at };
  p.chatLogs.push({ timestamp: c.filed_at, sender: 'rider', type: 'unverified_party_submission', content: c.complaint });
  if (c.driver_account) p.chatLogs.push({ timestamp: c.driver_filed_at!, sender: 'driver', type: 'unverified_party_submission', content: c.driver_account });
  return p;
}
export function recoverInterruptedCases() {
  getDb().prepare("UPDATE review_checkpoints SET status='interrupted' WHERE status='running'").run();
  getDb().prepare("UPDATE workspace_cases SET status = 'review_failed', reason = 'The service restarted before automatic review finished. Support can retry.' WHERE status IN ('queued','retrying')").run();
  getDb().prepare("UPDATE workspace_cases SET status = 'human_review', reason = 'The server restarted during review. Support can explicitly retry; no automatic action was completed.' WHERE status = 'running'").run();
}
