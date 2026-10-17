# SRS acceptance test coverage

Run `npm run test:srs` from the project root (PowerShell with restricted execution policy: `npm.cmd run test:srs`). It builds and runs all backend, frontend and browser checks. The runner sets `NODE_ENV=test`, removes agent keys from child environments, and uses isolated test databases and controlled providers. It does not call Tencent or modify the running demo's database. Browser tests use Edge locally and Playwright Chromium in CI, following `playwright.config.mjs`.

Run only the new checks with `npm run test --workspace backend -- tests/srs-acceptance.test.ts`.

The source is SRS section 16, AT-01 through AT-41. Tests with SRS IDs are in `backend/tests/srs-acceptance.test.ts`; existing integration and browser suites supply additional coverage below. **A passing automated run does not mean all 41 acceptance scenarios or the live-model release gate are satisfied.** Partial coverage and unimplemented behavior are deliberately identified instead of represented by placeholder passing tests.

Paths below are relative to `backend/tests/` unless stated otherwise.

| SRS ID | Automated evidence | Remaining acceptance scope |
| --- | --- | --- |
| AT-01 | `srs-acceptance`, `run-route`, `workspace` | Visual assessment of both explanations and clock discrepancy disclosure |
| AT-02 | `srs-acceptance`, `decision-validator` | Synthetic cancellation shifts GPS/event/chat timestamps consistently; calculation and validation covered, full variant UI journey not covered |
| AT-03 | `srs-acceptance`, `run-persistence` | Inclusive boundary and action-free zero adjustment covered |
| AT-04 | `public-policy`, `decision-contract` | Only policy metadata and voucher contract covered; public 180-second eligibility and voucher execution need implementation/tests |
| AT-05 | `public-policy` | Public 181-second adjudication path not covered |
| AT-06 | `ryde-v21` | Selected v2.1 pickup conflicts covered; complete public-profile wrong-pickup/remedy scenario remains |
| AT-07 | `decision-validator`, `ryde-v21` | Uncertain facts covered; legacy projection does not establish missing-location quality automatically |
| AT-08 | None for complete scenario | Public early-arrival clock interpretation and review gate remain |
| AT-09 | `public-policy`, `policy-validator`, `agent-run-coordinator` | Profile/citation isolation covered; same incident adjudicated under public and organizer profiles remains |
| AT-10 | None for complete scenario | Public filing-time eligibility at and beyond 30 days remains |
| AT-11 | None for complete scenario | Cross-log contact deduplication with linked provenance remains |
| AT-12 | `ryde-v21` | v2.1 missing-contact gates covered; public long-gap scenario remains |
| AT-13 | `srs-acceptance`, `route-erp` | Deterministic agreed/closure cases covered; live Judge reasoning still needs evaluation |
| AT-14 | `srs-acceptance`, `route-erp`, `workspace`; mobile browser journey | Synthetic 325-cent refund and 1800-cent supported total covered |
| AT-15 | `srs-acceptance`, `route-erp` | Unresolved route produces review and zero adjustment at calculation boundary |
| AT-16 | `srs-acceptance`, `route-erp` | Explicit incompleteness flags covered; automatic telemetry quality classification remains |
| AT-17 | None for complete scenario | Accepted destination edits and revised-quote assessment remain |
| AT-18 | `srs-acceptance` | Valid expense with unresolved route still requires review at calculation boundary |
| AT-19 | `srs-acceptance`, `route-erp` | Metered/carpool services blocked at fixed-fare calculation boundary |
| AT-20 | `srs-acceptance`, `answer-key-leakage` | Profile counterfactual compares five outbound prompt/evidence inputs and controlled final output; live model repetition and arbitrary identities embedded in narrative remain |
| AT-21 | `srs-acceptance` | Injection remains evidence and does not replace policy/system prompts; live model injection resistance is not established |
| AT-22 | `agent-run-coordinator`, `policy-validator`, `decision-validator` | Unknown and cross-profile references rejected; semantic validity of existing IDs needs live review |
| AT-23 | `policy-evaluation-checks`, `policy-review-artifact` | Evaluation checks exist; full source-grounded review of invented claims remains a live/manual gate |
| AT-24 | `agent-run-coordinator` | Opposing briefs/rebuttals reach correct roles; meaningful response and Judge resolution need semantic evaluation |
| AT-25 | `adp-provider`, `agent-run-coordinator`, `automatic-reviews`, `workspace` | Controlled failures, malformed responses, budgets and retries covered |
| AT-26 | `policy-validator`, `decision-validator`, `confidence` | Hard review gates and policy conflicts cannot be overridden by a model proposal |
| AT-27 | `srs-acceptance`, `answer-key-leakage` | Injected answer metadata excluded from all five captured provider requests |
| AT-28 | `workspace`; desktop/mobile browser journeys | Intake, responses, persistence and outcome covered |
| AT-29 | `workspace` | Role ownership and restricted endpoints covered |
| AT-30 | `workspace` | Retry, semantic duplicate and changed-payload conflict covered |
| AT-31 | `workspace`, `run-persistence` | Concurrent run and repeat-action protection covered; simultaneous human finalization stress test remains |
| AT-32 | `workspace`; desktop browser journey | Original AI result preserved and admin conclusion recorded; explicit reviewer-selected evidence citations remain |
| AT-33 | `workspace` | Poll/refresh restores state without duplicate review; SRS sequence-based event resume is not implemented/tested |
| AT-34 | `workspace`, `automatic-reviews` | Recovery function and persisted checkpoints covered; real process-kill/restart journey remains |
| AT-35 | `run-route`, `workspace` | Explicit replay labels and failure without silent fallback covered |
| AT-36 | desktop browser journey | Evidence keyboard access covered; entire intake via keyboard and comprehensive accessibility review remain |
| AT-37 | `workspace`, `ryde-v21` | Safety complaint gates covered |
| AT-38 | `srs-acceptance`, `workspace` | Invalid monetary inputs plus admin negative/excessive/currency/duplicate requests covered |
| AT-39 | `workspace` | Party projections, restricted audit, sanitized failure and export covered; all proposed public citation/event channels not fully implemented |
| AT-40 | `srs-acceptance`, `route-erp` | Remaining-relief arithmetic covered; shared original-charge ledger and concurrent compensation across different cases remain |
| AT-41 | `srs-acceptance`, `decision-contract`, `decision-validator`, `policy-validator` | Contradictory action/amount, uncertainty and eligibility proposals blocked |

## Live release gate

SRS 16.5 separately requires at least three live repetitions of AT-01, AT-13, AT-14, a material-uncertainty case, and the identity/history counterfactual pair. Retain model/prompt/profile hashes and review money, decisive citations, explanations, unsupported claims and privacy. The existing live evaluators under `backend/scripts/` are separate from this offline command; their sample coverage is not automatically equivalent to this entire gate.

## Verification on 16 October 2026

`npm.cmd run test:srs` passed on Windows with Node v24.14.0: build successful, 323 backend tests (including 29 new SRS checks), 17 frontend tests, and 2 Edge browser journeys. No tests were skipped. Vitest required execution outside the filesystem sandbox to resolve its configuration. No live model evaluation was performed. These results apply to the automated coverage above, not the outstanding acceptance scope.

## Test design

New synthetic variants are cloned in memory so fixture caches and original source data remain intact. Assertions exercise production projection, coordinator, decision contract and calculation functions. Captured provider requests verify what each stage actually receives. Replay is used only as a controlled test double; deterministic answers do not prove live-agent reasoning quality. The running backend's live configuration is unaffected.
