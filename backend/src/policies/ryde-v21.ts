import { readFileSync } from 'node:fs';
import type { CaseEvidenceResponse } from '../schemas/api.js';
import type { AgentEvidenceSnapshot, EvidenceRecord, PolicyRule } from '../tools/case-evidence-tools.js';

/** Policy facts are evaluated independently of any model's proposed result. */
interface CommonFacts {
  disputeValueCents: number | null;
  evidenceIds: string[];
  safetyRelated?: boolean;
  /** An independently calibrated score, never a model's self-reported confidence. */
  calibratedConfidence?: number;
}
export interface NoShowFacts extends CommonFacts {
  category: 'no_show';
  scheduledTime: string | null;
  arrivalTime: string | null;
  waitStart: string | null;
  cancellationTime: string | null;
  pickupWaitVerified: boolean | null;
  driverArrived: boolean | null;
  cancellationActor: 'driver' | 'rider' | null;
  cancellationReason: string | null;
  chatAttempts: number | null;
  callAttempts: number | null;
  feeCents: number | null;
}
export interface SurgeFacts extends CommonFacts {
  category: 'surge';
  quotedCents: number | null;
  actualCents: number | null;
  quoteMultiplier: number | null;
  startMultiplier: number | null;
  solelySurgeDifference: boolean | null;
  notificationValid: boolean | null;
  riderProceeded: boolean | null;
}
export interface RouteFacts extends CommonFacts {
  category: 'route';
  recommendedDistanceMetres: number | null;
  actualDistanceMetres: number | null;
  distanceRateCentsPerKm: number | null;
  trafficJustified: boolean | null;
  notifiedAndAgreed: boolean | null;
}
export type ReviewFacts = NoShowFacts | SurgeFacts | RouteFacts;
export interface PolicyAssessment {
  outcome: 'uphold_fee' | 'reverse_fee' | 'human_review';
  adjustmentCents: number;
  evidenceIds: string[];
  policyRuleIds: string[];
  reasonCodes: string[];
}
export interface ReviewFixture {
  snapshot: AgentEvidenceSnapshot;
  assessment: PolicyAssessment;
  calculatedFacts: ReviewFacts;
  sourceNotes: string[];
}
export const reviewFixtureIds = ['DISP-001', 'DISP-002', 'DISP-003'] as const;
const profile = { profileId: 'ryde-v2.1', version: '2.1' };
const rule = (section: string, text: string): PolicyRule => ({ id: `RYDE-V2.1-${section}`, text, value: `Policy v2.1 §${section}` });
const commonRules = [
  rule('5.1', 'A safety incident or safety-related allegation requires human review regardless of dispute category or amount.'),
  rule('5.2', 'For safety incidents, agents may gather and summarize evidence but cannot determine fault or recommend a resolution.'),
  rule('6.1', 'Dispute value under S$10 permits automatic determination at any confidence level; S$10 through S$50 requires confidence of at least 80%; above S$50 always requires human review. Category restrictions in §6.2 also apply.'),
  rule('6.2', 'Route deviation requires confidence of at least 80% AND deviation no greater than 2 km; otherwise human review. No-show/cancellation is eligible for automatic determination at its fixed S$5 fee. Safety always requires review.'),
];
const noShowRules = [
  rule('2.1', 'The driver must wait at the pickup location for a free wait time of five minutes from the scheduled pickup time. After five minutes the driver may cancel for rider no-show.'),
  rule('2.2', 'The rider is charged a S$5 (500 cents) no-show cancellation fee when the driver cancels after the free wait period; the fee compensates the driver.'),
  rule('2.3', 'Before cancelling for no-show the driver must attempt at least one in-app chat message AND at least one phone call through the in-app calling system. Failure to satisfy both contact obligations voids the cancellation fee. An unanswered call is still an attempt; contact after cancellation does not qualify.'),
  rule('2.4', 'If the driver has not arrived by scheduled pickup plus five minutes, the rider may cancel without charge. If the driver fails to arrive AND fails to attempt contact, the rider is eligible for a separate S$5 goodwill credit. That credit is a distinct action from refunding a fee.'),
];
const surgeRules = [
  rule('3.1', 'The upfront quote is binding at the surge multiplier in effect when quoted.'),
  rule('3.2', 'An increase in surge before trip start requires an in-app notification before or at pickup stating the new multiplier, revised estimated fare, and an option to cancel without penalty.'),
  rule('3.3', 'When surge increases and the rider was not notified, refund the full surge differential. When properly notified and the rider proceeds, the higher fare applies. Lower surge benefits the rider; unchanged surge leaves the quoted fare applicable.'),
  rule('3.4', 'Surge differential = actual fare minus upfront quote, provided the difference is attributable solely to the multiplier change with all other fare components unchanged.'),
  rule('3.5', 'Booking fee is exempt from surge. Base fare, distance fare and time fare are multiplied.'),
];
const routeRules = [
  rule('1.1', 'Rerouting for traffic, road closures or congestion is allowed, but the rider must be informed.'),
  rule('1.2', 'Before or at deviation the driver must inform the rider through in-app chat or verbally supported by the trip call recording, with a brief reason.'),
  rule('1.3', 'Deviation no greater than 1 km is within tolerance with no excess-distance refund. Above 1 km: traffic-justified and informed/agreed rerouting has no refund; traffic-justified but unnotified rerouting permits a partial refund of excess distance fare; unjustified rerouting requires the full excess distance fare refund. Category escalation in §6.2 still applies before an automatic ruling.'),
  rule('1.4', 'Deviation distance is actual route distance minus recommended route distance. Historical traffic evidence at the trip time verifies traffic justification. Chat or call evidence confirming acknowledgment establishes rider agreement.'),
];
export function policyRulesFor(category: ReviewFacts['category']): PolicyRule[] {
  return structuredClone([...(category === 'no_show' ? noShowRules : category === 'surge' ? surgeRules : routeRules), ...commonRules]);
}
function instant(value: string | null): number | null {
  if (!value) return null;
  const number = Date.parse(value);
  return Number.isFinite(number) ? number : null;
}
export function calculatePolicyWaitSeconds(facts: Pick<NoShowFacts, 'scheduledTime' | 'arrivalTime' | 'waitStart' | 'cancellationTime'>): number | null {
  const values = [facts.scheduledTime, facts.arrivalTime, facts.waitStart, facts.cancellationTime].map(instant);
  if (values.some(value => value === null)) return null;
  const [scheduled, arrival, start, cancelled] = values as number[];
  const anchor = Math.max(scheduled, arrival, start);
  return cancelled >= anchor ? Math.floor((cancelled - anchor) / 1000) : null;
}
const integerMoney = (n: number | null): n is number => n !== null && Number.isSafeInteger(n) && n >= 0;

