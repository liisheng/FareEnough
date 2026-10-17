import type { RouteFixture } from '../schemas/route-fixture.js';

export interface RouteEvaluationInput {
  serviceType: string;
  referenceRouteComplete: boolean;
  actualRouteComplete: boolean;
  routeJustification: 'agreed' | 'verified_closure' | 'unresolved';
  paymentVerified: boolean;
  gantryCoverageComplete: boolean;
  disputedPaidMinor: number;
  supportedAllowedMinor: number;
  priorReliefMinor: number;
}

export function evaluateRouteCharge(input: RouteEvaluationInput) {
  const reasons: string[]=[];
  if(input.serviceType!=='RydeX')reasons.push('unsupported_service');
  if(!input.referenceRouteComplete||!input.actualRouteComplete||!input.paymentVerified||!input.gantryCoverageComplete)reasons.push('missing_material_evidence');
  if(input.routeJustification==='unresolved')reasons.push('conflicting_evidence');
  if(!Number.isSafeInteger(input.disputedPaidMinor)||!Number.isSafeInteger(input.supportedAllowedMinor)||!Number.isSafeInteger(input.priorReliefMinor)||input.disputedPaidMinor<0||input.supportedAllowedMinor<0||input.priorReliefMinor<0)reasons.push('amount_mismatch');
  if(reasons.length)return {status:'human_review' as const,adjustmentMinor:0,reasons};
  const remainingReliefMinor=Math.max(0,input.disputedPaidMinor-input.priorReliefMinor);
  const adjustmentMinor=Math.min(Math.max(0,input.disputedPaidMinor-input.supportedAllowedMinor),remainingReliefMinor);
  return {status:'validated' as const,adjustmentMinor,reasons:[]};
}

export function calculateRouteErp(fixture: RouteFixture) {
  const erp = fixture.fare_lines.find((line) => line.id === 'fare-erp-001');
  if (!erp) throw new Error('Synthetic route fixture requires the disputed ERP line');
  const evaluation=evaluateRouteCharge({serviceType:fixture.service_type,referenceRouteComplete:fixture.reference_route.points.length>=2,actualRouteComplete:fixture.actual_route.points.length>=2,routeJustification:'agreed',paymentVerified:fixture.paid_fare_minor===fixture.fare_lines.reduce((sum,line)=>sum+line.amount_minor,0),gantryCoverageComplete:true,disputedPaidMinor:erp.amount_minor,supportedAllowedMinor:erp.supported_minor,priorReliefMinor:fixture.prior_relief_minor});
  if(evaluation.status!=='validated')throw new Error(`Synthetic route fixture failed deterministic gates: ${evaluation.reasons.join(',')}`);
  const adjustmentMinor = evaluation.adjustmentMinor;
  return {
    distanceDifferenceMeters: fixture.actual_route.distance_meters - fixture.reference_route.distance_meters,
    durationDifferenceSeconds: fixture.actual_route.duration_seconds - fixture.reference_route.duration_seconds,
    adjustmentMinor,
    supportedTotalMinor: fixture.paid_fare_minor - adjustmentMinor,
  };
}
