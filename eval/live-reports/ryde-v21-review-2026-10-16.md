# Supplied-policy regression results — 16 October 2026 (Singapore)

Status: **offline checks pass; live suite is not yet reliable**. Do not select successful attempts and describe them as a stable passing suite.

## Scope and source

Three newly supplied source documents were copied unchanged into `docs/resources/`, with hashes in its manifest. The re-supplied DISP-002 document is byte-identical to the original already in the repository. The runtime snapshots supplied to models exclude answer keys, editorial recommendations, reputation/profile fields, names and plates.

The governing policy is the user-supplied **Document 2, Ryde Dispute Resolution Policy v2.1**. Section 6.2's 2 km limit comes from that document, not a rule invented for the tests. Its organizational origin has not been independently authenticated. The user chose v2.1 over the conflicting route sample answer. Reputation-based confidence calibration is deliberately excluded by the project's fairness rules; confidence-dependent unsupported cases go to review.

| Case | Policy expectation | Latest Judge proposal | Backend result |
| --- | --- | --- | --- |
| DISP-001, route | Human review, zero automated adjustment: 4.3 km exceeds 2 km | Human review, 0 | Human review, 0; outcome checks passed |
| DISP-002, no-show | Retain S$5 fee, zero adjustment: 360 eligible seconds plus chat and call | Reverse fee, S$5, contradicting its own explanation | Human review, 0; outcome and amount conflicts rejected; test failed |
| DISP-003, surge | Refund S$4.50 surge differential | Reverse disputed component, S$4.50 | Validated proposal, S$4.50; outcome checks passed |

These are evaluation proposals. The evaluator does not write workspace cases, perform financial actions, or submit a real refund. The route sample's S$3.44 amount remains reviewer reference, never an automatic award under v2.1.

## Validation and model limitations

- Build passes; 187 backend tests and 15 frontend tests pass. Offline evaluation passes all three source-policy expectations.
- Latest complete run: [16:34 UTC report](ryde-v21-2026-10-15T16-34-51.560Z.json). All five stages completed for each case. The suite failed because DISP-002 disagreed with the policy assessment.
- DISP-002's latest source snapshot correctly contains 360 policy-eligible seconds from scheduled pickup and 480 elapsed seconds from arrival. Several agent statements still confuse these. Rider rebuttal invents a safety escalation unsupported by the supplied case. Judge explanation supports retention but its outcome field proposes a refund. The backend caught both the outcome and amount conflict and retained zero adjustment.
- Successful outcome checks are separate from full semantic quality. Earlier route briefs overstated refund entitlement and notification absence, and a rebuttal substituted an opposing concession. Earlier surge outputs had minor citation/timestamp defects. Recorded GPS samples must not be described as continuous measurement.
- Strict schema and citation checks remain enabled. Invalid responses are saved separately as `unvalidatedProviderResponses`; they are not repaired by inventing or silently replacing citations. Expected outcomes are evaluation-only and never appear in model requests.
- Each report stores the exact sanitized evidence/policy snapshot, stage artifacts and failures. Prompt hashes are recorded. Later reports also store exact sent SystemRole prompts and the compiled provider hash.
- No automatic retry loop is enabled in this evaluator. Seven separately bounded development invocations made 64 case-evaluation calls. One additional synthetic diagnostic call confirmed that the configured Rider app honored SystemRole. No further calls are scheduled.

## Attempt history

| Report (UTC filename) | Calls | Result and reason for next change |
| --- | ---: | --- |
| [16:11](ryde-v21-2026-10-15T16-11-16.633Z.json) | 13 | No-show and surge outcomes matched; no-show reasoning used the wrong wait anchor; route failed validation. |
| [16:16](ryde-v21-2026-10-15T16-16-33.805Z.json) | 9 | Judge's no-show wait anchor corrected; advocates still had timing defects; route failed on empty evidence citations. |
| [16:20](ryde-v21-2026-10-15T16-20-51.570Z.json) | 12 | No-show and surge outcomes matched; route still failed and misapplied escalation policy. |
| [16:26](ryde-v21-2026-10-15T16-26-24.034Z.json) | 5 | Concise advocate prompts produced a supported route Judge review; some advocate defects remained. |
| [16:27](ryde-v21-2026-10-15T16-27-27.110Z.json) | 4 | Regression run: no-show empty citation and surge invented citation rejected. |
| [16:31](ryde-v21-2026-10-15T16-31-11.232Z.json) | 6 | Explicit request contract did not eliminate empty policy-only citations. |
| [16:34](ryde-v21-2026-10-15T16-34-51.560Z.json) | 15 | Evidence-first output ordering allowed all stages to complete; no-show still contradicted its own findings and was blocked. |

This is development iteration, not an unbiased estimate of model accuracy. Earlier successes do not override the latest failure or prove repeatability.

## Prompts and next experiment

The backend supplies repository prompts through ADP's documented per-request `SystemRole` parameter; saved ADP console prompts were not changed. A [synthetic one-call diagnostic](adp-system-role-probe.json) observed the exact requested diagnostic response. This validates override behavior for that call, not semantic reliability on disputes. Direct console preview still uses its saved prompt. See [Tencent's API documentation](https://intl.cloud.tencent.com/ko/document/product/1254/81449).

The current prompts remove conflicting review instructions, distinguish known policy triggers from missing evidence, preserve calculation anchors and require evidence-backed claims. The backend includes an explicit response contract and exact citation allowlists. A stronger reasoning model or a targeted prompt experiment should be evaluated against this same saved suite before calling the live integration reliable. The user has been asked which direction to take; no model setting has been changed.

The local server is configured for v2.1 for new live no-show reviews. Existing cases/results are retained. Route and surge tests currently run through the fixture evaluator, not new interactive intake categories. Changes are local and have not been committed or pushed in this task.
