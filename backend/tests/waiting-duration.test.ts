import { describe, it, expect } from 'vitest';
import { calculateWaitingDuration, calculateFreeWaitExpiry } from '../src/calculations/waiting-duration.js';

describe('Waiting duration calculation', () => {
  const sourceIds = ['gps-005', 'gps-008', 'evt-004', 'evt-009'];
  const policyRuleIds = ['ORG-NS-03', 'ORG-NS-04', 'ORG-NS-05'];

  it('produces exactly 480 seconds from 08:43 to 08:51 under organizer profile', () => {
    const result = calculateWaitingDuration(
      '2026-09-13T08:43:00+08:00',
      '2026-09-13T08:51:00+08:00',
      sourceIds,
      policyRuleIds,
    );
    expect(result.value).toBe(480);
    expect(result.unit).toBe('seconds');
    expect(result.status).toBe('established');
    expect(result.warnings).toHaveLength(0);
  });

  it('returns a DerivedFact with correct metadata', () => {
    const result = calculateWaitingDuration(
      '2026-09-13T08:43:00+08:00',
      '2026-09-13T08:51:00+08:00',
      sourceIds,
      policyRuleIds,
    );
    expect(result.id).toBe('derived_wait_duration');
    expect(result.name).toBe('waiting_duration');
    expect(result.calculationVersion).toBe('1.0.0');
    expect(result.sourceEvidenceIds).toEqual(sourceIds);
    expect(result.policyRuleIds).toEqual(policyRuleIds);
  });

  it('produces 0 seconds when start equals end', () => {
    const result = calculateWaitingDuration(
      '2026-09-13T08:43:00+08:00',
      '2026-09-13T08:43:00+08:00',
      sourceIds,
      policyRuleIds,
    );
    expect(result.value).toBe(0);
    expect(result.status).toBe('established');
  });

  it('produces negative duration with uncertain status when end is before start', () => {
    const result = calculateWaitingDuration(
      '2026-09-13T08:51:00+08:00',
      '2026-09-13T08:43:00+08:00',
      sourceIds,
      policyRuleIds,
    );
    expect(result.value).toBe(-480);
    expect(result.status).toBe('uncertain');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('produces 360 seconds from 08:43 to 08:49 (alternative anchor)', () => {
    const result = calculateWaitingDuration(
      '2026-09-13T08:43:00+08:00',
      '2026-09-13T08:49:00+08:00',
      sourceIds,
      policyRuleIds,
    );
    expect(result.value).toBe(360);
  });

  it('produces 470 seconds from 08:43:10 to 08:51:00 (timer-event anchor)', () => {
    const result = calculateWaitingDuration(
      '2026-09-13T08:43:10+08:00',
      '2026-09-13T08:51:00+08:00',
      sourceIds,
      policyRuleIds,
    );
    expect(result.value).toBe(470);
  });

  it('produces 300 seconds from 08:43 to 08:48 (free wait period)', () => {
    const result = calculateWaitingDuration(
      '2026-09-13T08:43:00+08:00',
      '2026-09-13T08:48:00+08:00',
      sourceIds,
      policyRuleIds,
    );
    expect(result.value).toBe(300);
  });

  it('handles UTC timestamps correctly', () => {
    const result = calculateWaitingDuration(
      '2026-09-13T00:43:00Z',
      '2026-09-13T00:51:00Z',
      sourceIds,
      policyRuleIds,
    );
    expect(result.value).toBe(480);
  });

  it('throws on invalid timestamp', () => {
    expect(() =>
      calculateWaitingDuration('not-a-date', '2026-09-13T08:51:00+08:00', sourceIds, policyRuleIds),
    ).toThrow(/Invalid ISO 8601/);
  });
});

describe('Free wait expiry calculation', () => {
  const sourceIds = ['evt-006'];
  const policyRuleIds = ['ORG-NS-02'];

  it('computes free-wait expiry as anchor + 300 seconds', () => {
    const result = calculateFreeWaitExpiry(
      '2026-09-13T08:43:00+08:00',
      300,
      sourceIds,
      policyRuleIds,
    );
    expect(result.id).toBe('derived_free_wait_expiry');
    expect(result.unit).toBe('iso8601');
    expect(result.status).toBe('established');
    const expiryMs = Date.parse(result.value as string);
    const expectedMs = Date.parse('2026-09-13T08:48:00+08:00');
    expect(expiryMs).toBe(expectedMs);
  });
});
