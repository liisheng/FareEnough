-- Independent test scenarios using the organizer fixture, never real trip IDs.
CREATE TABLE demo_trips (
  trip_reference TEXT PRIMARY KEY,
  rider_id TEXT NOT NULL,
  source_trip_id TEXT NOT NULL,
  request_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(rider_id, request_key)
);
