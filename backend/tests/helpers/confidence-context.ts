import { loadDisp002Fixture, loadRouteFixture } from '../../src/fixtures/loader.js';
import { projectCaseEvidence } from '../../src/projections/case-projection.js';
import { projectRouteEvidence } from '../../src/projections/route-projection.js';
import { createCaseEvidenceTools, type AgentEvidenceSnapshot } from '../../src/tools/case-evidence-tools.js';

export function confidenceContext(snapshot: AgentEvidenceSnapshot) {
  return { snapshot, profileId: snapshot.policyProfile.profileId, evidenceIds: new Set(snapshot.evidence.map(record => record.id)), policyRuleIds: new Set(snapshot.policyRules.map(rule => rule.id)) };
}

export function organizerContext(seconds = 480) {
  const fixture = structuredClone(loadDisp002Fixture());
  const original = fixture.trip_data.cancellation_time;
  const end = new Date(Date.parse(fixture.trip_data.driver_wait_start) + seconds * 1000).toISOString();
  fixture.trip_data.cancellation_time = end;
  for (const records of [fixture.gps_telemetry, fixture.chat_logs, fixture.app_events]) {
    for (const record of records) if (Date.parse(record.timestamp) === Date.parse(original)) record.timestamp = end;
  }
  return confidenceContext(createCaseEvidenceTools(projectCaseEvidence(fixture)).snapshot());
}

export function routeContext(caseId = 'CASE-ROUTE') {
  const snapshot = createCaseEvidenceTools(projectRouteEvidence(loadRouteFixture())).snapshot();
  snapshot.caseId = caseId;
  return confidenceContext(snapshot);
}
