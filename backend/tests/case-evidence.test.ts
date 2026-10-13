import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { healthRoutes } from '../src/routes/health.js';
import { caseRoutes } from '../src/routes/cases.js';
import { setTestDb, closeDb } from '../src/db/connection.js';
import { runMigrations } from '../src/db/migrate.js';
import { resetFixtureCache } from '../src/fixtures/loader.js';
import Database from 'better-sqlite3';

describe('GET /api/cases/:id/evidence', () => {
  let app: any;

  beforeAll(async () => {
    const db = new Database(':memory:');
    runMigrations(db);
    setTestDb(db);
    resetFixtureCache();
    app = Fastify({ logger: false });
    await app.register(healthRoutes);
    await app.register(caseRoutes);
    await app.ready();
  });

  afterAll(async () => {
    closeDb();
    await app.close();
  });

  it('returns 200 for DISP-002', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/cases/DISP-002/evidence',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.caseId).toBe('DISP-002');
  });

  it('returns trip data with correct fields', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/cases/DISP-002/evidence',
    });

    const body = JSON.parse(response.body);
    expect(body.trip.tripId).toBe('TRIP-2026-09945');
    expect(body.trip.riderId).toBe('R-7823');
    expect(body.trip.driverId).toBe('D-2398');
    expect(body.trip.pickupLocation.name).toBe('Tiong Bahru Plaza');
    expect(body.trip.dropoffLocation.name).toBe('VivoCity');
    expect(body.trip.driverWaitStart).toBe('2026-09-13T08:43:00+08:00');
    expect(body.trip.cancellationTime).toBe('2026-09-13T08:51:00+08:00');
  });

  it('returns GPS telemetry with 8 points', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/cases/DISP-002/evidence',
    });

    const body = JSON.parse(response.body);
    expect(body.gpsTelemetry).toHaveLength(8);
    expect(body.gpsTelemetry[4].status).toBe('arrived');
    expect(body.gpsTelemetry[7].status).toBe('cancelled');
  });

  it('returns chat logs with 6 entries', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/cases/DISP-002/evidence',
    });

    const body = JSON.parse(response.body);
    expect(body.chatLogs).toHaveLength(6);
  });

  it('returns app events with 10 entries', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/cases/DISP-002/evidence',
    });

    const body = JSON.parse(response.body);
    expect(body.appEvents).toHaveLength(10);
  });

  it('returns cancellation policy', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/cases/DISP-002/evidence',
    });

    const body = JSON.parse(response.body);
    expect(body.cancellationPolicy.freeWaitTimeMin).toBe(5);
    expect(body.cancellationPolicy.noShowThresholdMin).toBe(8);
    expect(body.cancellationPolicy.feeGoesTo).toBe('driver_compensation');
  });

  it('returns derived facts with 480-second waiting duration', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/cases/DISP-002/evidence',
    });

    const body = JSON.parse(response.body);
    expect(body.derivedFacts).toHaveLength(1);
    expect(body.derivedFacts[0].id).toBe('derived_wait_duration');
    expect(body.derivedFacts[0].value).toBe(480);
    expect(body.derivedFacts[0].unit).toBe('seconds');
    expect(body.derivedFacts[0].status).toBe('established');
  });

  it('returns policy profile reference', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/cases/DISP-002/evidence',
    });

    const body = JSON.parse(response.body);
    expect(body.policyProfile.profileId).toBe('organizer-disp002-v1');
    expect(body.policyProfile.version).toBe('1.0.0');
  });

  it('does NOT expose structured historical profile fields', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/cases/DISP-002/evidence',
    });

    const serialized = response.body;
    expect(serialized).not.toContain('avg_rating');
    expect(serialized).not.toContain('dispute_history');
    expect(serialized).not.toContain('fraud_flags');
    expect(serialized).not.toContain('fraud_flag_details');
    expect(serialized).not.toContain('account_age_days');
    expect(serialized).not.toContain('total_trips');
    expect(serialized).not.toContain('payment_method');
    expect(serialized).not.toContain('rider_profile');
    expect(serialized).not.toContain('driver_profile');
  });

  it('returns 404 for unknown case', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/cases/UNKNOWN-CASE/evidence',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Case not found');
  });
});
