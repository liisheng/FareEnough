# Validated checkpoint and latest UI integration — 16 October 2026

The checkpoint at `d0de2a5` was pushed as `feat/validated-adp-checkpoint` and merged into `ui-enhancement`, whose previous tip was `a7556d0`. That UI branch already contains `integration-harry` at `4206b0f`. The merge preserves the upstream frontend files and locked dependencies without edits.

## Integration decisions

- Preserve all three checkpoint prompt files exactly. Only the synthetic `demo-route-erp-v1` Judge request receives an additional output-contract instruction for `refund_unsupported_charge`; it includes no expected amount or decision. Other profiles retain their original prompts and three-outcome response contract.
- Reject the synthetic route outcome outside that profile in both orchestration and deterministic validation. Preserve selected route policy citations when human review is requested.
- Apply the configured v2.1 no-show adapter only to organizer no-show evidence. The interactive synthetic route/ERP case keeps its separate policy and adjustment calculation.
- Add the UI decision-contract fields to v2.1 validation results, and show the saved run's policy and citations in party explanations.
- Retain request limits, route functionality, guided evidence review, responsive queues and motion from the UI branch.

## Verification

| Check | Result |
| --- | --- |
| Backend build | Passed |
| Backend automated tests | 294/294 passed |
| Frontend automated checks | 17/17 passed |
| Desktop and mobile browser journeys | 2/2 passed |
| Offline v2.1 policy expectations | 3/3 matched |
| Historical regression inventory | All 12 retained |
| Checkpoint prompt contents | All 3 identical |
| Regression input strings and expected assertions | All 12 identical |
| Sample model-input snapshots and independent assessments | All 3 identical |

The browser journeys use controlled responses with an in-memory database. No external model calls or financial actions were performed for this integration. The prior live 12/12 regression and 3/3 final-decision result remains documented in [the restoration report](../live-reports/restored-checkpoint-2026-10-16.md); it is not a fresh live result for changed ADP settings. Known intermediate advocate reasoning defects remain. Some UI evidence-story text is specific to the seeded demo fixtures, rather than a general presentation of arbitrary disputes.

Commands used: `npm run build`, `npm test`, `npm run test:frontend`, `npx playwright test`, `node backend/scripts/evaluate-policy-fixtures.mjs`, and `node backend/scripts/evaluate-prompt-regressions.mjs`. An additional read-only comparison checked the prompts, regression inputs/assertions, and sample snapshots/assessments against the saved passing reports.
