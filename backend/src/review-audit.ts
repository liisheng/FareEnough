import { getDb } from './db/connection.js';
import { createCaseEvidenceTools } from './tools/case-evidence-tools.js';
import { workspaceProjection, type WorkspaceCase } from './workspace.js';

export function reviewHistory(id: string) {
  const db=getDb();
  const checkpoints=db.prepare('SELECT * FROM review_checkpoints WHERE case_id=?').all(id) as any[];
  const runs=db.prepare('SELECT run_id,mode,status,provider,started_at,completed_at,error_message FROM agent_runs WHERE case_id=?').all(id) as any[];
  const ids=new Set([...checkpoints.map(r=>r.run_id),...runs.map(r=>r.run_id)]);
  return [...ids].map(runId=>{
    const checkpoint=checkpoints.find(r=>r.run_id===runId), run=runs.find(r=>r.run_id===runId);
    const decision=db.prepare('SELECT validation_status,action,amount_minor,currency,evidence_citations,policy_citations,reason_codes FROM decisions WHERE run_id=?').get(runId) as any;
    const stored=db.prepare('SELECT stage,payload FROM agent_artifacts WHERE run_id=?').all(runId) as any[];
    return {runId,mode:checkpoint?.mode??run.mode,status:checkpoint?.status??decision?.validation_status??run.status,
      provider:run?.provider??null,startedAt:checkpoint?.started_at??run.started_at,completedAt:run?.completed_at??null,error:run?.error_message??null,
      artifacts:checkpoint?JSON.parse(checkpoint.artifacts):Object.fromEntries(stored.map(a=>[a.stage,JSON.parse(a.payload)])),
      events:checkpoint?JSON.parse(checkpoint.events):(db.prepare('SELECT payload FROM run_events WHERE run_id=? ORDER BY sequence').all(runId) as any[]).map(e=>JSON.parse(e.payload)),
      evidence:checkpoint?JSON.parse(checkpoint.evidence):null,
      simulatedActions:db.prepare('SELECT action_id,action_type,amount_minor,currency,status FROM simulated_actions WHERE decision_id IN (SELECT decision_id FROM decisions WHERE run_id=?)').all(runId),
      decision:decision?{status:decision.validation_status,action:decision.action,amountMinor:decision.amount_minor,currency:decision.currency,
        evidenceIds:JSON.parse(decision.evidence_citations),policyRuleIds:JSON.parse(decision.policy_citations),reasons:JSON.parse(decision.reason_codes)}:null};
  }).sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
}

export function currentEvidence(c: WorkspaceCase) {
  return c.supported?createCaseEvidenceTools(workspaceProjection(c)).snapshot():null;
}
