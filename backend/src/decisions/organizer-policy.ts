import type { DecisionFact, Disposition } from './types.js';

export const ORGANIZER_NO_SHOW_POLICY = Object.freeze({
  profileId: 'organizer-disp002-v1',
  thresholdSeconds: 480,
  cancellationFeeMinor: 500,
  currency: 'SGD' as const,
});

export interface DeterministicOrganizerOutcome {
  disposition: Disposition;
  action: 'reverse_fee' | 'uphold_fee';
  amountMinor: number;
}

/** Pure code owns the threshold and monetary result; an LLM never calculates it. */
export function deriveOrganizerOutcome(fact: DecisionFact): DeterministicOrganizerOutcome | null {
  if (fact.status !== 'established' || !Number.isFinite(fact.value) || fact.value < 0) return null;

  if (fact.value >= ORGANIZER_NO_SHOW_POLICY.thresholdSeconds) {
    return {
      disposition: 'claim_rejected',
      action: 'uphold_fee',
      amountMinor: 0,
    };
  }

  return {
    disposition: 'claim_upheld',
    action: 'reverse_fee',
    amountMinor: ORGANIZER_NO_SHOW_POLICY.cancellationFeeMinor,
  };
}
