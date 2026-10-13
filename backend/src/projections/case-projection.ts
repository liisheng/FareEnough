import type { Disp002Fixture } from '../schemas/fixture.js';
import type { CaseEvidenceResponse } from '../schemas/api.js';
import type { DerivedFact } from '../schemas/derived-fact.js';
import { calculateWaitingDuration } from '../calculations/waiting-duration.js';

// ---------------------------------------------------------------------------
// Safe case projection — transforms the raw fixture into a safe API response.
//
// Per SRS NFR-10 / ACC-04: rider and driver historical profiles (ratings,
// dispute history, fraud flags, account age, total trips, names, vehicle,
// payment method) are excluded from the adjudication / agent projection.
// Only pseudonymous rider_id / driver_id identifiers are retained.
//
// The projection also computes derived facts (waiting duration) and
// attaches the selected policy profile reference.
// ---------------------------------------------------------------------------

const POLICY_PROFILE_ID = 'organizer-disp002-v1';
const POLICY_PROFILE_VERSION = '1.0.0';

/**
 * Project a validated DISP-002 fixture into a safe case/evidence response.
 * Strips historical profile data and computes deterministic derived facts.
 */
export function projectCaseEvidence(fixture: Disp002Fixture): CaseEvidenceResponse {
  const { dispute_ticket, trip_data, gps_telemetry, chat_logs, app_events, cancellation_policy } = fixture;

  // Compute the waiting duration deterministically.
  // SRS POL-05: wait anchor = corroborated driver_wait_start (08:43:00+08:00).
  // cancellation_time = 08:51:00+08:00. Expected: 480 seconds.
  const waitDuration: DerivedFact = calculateWaitingDuration(
    trip_data.driver_wait_start,
    trip_data.cancellation_time,
    ['gps-005', 'gps-008', 'evt-004', 'evt-009'],
    ['ORG-NS-03', 'ORG-NS-04', 'ORG-NS-05'],
  );

  return {
    caseId: dispute_ticket.dispute_id,
    dispute: {
      disputeId: dispute_ticket.dispute_id,
      tripId: dispute_ticket.trip_id,
      filedBy: dispute_ticket.filed_by,
      disputeType: dispute_ticket.dispute_type,
      description: dispute_ticket.description,
      filedAt: dispute_ticket.filed_at,
      status: dispute_ticket.status,
    },
    trip: {
      tripId: trip_data.trip_id,
      riderId: trip_data.rider_id,
      driverId: trip_data.driver_id,
      pickupLocation: trip_data.pickup_location,
      dropoffLocation: trip_data.dropoff_location,
      scheduledTime: trip_data.scheduled_time,
      driverArrivalTime: trip_data.driver_arrival_time,
      driverWaitStart: trip_data.driver_wait_start,
      cancellationTime: trip_data.cancellation_time,
      cancellationFee: trip_data.cancellation_fee,
      cancellationReason: trip_data.cancellation_reason,
    },
    gpsTelemetry: gps_telemetry.map((p) => ({
      timestamp: p.timestamp,
      lat: p.lat,
      lng: p.lng,
      speedKmh: p.speed_kmh,
      status: p.status,
    })),
    chatLogs: chat_logs.map((c) => ({
      timestamp: c.timestamp,
      sender: c.sender,
      type: c.type,
      content: c.content,
    })),
    appEvents: app_events.map((e) => ({
      timestamp: e.timestamp,
      eventType: e.event_type,
      details: e.details,
    })),
    cancellationPolicy: {
      freeWaitTimeMin: cancellation_policy.free_wait_time_min,
      cancellationFeeAfterWait: cancellation_policy.cancellation_fee_after_wait,
      noShowThresholdMin: cancellation_policy.no_show_threshold_min,
      feeGoesTo: cancellation_policy.fee_goes_to,
    },
    derivedFacts: [waitDuration],
    policyProfile: {
      profileId: POLICY_PROFILE_ID,
      version: POLICY_PROFILE_VERSION,
    },
  };
}
