import { describe, it, expect, beforeEach } from 'vitest';
import { Disp002FixtureSchema } from '../src/schemas/fixture.js';
import { loadDisp002Fixture, resetFixtureCache } from '../src/fixtures/loader.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURE_PATH = resolve(__dirname, '../../data/fixtures/disp-002.json');

describe('DISP-002 fixture validation', () => {
  beforeEach(() => {
    resetFixtureCache();
  });

  it('parses the fixture file without error', () => {
    const raw = readFileSync(FIXTURE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    const result = Disp002FixtureSchema.safeParse(parsed);
    expect(result.success).toBe(true);
  });

  it('loads via the fixture loader', () => {
    const fixture = loadDisp002Fixture();
    expect(fixture.dispute_ticket.dispute_id).toBe('DISP-002');
    expect(fixture.trip_data.trip_id).toBe('TRIP-2026-09945');
  });

  it('has the correct dispute type', () => {
    const fixture = loadDisp002Fixture();
    expect(fixture.dispute_ticket.dispute_type).toBe('no_show_charge');
    expect(fixture.dispute_ticket.filed_by).toBe('rider');
  });

  it('has 8 GPS telemetry points', () => {
    const fixture = loadDisp002Fixture();
    expect(fixture.gps_telemetry).toHaveLength(8);
  });

  it('has 6 chat logs', () => {
    const fixture = loadDisp002Fixture();
    expect(fixture.chat_logs).toHaveLength(6);
  });

  it('has 10 app events', () => {
    const fixture = loadDisp002Fixture();
    expect(fixture.app_events).toHaveLength(10);
  });

  it('GPS telemetry is chronologically ordered', () => {
    const fixture = loadDisp002Fixture();
    const timestamps = fixture.gps_telemetry.map((p) => Date.parse(p.timestamp));
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
    }
  });

  it('has correct driver wait start and cancellation time', () => {
    const fixture = loadDisp002Fixture();
    expect(fixture.trip_data.driver_wait_start).toBe('2026-09-13T08:43:00+08:00');
    expect(fixture.trip_data.cancellation_time).toBe('2026-09-13T08:51:00+08:00');
  });

  it('has cancellation policy with 5 min free wait and 8 min threshold', () => {
    const fixture = loadDisp002Fixture();
    expect(fixture.cancellation_policy.free_wait_time_min).toBe(5);
    expect(fixture.cancellation_policy.no_show_threshold_min).toBe(8);
  });

  it('rejects a fixture missing required fields', () => {
    const bad = { dispute_ticket: { dispute_id: 'X' } };
    const result = Disp002FixtureSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects GPS points with out-of-range lat/lng', () => {
    const raw = readFileSync(FIXTURE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    parsed.gps_telemetry[0].lat = 999;
    const result = Disp002FixtureSchema.safeParse(parsed);
    expect(result.success).toBe(false);
  });
});
