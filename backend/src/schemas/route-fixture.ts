import { z } from 'zod';

const Point = z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]);
const Route = z.object({ distance_meters: z.number().int().positive(), duration_seconds: z.number().int().positive(), points: z.array(Point).min(2) }).strict();

export const RouteFixtureSchema = z.object({
  fixture_id: z.literal('ROUTE-ERP-001'), synthetic: z.literal(true), service_type: z.literal('RydeX'),
  trip_id: z.string(), rider_id: z.string(), driver_id: z.string(), filed_at: z.string(),
  pickup: z.object({ name: z.string(), lat: z.number(), lng: z.number() }).strict(),
  dropoff: z.object({ name: z.string(), lat: z.number(), lng: z.number() }).strict(),
  reference_route: Route, actual_route: Route, route_context: z.string().min(1),
  quoted_fare_minor: z.number().int().nonnegative(), paid_fare_minor: z.number().int().nonnegative(),
  fare_lines: z.array(z.object({ id: z.string(), label: z.string(), amount_minor: z.number().int().nonnegative(), supported_minor: z.number().int().nonnegative() }).strict()).min(1),
  gantry_coverage: z.string().min(1), rider_consent: z.string().min(1), payment_id: z.string(), prior_relief_minor: z.number().int().nonnegative(),
}).strict();

export type RouteFixture = z.infer<typeof RouteFixtureSchema>;