export function evaluateReviewFacts(facts: ReviewFacts): PolicyAssessment {
  const result = (outcome: PolicyAssessment['outcome'], reason: string, sections: string[], adjustmentCents = 0): PolicyAssessment => {
    const invalidAdjustment = !integerMoney(adjustmentCents) || (integerMoney(facts.disputeValueCents) && adjustmentCents > facts.disputeValueCents);
    return {
      outcome: invalidAdjustment ? 'human_review' : outcome,
      adjustmentCents: invalidAdjustment ? 0 : adjustmentCents,
      evidenceIds: [...new Set(facts.evidenceIds)],
      policyRuleIds: [...new Set(invalidAdjustment ? [...sections, '6.1'] : sections)].map(section => `RYDE-V2.1-${section}`),
      reasonCodes: [invalidAdjustment ? 'ADJUSTMENT_INVALID_OR_EXCEEDS_DISPUTE_VALUE' : reason],
    };
  };
  const review = (reason: string, sections: string[]) => result('human_review', reason, sections);
  if (facts.safetyRelated) return review('SAFETY_ESCALATION', ['5.1', '5.2']);
  if (!integerMoney(facts.disputeValueCents)) return review('MISSING_DISPUTE_VALUE', ['6.1']);
  if (facts.disputeValueCents > 5000) return review('VALUE_EXCEEDS_AUTOMATION_LIMIT', ['6.1']);
  if (facts.calibratedConfidence !== undefined && (!Number.isFinite(facts.calibratedConfidence) || facts.calibratedConfidence < 0 || facts.calibratedConfidence > 1)) return review('INVALID_CALIBRATED_CONFIDENCE', ['6.1']);
  if (facts.category === 'route') {
    if (!integerMoney(facts.actualDistanceMetres) || !integerMoney(facts.recommendedDistanceMetres)) return review('MISSING_OR_INVALID_ROUTE_DISTANCE', ['1.4', '6.2']);
    const excess = facts.actualDistanceMetres - facts.recommendedDistanceMetres;
    if (excess > 2000) return review('ROUTE_DEVIATION_EXCEEDS_2KM', ['1.4', '6.2']);
    if (facts.calibratedConfidence === undefined || facts.calibratedConfidence < 0.8 || facts.calibratedConfidence > 1) return review('CALIBRATED_CONFIDENCE_UNAVAILABLE_OR_LOW', ['6.2']);
    if (excess <= 1000) return result('uphold_fee', 'ROUTE_WITHIN_TOLERANCE', ['1.3', '6.2']);
    if (facts.trafficJustified && facts.notifiedAndAgreed) return result('uphold_fee', 'AGREED_TRAFFIC_REROUTE', ['1.3', '1.4', '6.2']);
    if (facts.trafficJustified === null || (facts.trafficJustified && facts.notifiedAndAgreed === null)) return review('MISSING_ROUTE_JUSTIFICATION_OR_NOTIFICATION', ['1.2', '1.3', '1.4']);
    if (!integerMoney(facts.distanceRateCentsPerKm)) return review('MISSING_DISTANCE_FARE_RATE', ['1.3', '1.4']);
    return result('reverse_fee', 'EXCESS_DISTANCE_FARE_REFUND', ['1.3', '1.4', '6.2'], Math.round(excess * facts.distanceRateCentsPerKm / 1000));
  }
  if (facts.category === 'no_show') {
    if (!integerMoney(facts.feeCents) || facts.feeCents !== 500) return review('NONSTANDARD_OR_MISSING_NO_SHOW_FEE', ['2.2', '6.2']);
    if (facts.driverArrived === false && facts.chatAttempts === 0 && facts.callAttempts === 0) return review('GOODWILL_CREDIT_REQUIRES_SEPARATE_ACTION', ['2.4']);
    if (facts.cancellationActor === 'rider') {
      const scheduled = instant(facts.scheduledTime), cancelled = instant(facts.cancellationTime);
      if (facts.driverArrived === false && scheduled !== null && cancelled !== null && cancelled - scheduled >= 300_000) return result('reverse_fee', 'DRIVER_NO_SHOW_FEE_VOID', ['2.4'], facts.feeCents);
      return review('RIDER_CANCELLATION_REQUIRES_REVIEW', ['2.4']);
    }
    if (facts.cancellationActor !== 'driver' || facts.cancellationReason !== 'rider_no_show') return review('CANCELLATION_ACTOR_OR_REASON_UNRESOLVED', ['2.1', '2.2']);
    if (facts.chatAttempts === 0 || facts.callAttempts === 0) return result('reverse_fee', 'CONTACT_OBLIGATION_NOT_MET', ['2.3'], facts.feeCents);
    if (facts.chatAttempts === null || facts.callAttempts === null || facts.chatAttempts < 0 || facts.callAttempts < 0) return review('CONTACT_RECORDS_UNAVAILABLE', ['2.3']);
    const seconds = calculatePolicyWaitSeconds(facts);
    if (seconds === null) return review('WAIT_TIMESTAMPS_UNRESOLVED', ['2.1']);
    if (seconds < 300) return result('reverse_fee', 'FREE_WAIT_NOT_COMPLETED', ['2.1', '2.2'], facts.feeCents);
    if (facts.pickupWaitVerified === null) return review('PICKUP_WAIT_UNRESOLVED', ['2.1']);
    if (!facts.pickupWaitVerified) return result('reverse_fee', 'REQUIRED_PICKUP_WAIT_NOT_COMPLETED', ['2.1', '2.2'], facts.feeCents);
    return result('uphold_fee', 'NO_SHOW_CONDITIONS_ESTABLISHED', ['2.1', '2.2', '2.3', '6.2']);
  }
  if (facts.disputeValueCents >= 1000 && (facts.calibratedConfidence === undefined || facts.calibratedConfidence < 0.8 || facts.calibratedConfidence > 1)) return review('CALIBRATED_CONFIDENCE_UNAVAILABLE_OR_LOW', ['6.1']);
  if (!integerMoney(facts.quotedCents) || !integerMoney(facts.actualCents) || facts.quoteMultiplier === null || facts.startMultiplier === null) return review('FARE_COMPONENTS_UNAVAILABLE', ['3.1', '3.4']);
  const difference = facts.actualCents - facts.quotedCents;
  if (facts.startMultiplier <= facts.quoteMultiplier) return review('NON_INCREASE_SURGE_CASE_REQUIRES_REVIEW', ['3.1', '3.3']);
  if (facts.solelySurgeDifference !== true || difference <= 0) return review('SURGE_DIFFERENTIAL_NOT_ESTABLISHED', ['3.4']);
  if (facts.notificationValid === false) return result('reverse_fee', 'UNNOTIFIED_SURGE_DIFFERENTIAL', ['3.1', '3.2', '3.3', '3.4'], difference);
  if (facts.notificationValid === true && facts.riderProceeded === true) return result('uphold_fee', 'NOTIFIED_SURGE_ACCEPTED', ['3.2', '3.3']);
  return review('SURGE_NOTIFICATION_OR_ACCEPTANCE_UNRESOLVED', ['3.2', '3.3']);
}

