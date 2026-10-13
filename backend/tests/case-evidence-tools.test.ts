import { describe, expect, it } from 'vitest';
import { loadDisp002Fixture } from '../src/fixtures/loader.js';
import { projectCaseEvidence } from '../src/projections/case-projection.js';
import { createCaseEvidenceTools } from '../src/tools/case-evidence-tools.js';

describe('case-scoped evidence tools', () => {
  it('exposes stable citations from the safe projection without profiles', () => {
    const tools = createCaseEvidenceTools(projectCaseEvidence(loadDisp002Fixture()));
    const snapshot = tools.snapshot();
    expect(snapshot.caseId).toBe('DISP-002');
    expect(tools.getEvidence(['gps-005'])[0]?.data).toMatchObject({ status: 'arrived', speedKmh: 0 });
    expect(tools.getEvidence(['derived_wait_duration'])[0]?.data).toMatchObject({ value: 480 });
    const serialised = JSON.stringify(snapshot);
    expect(serialised).not.toContain('avg_rating');
    expect(serialised).not.toContain('fraud_flags');
    expect(serialised).not.toContain('dispute_history');
    expect(serialised).not.toContain('Lim Wei Ming');
    expect(serialised).not.toContain('Michael Wong');
    expect(serialised).not.toContain('SGP 4521 M');
    expect(tools.getPolicyRules(['ORG-NS-01'])[0]?.value).toBe(500);
    expect(tools.getPolicyRules(['ORG-NS-02'])[0]?.value).toBe(300);
    expect(tools.getPolicyRules(['ORG-NS-03'])[0]?.value).toBe(480);
  });
});
