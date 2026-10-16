# Independent semantic audit of the 00:14 regression batch

Inspected every saved final response in `prompt-regressions-2026-10-16T00-14-46.233Z.json`, completed at 2026-10-16T00:15:38.960Z. The adjacent `live-regression-status-2026-10-16T00-14.json` summary agrees with this independent inspection. No provider calls, prompt edits or raw-report changes were made for this audit.

| Measure | Count |
| --- | --- |
| Calls started / tests attempted | 12 |
| Completed final responses | 8 |
| Delivery failures without final responses | 4 |
| Machine passes | 7 |
| Delivered machine failures | 1 |
| Supported core semantic responses | 7, including one minor classification caveat |
| Delivered material semantic failures | 1 |
| Semantically unassessable | 4 |

Thus six responses are clean semantic passes, one has supported core reasoning with a minor caveat, one fails materially, and four have no assessable response. Neither 7/8 delivered machine passes nor 7/12 attempted machine passes is a complete suite pass.

## Comparison with 00:08

All 12 user inputs and all three saved system-prompt hashes exactly match `prompt-regressions-2026-10-16T00-08-25.398Z.json`:

- Rider: `38b7ec2a7439520255e82768943c66364403172c5105033638fbcba9b63e4c48`
- Driver: `903d3a4068e9afc62037f5743580c389fd7c272d1e2737b2ded75eb6f8eb47fb`
- Judge: `8a01da61167d2d507bdb98e9fba88559491c256f236a371712b6de4b5d8ed58a`

This is another run of the same prompt candidate, not a new candidate. The previously false Driver account-contradiction statement is absent in this brief; that observation does not establish a prompt fix or reliable elimination. The standalone Driver rebuttal now produces a different material failure: it endorses reversal while its own claim requires review.

## Per-test findings

| Test | Assessment |
| --- | --- |
| Rider brief: location uncertainty | **Core pass with minor caveat.** Correct review trigger, elapsed/location distinction, attribution, numerical-duration concession and unresolved-location question. It classifies the recorded charge as adverse evidence, although charge existence does not establish validity. No fee entitlement is inferred. |
| Rider missing input | **Pass.** Exact plain-language evidence/policy request and non-invalidity statement; no invented disposition. |
| Rider standalone rebuttal | **Pass.** Correctly challenges elapsed time as proof of required-location waiting and applies TEST-E5/TEST-P2 to review. No invented history or unsupported concession. |
| Rider rebuttal with own brief | **Pass.** Same supported distinction/review path; both supplied own concessions are preserved exactly. |
| Driver brief: location uncertainty | **Pass.** Correct review recommendation, account attribution, elapsed-time limitation and specific unanswered question. The concession does not falsely claim incompatible accounts. |
| Driver missing input | **Pass.** Exact plain-language request; no fee or review disposition is fabricated. |
| Driver standalone rebuttal | **Fail: material contradiction and invalid schema.** `response` says the rider's demand for reversal is correct because location is unverified. Its last claim correctly says the same uncertainty requires human review. Missing verification does not establish automatic reversal under the supplied policy. A separate policy-only claim also has `evidenceIds: []`, violating the required claim schema. The correct review claim does not repair the contradictory response. |
| Driver rebuttal with own brief | **Pass.** Identifies unverified location as the core issue and requires review without endorsing reversal. Preserves both own concessions exactly. |
| Judge missing input | **Unassessable; delivery failure.** No final response. |
| Judge reversal | **Unassessable; delivery failure.** No final proposal or citations. |
| Judge location uncertainty | **Unassessable; delivery failure.** No final proposal or uncertainty output. |
| Judge uphold | **Unassessable; delivery failure.** No final proposal. The previous batch's successful response cannot substitute for this missing one. |

All eight delivered responses use the required raw-JSON or plain-language outer format. The standalone Driver rebuttal is nevertheless structurally invalid because one claim lacks evidence. No executed financial action, fabricated evidence ID or reputation-based inference was found in the delivered responses.

Each of the four Judge failures is `ADP_STREAM_INCOMPLETE`: HTTP 200 SSE contains `request_ack` and `done`, but no final reply or completion event. The cause is not established by that telemetry. Missing replies are not model-semantic failures, but they are failed acceptance tests and cannot count as passes. This batch preserves a material advocate failure and does not establish complete baseline preservation or repeatability.
