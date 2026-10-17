import type { DerivedFact } from '../schemas/derived-fact.js';

// ---------------------------------------------------------------------------
// Waiting duration calculator — deterministic.
//
// Computes the elapsed seconds between two ISO 8601 offset-aware timestamps.
// For the DISP-002 organizer profile, the wait anchor is the corroborated
// driver_wait_start (08:43:00+08:00) and the end is cancellation_time
// (08:51:00+08:00), producing exactly 480 seconds (SRS POL-05).
//
// This is a pure function with no side effects. The calculation is
// timezone-correct: both timestamps share the same +08:00 offset so there
// are no DST issues. We use Date.parse for epoch milliseconds, then convert
// the difference to whole seconds via Math.trunc to avoid float drift.
// ---------------------------------------------------------------------------

const CALCULATION_VERSION = '1.0.0';

/**
 * Parse an ISO 8601 string to epoch milliseconds.
 * Throws if the string is not a valid date.
 */
function parseToEpochMs(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid ISO 8601 timestamp: "${iso}"`);
  }
  return ms;
}

/**
 * Calculate the waiting duration between two ISO 8601 timestamps.
 *
 * @param waitStartIso - The wait anchor timestamp (e.g. driver_wait_start)
 * @param cancellationTimeIso - The cancellation timestamp
 * @param sourceEvidenceIds - Evidence item IDs that anchor this calculation
 * @param policyRuleIds - Policy rule IDs under which this calculation applies
 * @returns A DerivedFact with the elapsed seconds
 */
export function calculateWaitingDuration(
  waitStartIso: string,
  cancellationTimeIso: string,
  sourceEvidenceIds: string[],
  policyRuleIds: string[],
): DerivedFact {
  const startMs = parseToEpochMs(waitStartIso);
  const endMs = parseToEpochMs(cancellationTimeIso);

  const diffMs = endMs - startMs;
  const seconds = Math.trunc(diffMs / 1000);

  const warnings: string[] = [];
  if (seconds < 0) {
    warnings.push(`Negative duration: end (${cancellationTimeIso}) is before start (${waitStartIso}).`);
  }

  const status: DerivedFact['status'] =
    seconds < 0 ? 'uncertain' : 'established';

  return {
    id: 'derived_wait_duration',
    name: 'waiting_duration',
    value: seconds,
    unit: 'seconds',
    sourceEvidenceIds,
    calculationVersion: CALCULATION_VERSION,
    policyRuleIds,
    status,
    warnings,
  };
}

/**
 * Calculate the free-wait expiry timestamp (anchor + free_wait_seconds).
 * Returns a DerivedFact describing the expiry boundary.
 */
export function calculateFreeWaitExpiry(
  waitStartIso: string,
  freeWaitSeconds: number,
  sourceEvidenceIds: string[],
  policyRuleIds: string[],
): DerivedFact {
  const startMs = parseToEpochMs(waitStartIso);
  const expiryMs = startMs + freeWaitSeconds * 1000;
  const expiryIso = new Date(expiryMs).toISOString();

  return {
    id: 'derived_free_wait_expiry',
    name: 'free_wait_expiry',
    value: expiryIso,
    unit: 'iso8601',
    sourceEvidenceIds,
    calculationVersion: CALCULATION_VERSION,
    policyRuleIds,
    status: 'established',
    warnings: [],
  };
}
