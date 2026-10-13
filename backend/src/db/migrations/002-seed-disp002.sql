-- 002-seed-disp002.sql — seed DISP-002 case, evidence items, and policy bundle
-- Uses INSERT OR IGNORE for idempotency (safe to re-run)

INSERT OR IGNORE INTO cases (
  case_id, trip_id, filed_by, dispute_type, description, filed_at,
  status, policy_profile_id, policy_profile_version, fixture_path
) VALUES (
  'DISP-002',
  'TRIP-2026-09945',
  'rider',
  'no_show_charge',
  'I was at the pickup point at Tiong Bahru Plaza on time but the driver never showed up. I waited 10 minutes at the lobby and could not find the car. The app charged me a $5.00 cancellation fee for a ''no-show'' which is completely unfair — I was there, the driver was not. I want the charge reversed immediately.',
  '2026-09-13T09:20:00+08:00',
  'open',
  'organizer-disp002-v1',
  '1.0.0',
  'data/fixtures/disp-002.json'
);

INSERT OR IGNORE INTO policy_bundles (
  profile_id, version, source_register, retrieval_date, applicable_services, payload
) VALUES (
  'organizer-disp002-v1',
  '1.0.0',
  'SRC-D1',
  '2026-10-07',
  '["ride-hailing"]',
  '{"currency":"SGD","free_wait_seconds":300,"no_show_threshold_seconds":480,"cancellation_fee_minor":500}'
);

-- Evidence items: GPS telemetry
INSERT OR IGNORE INTO evidence_items (id, case_id, source_kind, original_timestamp, provenance, payload)
VALUES ('gps-001', 'DISP-002', 'gps_telemetry', '2026-09-13T08:31:00+08:00', 'organizer_fixture', '{"lat":1.2920,"lng":103.8450,"speed_kmh":42,"status":"en_route"}');
INSERT OR IGNORE INTO evidence_items (id, case_id, source_kind, original_timestamp, provenance, payload)
VALUES ('gps-002', 'DISP-002', 'gps_telemetry', '2026-09-13T08:34:00+08:00', 'organizer_fixture', '{"lat":1.2890,"lng":103.8430,"speed_kmh":38,"status":"en_route"}');
INSERT OR IGNORE INTO evidence_items (id, case_id, source_kind, original_timestamp, provenance, payload)
VALUES ('gps-003', 'DISP-002', 'gps_telemetry', '2026-09-13T08:38:00+08:00', 'organizer_fixture', '{"lat":1.2865,"lng":103.8400,"speed_kmh":25,"status":"en_route"}');
INSERT OR IGNORE INTO evidence_items (id, case_id, source_kind, original_timestamp, provenance, payload)
VALUES ('gps-004', 'DISP-002', 'gps_telemetry', '2026-09-13T08:41:00+08:00', 'organizer_fixture', '{"lat":1.2852,"lng":103.8388,"speed_kmh":12,"status":"en_route"}');
INSERT OR IGNORE INTO evidence_items (id, case_id, source_kind, original_timestamp, provenance, payload)
VALUES ('gps-005', 'DISP-002', 'gps_telemetry', '2026-09-13T08:43:00+08:00', 'organizer_fixture', '{"lat":1.2847,"lng":103.8382,"speed_kmh":0,"status":"arrived"}');
INSERT OR IGNORE INTO evidence_items (id, case_id, source_kind, original_timestamp, provenance, payload)
VALUES ('gps-006', 'DISP-002', 'gps_telemetry', '2026-09-13T08:45:00+08:00', 'organizer_fixture', '{"lat":1.2847,"lng":103.8382,"speed_kmh":0,"status":"waiting"}');
INSERT OR IGNORE INTO evidence_items (id, case_id, source_kind, original_timestamp, provenance, payload)
VALUES ('gps-007', 'DISP-002', 'gps_telemetry', '2026-09-13T08:48:00+08:00', 'organizer_fixture', '{"lat":1.2847,"lng":103.8382,"speed_kmh":0,"status":"waiting"}');
INSERT OR IGNORE INTO evidence_items (id, case_id, source_kind, original_timestamp, provenance, payload)
VALUES ('gps-008', 'DISP-002', 'gps_telemetry', '2026-09-13T08:51:00+08:00', 'organizer_fixture', '{"lat":1.2847,"lng":103.8382,"speed_kmh":0,"status":"cancelled"}');