type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.map(row) : [];
const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const string = (value: unknown): string | null => typeof value === 'string' ? value : null;
const cents = (value: unknown): number | null => number(value) === null ? null : Math.round((value as number) * 100);
const bool = (value: unknown): boolean | null => typeof value === 'boolean' ? value : null;
const pick = (source: Row, keys: string[]): Row => Object.fromEntries(keys.filter(key => key in source).map(key => [key, source[key]]));
const cleanText = (value: unknown): unknown => typeof value === 'string' ? value.replace(/\b(?:Michael Wong|Lim Wei Ming|James Ford|Tan Ah Beng|Sarah Tan|Rajesh Kumar)\b/g, '[name redacted]').replace(/\b(?:SGP 4521 M|SLM 8890 P|SHA 7823 K)\b/g, '[plate redacted]') : value;
function safeRecord(value: Row): Row { return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, typeof nested === 'string' ? cleanText(nested) : Array.isArray(nested) ? nested.map(item => typeof item === 'object' ? safeRecord(row(item)) : cleanText(item)) : nested && typeof nested === 'object' ? safeRecord(row(nested)) : nested])); }
const sourceNotes = [
  'Policy v2.1 governs this snapshot. Embedded sample timer text or legacy cancellation_policy values are platform observations, not current policy.',
  '§6.3 party credibility/fraud calibration is not implemented: profile history, ratings, fraud flags and names are excluded. Cases needing calibrated confidence are reviewed unless an independently calibrated score is supplied.',
  'Implementation interpretation: pickup waiting starts at the later of scheduled pickup, actual arrival and recorded wait start; time before physical arrival cannot establish waiting at pickup. Only an independently calibrated confidence score is accepted for cases needing a confidence threshold.',
  'The platform simulates financial actions; the evaluator does not execute refunds or goodwill credits.',
];
function record(id: string, kind: EvidenceRecord['kind'], data: Row, timestamp?: string): EvidenceRecord {
  const annotatedData = kind === 'app_event' || (kind === 'chat' && data.sender === 'system')
    ? { ...data, epistemicStatus: 'recorded_platform_behavior_not_governing_policy' }
    : data;
  return { id, kind, data: safeRecord(annotatedData), ...(timestamp ? { timestamp } : {}) };
}
function derivedFactsFirst(evidence: EvidenceRecord[]): EvidenceRecord[] {
  return [...evidence.filter(item => item.kind === 'derived_fact'), ...evidence.filter(item => item.kind !== 'derived_fact')];
}
function hasSafety(description: string): boolean { return /\b(unsafe|assault|harass(?:ed|ment)?|reckless|dangerous driving|threat(?:ened)?|traffic accident)\b/i.test(description); }
function hasSafetyEvidence(evidence: EvidenceRecord[]): boolean {
  // A reported safety allegation warrants escalation without establishing fault.
  // Scan party communications too, including later submitted accounts.
  return evidence.some(item => hasSafety(JSON.stringify(item.data)));
}

