import type { CaseEvidenceResponse } from '../schemas/api.js';
import type { RouteFixture } from '../schemas/route-fixture.js';
import { calculateRouteErp } from '../calculations/route-erp.js';

export function projectRouteEvidence(f: RouteFixture): CaseEvidenceResponse {
  const calculated = calculateRouteErp(f);
  const fact = (id: string, name: string, value: number, unit: string, sources: string[]) => ({
    id, name, value, unit, sourceEvidenceIds: sources, calculationVersion: 'route-erp-v1',
    policyRuleIds: ['DEMO-ERP-01'], status: 'established' as const, warnings: [],
  });
  return {
    caseId: f.fixture_id,
    dispute: { disputeId: f.fixture_id, tripId: f.trip_id, filedBy: 'rider', disputeType: 'route', description: 'The rider disputes an unsupported ERP line while the recorded detour was agreed.', filedAt: f.filed_at, status: 'open' },
    trip: { tripId: f.trip_id, riderId: f.rider_id, driverId: f.driver_id, pickupLocation: f.pickup, dropoffLocation: f.dropoff, scheduledTime: f.filed_at, driverArrivalTime: f.filed_at, driverWaitStart: f.filed_at, cancellationTime: f.filed_at, cancellationFee: 0, cancellationReason: 'not_applicable' },
    gpsTelemetry: f.actual_route.points.map(([lat,lng],index) => ({ timestamp: f.filed_at, lat, lng, speedKmh: 0, status: `actual_route_point_${index + 1}` })),
    chatLogs: [{ timestamp: f.filed_at, sender: 'rider', type: 'route_consent', content: f.rider_consent }],
    appEvents: [],
    cancellationPolicy: { freeWaitTimeMin: 0, cancellationFeeAfterWait: 0, noShowThresholdMin: 0, feeGoesTo: 'not_applicable' },
    derivedFacts: [
      fact('derived_route_distance_difference', 'Actual minus reference route distance', calculated.distanceDifferenceMeters, 'meters', ['route-reference-001','route-actual-001']),
      fact('derived_route_duration_difference', 'Actual minus reference route duration', calculated.durationDifferenceSeconds, 'seconds', ['route-reference-001','route-actual-001']),
      fact('derived_supported_adjustment', 'Unsupported paid ERP adjustment', calculated.adjustmentMinor, 'SGD_minor', ['fare-erp-001','payment-001','gantry-coverage-001']),
      fact('derived_supported_total', 'Supported total after adjustment', calculated.supportedTotalMinor, 'SGD_minor', ['fare-quote-001','payment-001','fare-erp-001']),
    ],
    policyProfile: { profileId: 'demo-route-erp-v1', version: '1.0.0' },
    additionalEvidence: [
      { id:'route-reference-001',kind:'route_context',data:{distanceMeters:f.reference_route.distance_meters,durationSeconds:f.reference_route.duration_seconds,points:f.reference_route.points,provenance:'synthetic_fixture'} },
      { id:'route-actual-001',kind:'route_context',data:{distanceMeters:f.actual_route.distance_meters,durationSeconds:f.actual_route.duration_seconds,points:f.actual_route.points,provenance:'synthetic_fixture'} },
      { id:'route-consent-001',kind:'party_statement',timestamp:f.filed_at,data:{verified:true,content:f.route_context,provenance:'synthetic_fixture'} },
      { id:'fare-quote-001',kind:'fare_line',data:{amountMinor:f.quoted_fare_minor,currency:'SGD',serviceType:f.service_type,provenance:'synthetic_fixture'} },
      ...f.fare_lines.map(line=>({id:line.id,kind:'fare_line' as const,data:{...line,currency:'SGD',provenance:'synthetic_fixture'}})),
      { id:'payment-001',kind:'payment',data:{paymentId:f.payment_id,paidMinor:f.paid_fare_minor,priorReliefMinor:f.prior_relief_minor,currency:'SGD',provenance:'synthetic_fixture'} },
      { id:'gantry-coverage-001',kind:'route_context',data:{coverage:'complete',gantriesPassed:[],description:f.gantry_coverage,provenance:'synthetic_fixture'} },
    ],
    projectedPolicyRules: [
      {id:'DEMO-RT-01',namespace:'demo_interpretation',text:'A route difference is a review signal, not a distance-proportional refund.',value:'no_distance_formula',sourceIds:['SRS-POL-09']},
      {id:'DEMO-RT-02',namespace:'demo_interpretation',text:'Verified rider agreement settles the detour allegation for this synthetic scenario.',value:true,sourceIds:['SRS-POL-11']},
      {id:'DEMO-ERP-01',namespace:'demo_interpretation',text:'Refund only the unsupported portion of a verified paid line, capped by remaining relief.',value:'max(0, paid-supported)',sourceIds:['SRS-POL-10']},
      {id:'PUB-ERP-01',namespace:'official_rule',text:'RydeX ERP should correspond to actual gantries passed.',value:'actual_gantry_required',sourceIds:['SRC-RT-04','SRC-RT-05']},
    ],
  };
}
