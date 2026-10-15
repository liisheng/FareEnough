import { describe, expect, it } from 'vitest';
import { loadRouteFixture } from '../src/fixtures/loader.js';
import { calculateRouteErp, evaluateRouteCharge } from '../src/calculations/route-erp.js';
import { projectRouteEvidence } from '../src/projections/route-projection.js';
import { CaseEvidenceResponseSchema } from '../src/schemas/api.js';
import { createCaseEvidenceTools } from '../src/tools/case-evidence-tools.js';

describe('synthetic route and ERP evidence', () => {
  it('validates the fixture and calculates differences and the capped adjustment', () => {
    const result = calculateRouteErp(loadRouteFixture());
    expect(result).toEqual({
      distanceDifferenceMeters: 2300,
      durationDifferenceSeconds: 600,
      adjustmentMinor: 325,
      supportedTotalMinor: 1800,
    });
  });

  it('projects inspectable route, payment, gantry and consent evidence', () => {
    const projection = CaseEvidenceResponseSchema.parse(projectRouteEvidence(loadRouteFixture()));
    const tools = createCaseEvidenceTools(projection);
    expect(projection.policyProfile.profileId).toBe('demo-route-erp-v1');
    expect(tools.hasEvidence('route-reference-001')).toBe(true);
    expect(tools.hasEvidence('route-actual-001')).toBe(true);
    expect(tools.hasEvidence('fare-erp-001')).toBe(true);
    expect(tools.hasEvidence('payment-001')).toBe(true);
    expect(tools.hasEvidence('gantry-coverage-001')).toBe(true);
    expect(tools.hasPolicyRule('PUB-ERP-01')).toBe(true);
    expect(tools.hasPolicyRule('DEMO-ERP-01')).toBe(true);
  });

  it('covers route gates without distance-proportional refunds',()=>{
    const base={serviceType:'RydeX',referenceRouteComplete:true,actualRouteComplete:true,routeJustification:'agreed' as const,paymentVerified:true,gantryCoverageComplete:true,disputedPaidMinor:325,supportedAllowedMinor:0,priorReliefMinor:0};
    expect(evaluateRouteCharge(base)).toMatchObject({status:'validated',adjustmentMinor:325});
    expect(evaluateRouteCharge({...base,supportedAllowedMinor:325})).toMatchObject({status:'validated',adjustmentMinor:0});
    expect(evaluateRouteCharge({...base,priorReliefMinor:200})).toMatchObject({status:'validated',adjustmentMinor:125});
    expect(evaluateRouteCharge({...base,referenceRouteComplete:false})).toMatchObject({status:'human_review',reasons:['missing_material_evidence']});
    expect(evaluateRouteCharge({...base,routeJustification:'unresolved'})).toMatchObject({status:'human_review',reasons:['conflicting_evidence']});
    expect(evaluateRouteCharge({...base,serviceType:'RydeTAXI'})).toMatchObject({status:'human_review',reasons:['unsupported_service']});
    expect(evaluateRouteCharge({...base,gantryCoverageComplete:false})).toMatchObject({status:'human_review',reasons:['missing_material_evidence']});
  });
});