/** Converts only first-party records; no expected/recommended ruling enters the snapshot. */
export function snapshotForNoShowProjection(projection: CaseEvidenceResponse): AgentEvidenceSnapshot {
  return noShowProjectionReview(projection).snapshot;
}
export function assessNoShowProjection(projection: CaseEvidenceResponse): PolicyAssessment {
  return noShowProjectionReview(projection).assessment;
}
export function noShowProjectionReview(projection: CaseEvidenceResponse, logAvailability: { chatRecordsAvailable?: boolean; callRecordsAvailable?: boolean } = {}): ReviewFixture {
  const evidence: EvidenceRecord[] = [record('dispute-001', 'dispute', { ...projection.dispute, epistemicStatus: 'reported_account' }, projection.dispute.filedAt), record('trip-001', 'trip', projection.trip),
    ...projection.gpsTelemetry.map((item, i) => record(`gps-${String(i + 1).padStart(3, '0')}`, 'gps', item, item.timestamp)),
    ...projection.chatLogs.map((item, i) => record(`chat-${String(i + 1).padStart(3, '0')}`, 'chat', { ...item, epistemicStatus: item.sender === 'system' ? 'platform_record' : 'recorded_communication_not_independent_verification_of_claim' }, item.timestamp)),
    ...projection.appEvents.map((item, i) => record(`evt-${String(i + 1).padStart(3, '0')}`, 'app_event', item, item.timestamp)),
  ];
  const cancelled = instant(projection.trip.cancellationTime);
  const beforeCancel = (timestamp: string) => cancelled !== null && instant(timestamp) !== null && instant(timestamp)! < cancelled;
  const chats = projection.chatLogs.filter(item => item.sender === 'driver' && item.type === 'message' && beforeCancel(item.timestamp));
  const calls = projection.chatLogs.filter(item => item.sender === 'driver' && item.type === 'call' && beforeCancel(item.timestamp));
  const callEvents = projection.appEvents.filter(item => item.eventType === 'driver_called_rider' && beforeCancel(item.timestamp));
  const anchorCandidates = [projection.trip.scheduledTime, projection.trip.driverArrivalTime, projection.trip.driverWaitStart];
  const rawAnchor = anchorCandidates.map(instant);
  const anchor = rawAnchor.every(value => value !== null) ? Math.max(...rawAnchor as number[]) : null;
  const anchorTimestamp = anchor === null ? null : anchorCandidates[rawAnchor.indexOf(anchor)];
  const fixes = projection.gpsTelemetry.filter(point => instant(point.timestamp) !== null).sort((a, b) => instant(a.timestamp)! - instant(b.timestamp)!);
  const nearPickup = (point: typeof fixes[number]) => Math.abs(point.lat - projection.trip.pickupLocation.lat) < 0.000001 && Math.abs(point.lng - projection.trip.pickupLocation.lng) < 0.000001 && point.speedKmh === 0;
  const preceding = anchor === null ? undefined : fixes.filter(point => instant(point.timestamp)! <= anchor).at(-1);
  const endFix = cancelled === null ? undefined : fixes.find(point => instant(point.timestamp)! === cancelled);
  const interval = anchor === null || cancelled === null ? [] : fixes.filter(point => instant(point.timestamp)! >= anchor && instant(point.timestamp)! <= cancelled);
  // Disagreeing fixes are an unresolved wait timeline, not proof that no later
  // qualifying five-minute wait occurred. Do not turn noisy/missing GPS into fault.
  const pickupWaitVerified = preceding && endFix && interval.length > 0 && nearPickup(preceding) && interval.every(nearPickup) ? true : null;
  const cancellation = projection.chatLogs.find(item => item.sender === 'system' && /cancelled by driver/i.test(item.content));
  const facts: NoShowFacts = {
    category: 'no_show', disputeValueCents: cents(projection.trip.cancellationFee), feeCents: cents(projection.trip.cancellationFee),
    scheduledTime: projection.trip.scheduledTime, arrivalTime: projection.trip.driverArrivalTime, waitStart: projection.trip.driverWaitStart, cancellationTime: projection.trip.cancellationTime,
    pickupWaitVerified, driverArrived: fixes.some(point => nearPickup(point) && cancelled !== null && instant(point.timestamp)! <= cancelled) ? true : null,
    cancellationActor: cancellation ? 'driver' : null, cancellationReason: projection.trip.cancellationReason,
    chatAttempts: cancelled === null || logAvailability.chatRecordsAvailable === false ? null : chats.length,
    callAttempts: cancelled === null || logAvailability.callRecordsAvailable === false ? null : Math.max(calls.length, callEvents.length),
    safetyRelated: hasSafetyEvidence(evidence), evidenceIds: evidence.map(item => item.id),
  };
  const elapsed = instant(facts.arrivalTime) !== null && cancelled !== null ? Math.floor((cancelled - instant(facts.arrivalTime)!) / 1000) : null;
  const policyWaitSeconds = calculatePolicyWaitSeconds(facts);
  evidence.push(record('derived-ryde-v21-wait', 'derived_fact', {
    measurement: 'policy_eligible_pickup_wait',
    unit: 'seconds',
    policyEligibleWaitStartTimestamp: anchorTimestamp,
    policyEligibleWaitEndTimestamp: cancelled === null ? null : projection.trip.cancellationTime,
    policyEligibleWaitSeconds: policyWaitSeconds,
    calculation: 'cancellation - max(scheduled pickup, actual arrival, wait start)',
    pickupWaitCorroboratedByGpsSamples: pickupWaitVerified,
    observationLimit: 'GPS fixes corroborate the vehicle at recorded pickup coordinates; they do not independently establish the rider location. Sampled locations are not continuous measurement.',
    sourceEvidenceIds: ['trip-001', ...evidence.filter(item => item.kind === 'gps').map(item => item.id)],
  }));
  evidence.push(record('derived-ryde-v21-contact', 'derived_fact', {
    driverChatAttemptsBeforeCancellation: facts.chatAttempts, driverInAppCallAttemptsBeforeCancellation: facts.callAttempts,
    duplicateChatAndEventCallRecordsCountedOnce: true,
    sourceEvidenceIds: evidence.filter(item => item.kind === 'chat' || item.kind === 'app_event').map(item => item.id),
  }));
  evidence.push(record('derived-ryde-v21-fee', 'derived_fact', {
    recordedFeeCents: facts.feeCents, currency: 'SGD',
    calculation: 'round(recorded cancellation fee in SGD * 100)',
    sourceEvidenceIds: ['trip-001'],
  }));
  evidence.push(record('derived-ryde-v21-elapsed', 'derived_fact', {
    measurement: 'arrival_to_cancellation_elapsed_interval',
    purpose: 'descriptive_only_not_the_policy_eligible_wait_interval',
    unit: 'seconds',
    elapsedStartTimestamp: instant(facts.arrivalTime) === null ? null : projection.trip.driverArrivalTime,
    elapsedEndTimestamp: cancelled === null ? null : projection.trip.cancellationTime,
    elapsedArrivalToCancellationSeconds: elapsed,
    calculation: 'recorded cancellation - recorded driver arrival',
    sourceEvidenceIds: ['trip-001'],
  }));
  facts.evidenceIds = evidence.map(item => item.id);
  return { snapshot: { caseId: projection.caseId, evidence: derivedFactsFirst(evidence), policyRules: policyRulesFor('no_show'), policyProfile: profile }, assessment: evaluateReviewFacts(facts), calculatedFacts: facts, sourceNotes: [...sourceNotes] };
}