-- Evidence items: Chat logs
INSERT OR IGNORE INTO evidence_items (id, case_id, source_kind, original_timestamp, provenance, payload)
VALUES ('chat-001', 'DISP-002', 'chat_log', '2026-09-13T08:43:00+08:00', 'organizer_fixture', '{"sender":"driver","type":"message","content":"I''ve arrived at the pickup point, I''m at the lobby area."}');
INSERT OR IGNORE INTO evidence_items (id, case_id, source_kind, original_timestamp, provenance, payload)
VALUES ('chat-002', 'DISP-002', 'chat_log', '2026-09-13T08:45:20+08:00', 'organizer_fixture', '{"sender":"driver","type":"message","content":"I''m waiting at the lobby area, white Honda HR-V plate SGP 4521 M."}');
INSERT OR IGNORE INTO evidence_items (id, case_id, source_kind, original_timestamp, provenance, payload)
VALUES ('chat-003', 'DISP-002', 'chat_log', '2026-09-13T08:47:05+08:00', 'organizer_fixture', '{"sender":"driver","type":"call","content":"Outgoing call to rider — not answered (rang 22s, no response)."}');
INSERT OR IGNORE INTO evidence_items (id, case_id, source_kind, original_timestamp, provenance, payload)
VALUES ('chat-004', 'DISP-002', 'chat_log', '2026-09-13T08:49:30+08:00', 'organizer_fixture', '{"sender":"driver","type":"message","content":"Hi, are you coming down? I''ve been waiting a while."}');
INSERT OR IGNORE INTO evidence_items (id, case_id, source_kind, original_timestamp, provenance, payload)
VALUES ('chat-005', 'DISP-002', 'chat_log', '2026-09-13T08:50:45+08:00', 'organizer_fixture', '{"sender":"driver","type":"message","content":"Please let me know, otherwise I''ll have to cancel the trip."}');
INSERT OR IGNORE INTO evidence_items (id, case_id, source_kind, original_timestamp, provenance, payload)
VALUES ('chat-006', 'DISP-002', 'chat_log', '2026-09-13T08:51:00+08:00', 'organizer_fixture', '{"sender":"system","type":"system","content":"Trip cancelled by driver. Reason: rider_no_show. Cancellation fee of $5.00 applied."}');

-- Evidence items: App events
INSERT OR IGNORE INTO evidence_items (id, case_id, source_kind, original_timestamp, provenance, payload)
VALUES ('evt-001', 'DISP-002', 'app_event', '2026-09-13T08:30:00+08:00', 'organizer_fixture', '{"event_type":"booking_confirmed","details":"Rider R-7823 booked trip TRIP-2026-09945 from Tiong Bahru Plaza to VivoCity. Scheduled pickup 08:45."}');
INSERT OR IGNORE INTO evidence_items (id, case_id, source_kind, original_timestamp, provenance, payload)
VALUES ('evt-002', 'DISP-002', 'app_event', '2026-09-13T08:30:15+08:00', 'organizer_fixture', '{"event_type":"driver_assigned","details":"Driver D-2398 (Lim Wei Ming, Honda HR-V SGP 4521 M) assigned. ETA 13 min."}');
INSERT OR IGNORE INTO evidence_items (id, case_id, source_kind, original_timestamp, provenance, payload)
VALUES ('evt-003', 'DISP-002', 'app_event', '2026-09-13T08:30:20+08:00', 'organizer_fixture', '{"event_type":"driver_en_route","details":"Driver started navigating to pickup location. Live tracking enabled."}');
INSERT OR IGNORE INTO evidence_items (id, case_id, source_kind, original_timestamp, provenance, payload)
VALUES ('evt-004', 'DISP-002', 'app_event', '2026-09-13T08:43:00+08:00', 'organizer_fixture', '{"event_type":"driver_arrived","details":"Driver GPS within 10m of pickup point. Speed 0 km/h. Auto-arrival confirmed."}');
INSERT OR IGNORE INTO evidence_items (id, case_id, source_kind, original_timestamp, provenance, payload)
VALUES ('evt-005', 'DISP-002', 'app_event', '2026-09-13T08:43:05+08:00', 'organizer_fixture', '{"event_type":"rider_notified","details":"Push notification + in-app alert sent to rider: ''Your driver has arrived.''}');
INSERT OR IGNORE INTO evidence_items (id, case_id, source_kind, original_timestamp, provenance, payload)
VALUES ('evt-006', 'DISP-002', 'app_event', '2026-09-13T08:43:10+08:00', 'organizer_fixture', '{"event_type":"wait_timer_started","details":"Free wait timer started. 5 min free wait period ends at 08:48."}');
INSERT OR IGNORE INTO evidence_items (id, case_id, source_kind, original_timestamp, provenance, payload)
VALUES ('evt-007', 'DISP-002', 'app_event', '2026-09-13T08:47:05+08:00', 'organizer_fixture', '{"event_type":"driver_called_rider","details":"Driver initiated in-app call to rider. Call rang 22s, no answer."}');
INSERT OR IGNORE INTO evidence_items (id, case_id, source_kind, original_timestamp, provenance, payload)
VALUES ('evt-008', 'DISP-002', 'app_event', '2026-09-13T08:48:10+08:00', 'organizer_fixture', '{"event_type":"wait_timer_expired","details":"Free 5-min wait period expired. Rider had not boarded. Cancellation fee now applicable per policy."}');
INSERT OR IGNORE INTO evidence_items (id, case_id, source_kind, original_timestamp, provenance, payload)
VALUES ('evt-009', 'DISP-002', 'app_event', '2026-09-13T08:51:00+08:00', 'organizer_fixture', '{"event_type":"cancellation_fee_applied","details":"No-show threshold (8 min) reached. $5.00 cancellation fee charged to rider payment method (e-wallet)."}');
INSERT OR IGNORE INTO evidence_items (id, case_id, source_kind, original_timestamp, provenance, payload)
VALUES ('evt-010', 'DISP-002', 'app_event', '2026-09-13T08:51:05+08:00', 'organizer_fixture', '{"event_type":"driver_released","details":"Driver D-2398 released from trip. Trip status: cancelled (rider_no_show)."}');
