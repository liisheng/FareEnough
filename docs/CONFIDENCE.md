# Deterministic confidence gate

Automatic decisions require a backend-calculated score **at least 0.85**, plus every independent mandatory policy, evidence, citation, output and finalization check. Exactly 0.85 qualifies; a high score cannot override a review request, missing calibrated confidence, safety restriction or inconsistent financial proposal.

The SRS rubric is unchanged: `0.35 * completeness + 0.30 * corroboration + 0.25 * policyCoverage + 0.10 * citationValidity`. Rubric version `1` identifies those weights; assessment version `evidence-checklist-v1` identifies the new evidence-based checklist. This is a disclosed engineering support score, not a calibrated probability of model correctness.

## Assessment

`backend/src/decisions/evidence-confidence.ts` reads the backend's case-scoped evidence snapshot, not an agent's self-reported confidence. It records each check's outcome, reason and evidence IDs.

- Organizer no-show: established duration must reconcile with the selected clock; GPS records must cover the wait anchor and cancellation and agree with pickup; contact evidence and calculation sources must exist. The named organizer interpretation resolves the known timer discrepancy. An established calculation with a nonmaterial warning reduces corroboration to 0.5, giving 0.85 when all other components pass.
- Synthetic route/ERP: reference and actual routes, verified consent, complete gantry coverage, RydeX service, SGD receipt/quote/ERP reconciliation, remaining relief and calculation sources are checked.
- v2.1: category-specific derived facts and provenance are checked. No-show timing, recorded pickup samples, deduplicated contact counts and fee are reconciled against source records. Surge fare/quote/multiplier/fixed components reconcile against the receipt records. Route distances must reconcile; the existing route/calibration policy gates remain independent.
- All profiles: unique case evidence, required policy rules and validated citations are required. Missing snapshots fail closed. Legacy validation also checks snapshot case/profile and decision-fact consistency.

The checklist is conservative: incomplete required evidence groups go to review. It does not implement general semantic verification of every narrative, independently verify external telemetry, or certify continuous physical presence between GPS samples. Only the supported profiles have checklists. The public-policy eligibility gaps in the SRS coverage report remain outstanding.

## Persistence and display

New decisions save the score, threshold, components, checklist and explanations in `decisions.confidence_json`; the source snapshot is retained with the run checkpoint. Support audit/export and saved workspace outcomes retain the assessment. The confidence panel explains the threshold and reasons. Persistence rejects a validated decision that fails the confidence gate.

Migration `009-decision-confidence.sql` adds a nullable column. Historical decisions remain unchanged and have no invented retrospective checklist. Restart the backend to load the new code and apply the migration; existing completed decisions are not re-adjudicated.

## Calibration and tests

The v2.1 `calibratedConfidence >= 0.80` restriction is separate. The rubric score is never supplied as calibrated confidence. Cases requiring calibration still go to human review without an independently calibrated score.

`confidence-gate.test.ts` covers below/at/above 0.85, invalid numbers, high-score hard failures, missing/contradictory source data, profile isolation and preservation of v2.1 calibration gates. Persistence, API audit and frontend tests cover storage and presentation. Run `npm run test:srs`; these checks do not call live AI services.
