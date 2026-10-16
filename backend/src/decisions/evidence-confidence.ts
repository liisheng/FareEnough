import type { AgentEvidenceSnapshot, EvidenceRecord } from '../tools/case-evidence-tools.js';
import type { DecisionConfidence } from './types.js';
import { AUTOMATIC_CONFIDENCE_THRESHOLD, calculateConfidence } from './confidence.js';
import { policyRulesFor } from '../policies/ryde-v21.js';

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const integer = (value: unknown): value is number => finite(value) && Number.isSafeInteger(value) && value >= 0;
const time = (value: unknown) => typeof value === 'string' ? Date.parse(value) : NaN;
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};

/** Assesses backend-built evidence only. No model confidence or party ratings are read.
 * Checklist version is separate from the unchanged SRS weighted rubric version.
 */
export function assessEvidenceConfidence(snapshot: AgentEvidenceSnapshot | undefined, citationsValid: boolean): DecisionConfidence {
  const checks: NonNullable<DecisionConfidence['checks']> = [];
  const records = snapshot?.evidence ?? [];
  const byId = new Map(records.map(record => [record.id, record]));
  const derived = records.filter(record => record.kind === 'derived_fact');
  const trip = records.find(record => record.id === 'trip-001')?.data ?? {};
  const profile = snapshot?.policyProfile.profileId;
  function check(id: string, component: NonNullable<DecisionConfidence['checks']>[number]['component'], passed: boolean, evidenceIds: string[], reason: string) {
    checks.push({ id, component, passed, evidenceIds, reason });
  }
  function provenance(record: EvidenceRecord | undefined): boolean {
    const sources = record?.data.sourceEvidenceIds;
    return !!record && Array.isArray(sources) && sources.length > 0 && sources.every(id => typeof id === 'string' && id !== record.id && byId.has(id));
  }
  function required(id: string, fields: string[]) {
    const record = byId.get(id);
    const valid = !!record && fields.every(field => record.data[field] !== null && record.data[field] !== undefined);
    check(id, 'completeness', valid, record ? [id] : [], `${id}: required fields ${fields.join(', ')} ${valid ? 'available' : 'missing'}.`);
    return record?.data ?? {};
  }
  function derivedCheck(record: EvidenceRecord | undefined, fields: string[]) {
    const valid = provenance(record) && fields.every(field => record?.data[field] !== null && record?.data[field] !== undefined);
    check(`derived:${record?.id ?? fields.join(',')}`, 'completeness', valid, record ? [record.id, ...(Array.isArray(record.data.sourceEvidenceIds) ? record.data.sourceEvidenceIds.filter((id): id is string => typeof id === 'string') : [])] : [], 'Backend calculation and its source records must be available.');
    return record?.data ?? {};
  }
  let requiredRules: string[] = [];
  let nonmaterialDiscrepancy = false;
  if (profile === 'organizer-disp002-v1') {
    requiredRules = ['ORG-NS-01', 'ORG-NS-02', 'ORG-NS-03', 'ORG-NS-04', 'ORG-NS-05'];
    const waitRecord = byId.get('derived_wait_duration');
    const wait = derivedCheck(waitRecord, ['value', 'status']);
    const start = time(trip.driverWaitStart), end = time(trip.cancellationTime);
    check('organizer-clock', 'corroboration', wait.status === 'established' && integer(wait.value) && finite(start) && finite(end) && wait.value === Math.trunc((end - start) / 1000), ['trip-001', 'derived_wait_duration'], 'Derived wait must match the selected organizer clock and have established status.');
    const gps = records.filter(record => record.kind === 'gps');
    const location = object(trip.pickupLocation);
    const near = (record: EvidenceRecord) => finite(location.lat) && finite(location.lng) && record.data.lat === location.lat && record.data.lng === location.lng && record.data.speedKmh === 0;
    const during = gps.filter(record => time(record.timestamp) >= start && time(record.timestamp) <= end);
    check('pickup-records', 'completeness', during.some(record => time(record.timestamp) === start) && during.some(record => time(record.timestamp) === end), during.map(record => record.id), 'Pickup GPS records must cover the wait anchor and cancellation.');
    check('pickup-consistency', 'corroboration', during.length > 0 && during.every(near), during.map(record => record.id), 'Decisive recorded GPS fixes must agree with the pickup location. Samples do not prove continuous presence.');
    check('contact-records', 'completeness', records.some(record => record.kind === 'chat' && record.data.sender === 'driver' && time(record.timestamp) < end), records.filter(record => record.kind === 'chat').map(record => record.id), 'A pre-cancellation driver contact record is available; duplicate logs add no confidence.');
    // The named organizer clock resolves the timer difference; it is not a conflict.
    nonmaterialDiscrepancy = wait.status === 'established' && Array.isArray(wait.warnings) && wait.warnings.length > 0;
  } else if (profile === 'demo-route-erp-v1') {
    requiredRules = ['DEMO-RT-01', 'DEMO-RT-02', 'DEMO-ERP-01', 'PUB-ERP-01'];
    const reference = required('route-reference-001', ['points', 'distanceMeters']);
    const actual = required('route-actual-001', ['points', 'distanceMeters']);
    check('route-coverage', 'completeness', [reference, actual].every(route => Array.isArray(route.points) && route.points.length >= 2 && integer(route.distanceMeters)), ['route-reference-001', 'route-actual-001'], 'Both reference and actual route records need coordinates and distance.');
    const consent = required('route-consent-001', ['verified']);
    const gantry = required('gantry-coverage-001', ['coverage', 'gantriesPassed']);
    const quote = required('fare-quote-001', ['amountMinor', 'serviceType']);
    const payment = required('payment-001', ['paidMinor', 'priorReliefMinor', 'currency']);
    const erp = required('fare-erp-001', ['amount_minor', 'supported_minor', 'currency']);
    const adjustment = derivedCheck(byId.get('derived_supported_adjustment'), ['value', 'status']);
    const amounts = [payment.paidMinor, payment.priorReliefMinor, erp.amount_minor, erp.supported_minor, quote.amountMinor];
    const validMoney = amounts.every(integer);
    const expected = validMoney ? Math.min(Math.max(0, Number(erp.amount_minor) - Number(erp.supported_minor)), Math.max(0, Number(erp.amount_minor) - Number(payment.priorReliefMinor))) : NaN;
    check('route-payment-consistency', 'corroboration', validMoney && payment.currency === 'SGD' && erp.currency === 'SGD' && payment.paidMinor === Number(quote.amountMinor) + Number(erp.amount_minor) && adjustment.status === 'established' && adjustment.value === expected, ['payment-001', 'fare-quote-001', 'fare-erp-001', 'derived_supported_adjustment'], 'Paid total and unsupported-line calculation must reconcile in SGD, with prior relief deducted.');
    check('route-justification', 'corroboration', consent.verified === true && gantry.coverage === 'complete' && Array.isArray(gantry.gantriesPassed) && gantry.gantriesPassed.length === 0, ['route-consent-001', 'gantry-coverage-001'], 'This demo requires verified consent and complete records establishing the unsupported ERP line.');
    check('fixed-fare-service', 'policyCoverage', quote.serviceType === 'RydeX', ['fare-quote-001'], 'The synthetic fixed-fare remedy is limited to RydeX.');
  } else if (profile === 'ryde-v2.1') {
    const category = derived.some(record => 'policyEligibleWaitSeconds' in record.data) ? 'no_show' : derived.some(record => 'fareDifferenceCents' in record.data) ? 'surge' : derived.some(record => 'excessDistanceMetres' in record.data) ? 'route' : undefined;
    requiredRules = category ? policyRulesFor(category).map(rule => rule.id) : [];
    check('supported-category', 'completeness', !!category, [], 'A supported backend calculation identifies the category.');
    if (category === 'no_show') {
      const wait = derivedCheck(derived.find(record => 'policyEligibleWaitSeconds' in record.data), ['policyEligibleWaitSeconds', 'pickupWaitCorroboratedByGpsSamples']);
      const contact = derivedCheck(derived.find(record => 'driverChatAttemptsBeforeCancellation' in record.data), ['driverChatAttemptsBeforeCancellation', 'driverInAppCallAttemptsBeforeCancellation']);
      const fee = derivedCheck(derived.find(record => 'recordedFeeCents' in record.data), ['recordedFeeCents']);
      const timestamps = [trip.scheduledTime, trip.driverArrivalTime, trip.driverWaitStart, trip.cancellationTime].map(time);
      const expected = (timestamps[3] - Math.max(...timestamps.slice(0, 3))) / 1000;
      const anchor = Math.max(...timestamps.slice(0, 3)), end = timestamps[3];
      const gps = records.filter(record => record.kind === 'gps').sort((a, b) => time(a.timestamp) - time(b.timestamp));
      const preceding = gps.filter(record => time(record.timestamp) <= anchor).at(-1);
      const interval = gps.filter(record => time(record.timestamp) >= anchor && time(record.timestamp) <= end);
      const location = object(trip.pickupLocation);
      const near = (record: EvidenceRecord) => finite(location.lat) && finite(location.lng) && finite(record.data.lat) && finite(record.data.lng) && Math.abs(record.data.lat - location.lat) < 0.000001 && Math.abs(record.data.lng - location.lng) < 0.000001 && record.data.speedKmh === 0;
      const pickupConsistent = !!preceding && near(preceding) && interval.some(record => time(record.timestamp) === end) && interval.every(near);
      const driverRecords = records.filter(record => record.kind === 'chat' && record.data.sender === 'driver' && time(record.timestamp) < end);
      const messages = driverRecords.filter(record => record.data.type === 'message').length;
      const calls = Math.max(driverRecords.filter(record => record.data.type === 'call').length, records.filter(record => record.kind === 'app_event' && record.data.eventType === 'driver_called_rider' && time(record.timestamp) < end).length);
      check('no-show-consistency', 'corroboration', timestamps.every(finite) && integer(wait.policyEligibleWaitSeconds) && wait.policyEligibleWaitSeconds === Math.floor(expected) && wait.pickupWaitCorroboratedByGpsSamples === true && pickupConsistent && contact.driverChatAttemptsBeforeCancellation === messages && contact.driverInAppCallAttemptsBeforeCancellation === calls && fee.recordedFeeCents === 500 && finite(trip.cancellationFee) && Math.round(trip.cancellationFee * 100) === fee.recordedFeeCents, [...derived.map(record => record.id), ...gps.map(record => record.id)], 'Wait, pickup samples, contact records and fee must agree with their calculations. Zero recorded contact attempts is a known fact, not missing evidence. Duplicate call logs add no confidence.');
    } else if (category === 'surge') {
      const surge = derivedCheck(derived.find(record => 'fareDifferenceCents' in record.data), ['quotedCents', 'actualCents', 'fareDifferenceCents', 'differenceSolelyFromSurgeChange']);
      const notification = required('surge-001', ['rider_notified']);
      const fare = byId.get('fare-001')?.data ?? {};
      const quote = object(fare.upfront_quote), actual = object(fare.actual_fare);
      const cents = (value: unknown) => finite(value) ? Math.round(value * 100) : NaN;
      const quoteSubtotal = cents(quote.surgeable_subtotal), actualSubtotal = cents(actual.surgeable_subtotal);
      const quoteMultiplier = notification.quote_time_surge, actualMultiplier = notification.trip_start_surge;
      const rawFareMatches = cents(trip.upfront_quote) === surge.quotedCents && cents(trip.actual_fare) === surge.actualCents && cents(quote.total) === surge.quotedCents && cents(actual.total) === surge.actualCents && integer(quoteSubtotal) && quoteSubtotal === actualSubtotal && finite(quoteMultiplier) && finite(actualMultiplier) && quote.surge_multiplier === quoteMultiplier && actual.surge_multiplier === actualMultiplier && cents(quote.surge_amount) === Math.round(quoteSubtotal * (Number(quoteMultiplier) - 1)) && cents(actual.surge_amount) === Math.round(actualSubtotal * (Number(actualMultiplier) - 1)) && Number(surge.actualCents) - Math.round(actualSubtotal * Number(actualMultiplier)) === Number(surge.quotedCents) - Math.round(quoteSubtotal * Number(quoteMultiplier));
      check('surge-consistency', 'corroboration', rawFareMatches && integer(surge.quotedCents) && integer(surge.actualCents) && surge.fareDifferenceCents === Number(surge.actualCents) - Number(surge.quotedCents) && surge.differenceSolelyFromSurgeChange === true && typeof notification.rider_notified === 'boolean', [...derived.map(record => record.id), 'trip-001', 'fare-001', 'surge-001'], 'Quote, receipt, surge and fixed components must reconcile with the derived difference, with notification records available.');
    } else if (category === 'route') {
      const distance = derivedCheck(derived.find(record => 'excessDistanceMetres' in record.data), ['actualDistanceMetres', 'recommendedDistanceMetres', 'excessDistanceMetres']);
      check('distance-consistency', 'corroboration', integer(distance.actualDistanceMetres) && integer(distance.recommendedDistanceMetres) && distance.excessDistanceMetres === Number(distance.actualDistanceMetres) - Number(distance.recommendedDistanceMetres), derived.map(record => record.id), 'Distance difference must reconcile. Calibration and route policy gates are checked separately.');
    }
  } else {
    check('supported-profile', 'policyCoverage', false, [], 'No confidence checklist exists for this policy profile.');
  }
  check('case-evidence', 'completeness', !!snapshot && records.some(record => record.kind === 'dispute') && records.some(record => record.id === 'trip-001') && byId.size === records.length, ['dispute-001', 'trip-001'], 'Case and trip evidence must exist, with unique record identifiers.');
  const rules = new Map(snapshot?.policyRules.map(rule => [rule.id, rule]));
  check('selected-policy-rules', 'policyCoverage', requiredRules.length > 0 && requiredRules.every(id => !!rules.get(id)?.text.trim()), [], 'All material rules for the selected profile/category must be present.');
  check('decisive-citations', 'citationValidity', citationsValid, [], 'Proposal schema, evidence references and policy grounding must pass validation.');
  const passes = (component: NonNullable<DecisionConfidence['checks']>[number]['component']) => checks.some(check => check.component === component) && checks.filter(check => check.component === component).every(check => check.passed);
  const confidence = calculateConfidence({ complete: passes('completeness'), corroboration: !passes('corroboration') ? 'material_conflict' : nonmaterialDiscrepancy ? 'nonmaterial_discrepancy' : 'consistent', policyCoverage: passes('policyCoverage') ? 'complete' : 'material_gap', citationsValid });
  return { ...confidence, assessmentVersion: 'evidence-checklist-v1', threshold: AUTOMATIC_CONFIDENCE_THRESHOLD, checks,
    explanations: [...confidence.explanations, ...checks.map(check => `${check.passed ? 'PASS' : 'REVIEW'} ${check.id}: ${check.reason}`), ...(nonmaterialDiscrepancy ? ['Established calculation carries a nonmaterial warning; corroboration is reduced to 0.5.'] : [])] };
}