export function loadReviewFixture(caseId: string): ReviewFixture {
  if (!(reviewFixtureIds as readonly string[]).includes(caseId)) throw new Error('Unsupported review fixture');
  const data = JSON.parse(readFileSync(new URL(`../../../data/fixtures/${caseId.toLowerCase()}.json`, import.meta.url), 'utf8')) as Row;
  return reviewFixtureFromRaw(data);
}
export function reviewFixtureFromRaw(data: Row): ReviewFixture {
  const ticket = row(data.dispute_ticket), trip = row(data.trip_data);
  const caseId = string(ticket.dispute_id);
  if (!caseId) throw new Error('Fixture has no case ID');
  const category = ticket.dispute_type;
  if (category === 'no_show_charge') {
    const location = (value: unknown) => { const item = row(value); return { name: string(item.name) ?? '', lat: number(item.lat) ?? NaN, lng: number(item.lng) ?? NaN }; };
    return noShowProjectionReview({ caseId,
      dispute: { disputeId: caseId, tripId: string(ticket.trip_id) ?? '', filedBy: string(ticket.filed_by) ?? '', disputeType: 'no_show_charge', description: string(ticket.description) ?? '', filedAt: string(ticket.filed_at) ?? '', status: string(ticket.status) ?? '' },
      trip: { tripId: string(trip.trip_id) ?? '', riderId: string(trip.rider_id) ?? '', driverId: string(trip.driver_id) ?? '', pickupLocation: location(trip.pickup_location), dropoffLocation: location(trip.dropoff_location), scheduledTime: string(trip.scheduled_time) ?? '', driverArrivalTime: string(trip.driver_arrival_time) ?? '', driverWaitStart: string(trip.driver_wait_start) ?? '', cancellationTime: string(trip.cancellation_time) ?? '', cancellationFee: number(trip.cancellation_fee) ?? NaN, cancellationReason: string(trip.cancellation_reason) ?? '' },
      gpsTelemetry: rows(data.gps_telemetry).map(item => ({ timestamp: string(item.timestamp) ?? '', lat: number(item.lat) ?? NaN, lng: number(item.lng) ?? NaN, speedKmh: number(item.speed_kmh) ?? NaN, status: string(item.status) ?? '' })),
      chatLogs: rows(data.chat_logs).map(item => ({ timestamp: string(item.timestamp) ?? '', sender: string(item.sender) ?? '', type: string(item.type) ?? '', content: string(item.content) ?? '' })),
      appEvents: rows(data.app_events).map(item => ({ timestamp: string(item.timestamp) ?? '', eventType: string(item.event_type) ?? '', details: string(item.details) ?? '' })),
      cancellationPolicy: { freeWaitTimeMin: 5, cancellationFeeAfterWait: 5, noShowThresholdMin: 5, feeGoesTo: 'driver_compensation' }, derivedFacts: [], policyProfile: profile,
    }, { chatRecordsAvailable: Array.isArray(data.chat_logs), callRecordsAvailable: Array.isArray(data.chat_logs) || Array.isArray(data.app_events) });
  }
  if (category !== 'route_deviation' && category !== 'fare_dispute') throw new Error('Unsupported fixture category');
  const evidence: EvidenceRecord[] = [record('dispute-001', 'dispute', { ...pick(ticket, ['dispute_id', 'trip_id', 'filed_by', 'dispute_type', 'description', 'filed_at']), epistemicStatus: 'reported_account' }), record('trip-001', 'trip', pick(trip, ['trip_id', 'rider_id', 'driver_id', 'pickup_location', 'dropoff_location', 'start_time', 'end_time', 'estimated_duration_min', 'actual_duration_min', 'estimated_distance_km', 'actual_distance_km', 'estimated_fare', 'actual_fare', 'upfront_quote'])),
    ...rows(data.gps_telemetry).map((item, i) => record(`gps-${String(i + 1).padStart(3, '0')}`, 'gps', pick(item, ['timestamp', 'lat', 'lng', 'speed_kmh', 'location_desc']), string(item.timestamp) ?? undefined)),
    ...rows(data.chat_logs).map((item, i) => record(`chat-${String(i + 1).padStart(3, '0')}`, 'chat', { ...pick(item, ['message_id', 'sender', 'timestamp', 'message']), epistemicStatus: 'recorded_communication_not_independent_verification_of_claim' }, string(item.timestamp) ?? undefined)),
  ];
  let facts: ReviewFacts;
  if (category === 'route_deviation') {
    const fare = row(data.fare_breakdown);
    evidence.push(record('fare-001', 'trip', pick(fare, ['estimated', 'actual', 'delta', 'excess_distance_fare', 'excess_tolls', 'distance_rate_per_km'])));
    rows(data.traffic_conditions).forEach((item, i) => evidence.push(record(`traffic-${String(i + 1).padStart(3, '0')}`, 'app_event', pick(item, ['incident_id', 'road', 'direction', 'stretch', 'incident_type', 'severity', 'timestamp', 'clear_time', 'description']))));
    const actual = number(trip.actual_distance_km), recommended = number(trip.estimated_distance_km), rate = cents(fare.distance_rate_per_km);
    const actualMetres = actual === null ? null : Math.round(actual * 1000), recommendedMetres = recommended === null ? null : Math.round(recommended * 1000);
    const excess = actualMetres !== null && recommendedMetres !== null ? actualMetres - recommendedMetres : null;
    evidence.push(record('derived-ryde-v21-distance', 'derived_fact', {
      actualDistanceMetres: actualMetres, recommendedDistanceMetres: recommendedMetres, excessDistanceMetres: excess, excessDistanceKilometres: excess === null ? null : excess / 1000,
      distanceRateCentsPerKm: rate, excessDistanceFareCents: excess !== null && rate !== null ? Math.round(excess * rate / 1000) : null,
      calculation: '(actual kilometres - recommended kilometres) * distance rate; currency rounded to integer cents',
      sourceEvidenceIds: ['trip-001', 'fare-001'],
    }));
    const traffic = rows(data.traffic_conditions); const start = instant(string(trip.start_time));
    facts = { category: 'route', recommendedDistanceMetres: recommendedMetres, actualDistanceMetres: actualMetres, distanceRateCentsPerKm: rate,
      disputeValueCents: cents(number(trip.actual_fare) !== null && number(trip.estimated_fare) !== null ? (trip.actual_fare as number) - (trip.estimated_fare as number) : null),
      trafficJustified: traffic.some(item => ['vehicle_fire', 'heavy_congestion'].includes(String(item.incident_type)) && start !== null && instant(string(item.timestamp)) !== null && instant(string(item.timestamp))! <= start && (instant(string(item.clear_time)) ?? Infinity) >= start) ? true : null,
      notifiedAndAgreed: null, safetyRelated: hasSafetyEvidence(evidence), evidenceIds: [],
    };
  } else {
    const fare = row(data.fare_breakdown), quote = row(fare.upfront_quote), actual = row(fare.actual_fare), surge = row(data.surge_pricing_log);
    evidence.push(record('fare-001', 'trip', { upfront_quote: pick(quote, ['surge_multiplier', 'surge_amount', 'total', 'surgeable_subtotal']), actual_fare: pick(actual, ['surge_multiplier', 'surge_amount', 'total', 'surgeable_subtotal']) }));
    evidence.push(record('surge-001', 'app_event', pick(surge, ['quote_time_surge', 'trip_start_surge', 'surge_activated_at', 'rider_notified', 'notification_method', 'notification_timestamp'])));
    const quotedCents = cents(trip.upfront_quote), actualCents = cents(trip.actual_fare), quoteSubtotal = cents(quote.surgeable_subtotal), actualSubtotal = cents(actual.surgeable_subtotal), quoteMultiplier = number(surge.quote_time_surge), startMultiplier = number(surge.trip_start_surge);
    const diff = actualCents !== null && quotedCents !== null ? actualCents - quotedCents : null;
    const fixedQuote = quotedCents !== null && quoteSubtotal !== null && quoteMultiplier !== null ? quotedCents - Math.round(quoteSubtotal * quoteMultiplier) : null;
    const fixedActual = actualCents !== null && actualSubtotal !== null && startMultiplier !== null ? actualCents - Math.round(actualSubtotal * startMultiplier) : null;
    const solelySurge = diff !== null && quoteSubtotal !== null && actualSubtotal !== null && quoteMultiplier !== null && startMultiplier !== null && fixedQuote !== null && fixedActual !== null ?
      quoteSubtotal === actualSubtotal && fixedQuote === fixedActual &&
      cents(quote.total) === quotedCents && cents(actual.total) === actualCents &&
      number(quote.surge_multiplier) === quoteMultiplier && number(actual.surge_multiplier) === startMultiplier &&
      cents(quote.surge_amount) === Math.round(quoteSubtotal * (quoteMultiplier - 1)) &&
      cents(actual.surge_amount) === Math.round(actualSubtotal * (startMultiplier - 1)) &&
      diff === Math.round(quoteSubtotal * (startMultiplier - quoteMultiplier)) : null;
    evidence.push(record('derived-ryde-v21-surge', 'derived_fact', { quotedCents, actualCents, fareDifferenceCents: diff, quoteMultiplier, startMultiplier, quoteSurgeableSubtotalCents: quoteSubtotal, actualSurgeableSubtotalCents: actualSubtotal, fixedQuoteComponentsCents: fixedQuote, fixedActualComponentsCents: fixedActual, differenceSolelyFromSurgeChange: solelySurge, calculation: 'actual fare cents - quote cents; reconcile unchanged surgeable subtotal and unchanged fixed components', sourceEvidenceIds: ['trip-001', 'fare-001', 'surge-001'] }));
    facts = { category: 'surge', quotedCents, actualCents, quoteMultiplier, startMultiplier, solelySurgeDifference: solelySurge, notificationValid: bool(surge.rider_notified) === false ? false : null, riderProceeded: instant(string(trip.start_time)) !== null && instant(string(trip.end_time)) !== null ? true : null, disputeValueCents: diff, evidenceIds: [], safetyRelated: hasSafetyEvidence(evidence) };
  }
  facts.evidenceIds = evidence.map(item => item.id);
  return { snapshot: { caseId, evidence: derivedFactsFirst(evidence), policyRules: policyRulesFor(facts.category), policyProfile: profile }, assessment: evaluateReviewFacts(facts), calculatedFacts: facts, sourceNotes: [...sourceNotes] };
}
