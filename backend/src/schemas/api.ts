import { z } from 'zod';
import { DerivedFactSchema } from './derived-fact.js';

// ---------------------------------------------------------------------------
// API response schemas — validate every response boundary.
// Safe projections deliberately omit historical profile fields.
// ---------------------------------------------------------------------------

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  database: z.boolean(),
  provider: z.boolean(),
  timestamp: z.string(),
});

export const SafeLocationSchema = z.object({
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
});

export const SafeTripDataSchema = z.object({
  tripId: z.string(),
  riderId: z.string(),
  driverId: z.string(),
  pickupLocation: SafeLocationSchema,
  dropoffLocation: SafeLocationSchema,
  scheduledTime: z.string(),
  driverArrivalTime: z.string(),
  driverWaitStart: z.string(),
  cancellationTime: z.string(),
  cancellationFee: z.number(),
  cancellationReason: z.string(),
});

export const SafeGpsPointSchema = z.object({
  timestamp: z.string(),
  lat: z.number(),
  lng: z.number(),
  speedKmh: z.number(),
  status: z.string(),
});

export const SafeChatLogSchema = z.object({
  timestamp: z.string(),
  sender: z.string(),
  type: z.string(),
  content: z.string(),
});

export const SafeAppEventSchema = z.object({
  timestamp: z.string(),
  eventType: z.string(),
  details: z.string(),
});

export const SafeCancellationPolicySchema = z.object({
  freeWaitTimeMin: z.number(),
  cancellationFeeAfterWait: z.number(),
  noShowThresholdMin: z.number(),
  feeGoesTo: z.string(),
});

export const PolicyProfileRefSchema = z.object({
  profileId: z.string(),
  version: z.string(),
});

export const CaseEvidenceResponseSchema = z.object({
  caseId: z.string(),
  dispute: z.object({
    disputeId: z.string(),
    tripId: z.string(),
    filedBy: z.string(),
    disputeType: z.string(),
    description: z.string(),
    filedAt: z.string(),
    status: z.string(),
  }),
  trip: SafeTripDataSchema,
  gpsTelemetry: z.array(SafeGpsPointSchema),
  chatLogs: z.array(SafeChatLogSchema),
  appEvents: z.array(SafeAppEventSchema),
  cancellationPolicy: SafeCancellationPolicySchema,
  derivedFacts: z.array(DerivedFactSchema),
  policyProfile: PolicyProfileRefSchema,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type CaseEvidenceResponse = z.infer<typeof CaseEvidenceResponseSchema>;
export type SafeTripData = z.infer<typeof SafeTripDataSchema>;
