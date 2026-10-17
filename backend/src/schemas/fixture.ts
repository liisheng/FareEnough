import { z } from 'zod';

// ---------------------------------------------------------------------------
// DISP-002 fixture schemas — mirror the JSON evidence blocks from the
// organizer sample dataset. These validate the fixture at load time.
// ---------------------------------------------------------------------------

export const DisputeTicketSchema = z.object({
  dispute_id: z.string(),
  trip_id: z.string(),
  filed_by: z.enum(['rider', 'driver']),
  dispute_type: z.string(),
  description: z.string().min(1),
  filed_at: z.string().min(1),
  status: z.string().min(1),
});

export const RiderProfileSchema = z.object({
  rider_id: z.string(),
  name: z.string(),
  account_age_days: z.number().int().nonnegative(),
  total_trips: z.number().int().nonnegative(),
  avg_rating: z.number(),
  dispute_history: z.object({
    total_disputes: z.number().int().nonnegative(),
    upheld: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
  }),
  fraud_flags: z.number().int().nonnegative(),
  fraud_flag_details: z.string().nullable(),
  payment_method: z.string(),
});

export const DriverProfileSchema = z.object({
  driver_id: z.string(),
  name: z.string(),
  account_age_days: z.number().int().nonnegative(),
  total_trips: z.number().int().nonnegative(),
  avg_rating: z.number(),
  dispute_history: z.object({
    total_disputes: z.number().int().nonnegative(),
    upheld_against: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
  }),
  fraud_flags: z.number().int().nonnegative(),
  vehicle: z.string(),
});

export const LocationSchema = z.object({
  name: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const TripDataSchema = z.object({
  trip_id: z.string(),
  rider_id: z.string(),
  driver_id: z.string(),
  pickup_location: LocationSchema,
  dropoff_location: LocationSchema,
  scheduled_time: z.string().min(1),
  driver_arrival_time: z.string().min(1),
  driver_wait_start: z.string().min(1),
  cancellation_time: z.string().min(1),
  cancellation_fee: z.number().nonnegative(),
  cancellation_reason: z.string(),
});

export const GpsPointSchema = z.object({
  timestamp: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speed_kmh: z.number().nonnegative(),
  status: z.string(),
});

export const ChatLogSchema = z.object({
  timestamp: z.string().min(1),
  sender: z.enum(['rider', 'driver', 'system']),
  type: z.string(),
  content: z.string(),
});

export const AppEventSchema = z.object({
  timestamp: z.string().min(1),
  event_type: z.string(),
  details: z.string(),
});

export const CancellationPolicySchema = z.object({
  free_wait_time_min: z.number().positive(),
  cancellation_fee_after_wait: z.number().nonnegative(),
  no_show_threshold_min: z.number().positive(),
  fee_goes_to: z.string(),
});

export const Disp002FixtureSchema = z.object({
  dispute_ticket: DisputeTicketSchema,
  rider_profile: RiderProfileSchema,
  driver_profile: DriverProfileSchema,
  trip_data: TripDataSchema,
  gps_telemetry: z.array(GpsPointSchema),
  chat_logs: z.array(ChatLogSchema),
  app_events: z.array(AppEventSchema),
  cancellation_policy: CancellationPolicySchema,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DisputeTicket = z.infer<typeof DisputeTicketSchema>;
export type RiderProfile = z.infer<typeof RiderProfileSchema>;
export type DriverProfile = z.infer<typeof DriverProfileSchema>;
export type TripData = z.infer<typeof TripDataSchema>;
export type GpsPoint = z.infer<typeof GpsPointSchema>;
export type ChatLog = z.infer<typeof ChatLogSchema>;
export type AppEvent = z.infer<typeof AppEventSchema>;
export type CancellationPolicy = z.infer<typeof CancellationPolicySchema>;
export type Disp002Fixture = z.infer<typeof Disp002FixtureSchema>;
