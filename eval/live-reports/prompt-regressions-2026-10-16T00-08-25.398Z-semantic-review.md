# Semantic review of the third frozen regression candidate

Reviewed `prompt-regressions-2026-10-16T00-08-25.398Z.json`, completed at 2026-10-16T00:09:06.979Z. This audit made no provider calls and changed no prompts, inputs, expected results, runtime code or raw report.

**Six of twelve tests produced assessable responses, and all six passed machine checks. Six tests failed with `ADP_STREAM_INCOMPLETE` and have no final response to assess.** Of the delivered responses, the Driver brief contains a material unsupported account-contradiction claim. The other five have supported core reasoning and correct formats; the Rider brief has a minor evidence-classification caveat below. This run cannot establish a complete regression pass.

All 12 user input strings exactly match the preceding `00:05:02.377Z` batch. The policy-verification distinction, measurement terminology and unanswered-question instructions were revised in system prompts before this batch; the manual test inputs and expected decisions were not changed.

| Role | Saved system prompt SHA-256 |
| --- | --- |
| Rider | `38b7ec2a7439520255e82768943c66364403172c5105033638fbcba9b63e4c48` |
| Driver | `903d3a4068e9afc62037f5743580c389fd7c272d1e2737b2ded75eb6f8eb47fb` |
| Judge | `8a01da61167d2d507bdb98e9fba88559491c256f236a371712b6de4b5d8ed58a` |

## Per-test assessment

| Test | Delivery/machine result | Audit result | Evidence |
| --- | --- | --- | --- |
| `rider-brief-location-uncertainty` | Delivered; pass | **Core pass, minor classification caveat** | Review is supported by TEST-E5/TEST-P2; TEST-E4 remains an elapsed interval. The unresolved question now asks about presence for the required duration without calling it verified waiting. Driver account remains attributed. The recorded charge is placed in adverseEvidence, although ledger existence is procedural context rather than proof the fee is valid. No policy-only claim or automatic refund entitlement is asserted. |
| `rider-missing-input` | Delivered; pass | **Pass** | Exact required plain-language request for identified evidence/policy, with the non-invalidity statement and no unsupported disposition. |
| `rider-rebuttal-location-uncertainty` | Delivered; pass | **Pass** | Distinguishes elapsed interval from verified correct-location waiting and explicitly applies TEST-P2 review in a cited claim. Empty standalone concessions do not invent prior history. The current prompt does not require the exact review prefix for a rebuttal. |
| `rider-rebuttal-location-uncertainty-with-own-brief` | Delivered; pass | **Pass** | Correct review logic and measurement terminology. Both own concessions are preserved exactly. No unsupported remedy or identifier is introduced. |
| `driver-brief-location-uncertainty` | Delivered; pass | **Fail: unsupported contradiction** | Correct review recommendation, attributed claims, elapsed-time wording and unresolved-location question. However, the concession states that the rider's inability to find the driver contradicts the driver's report of waiting at the correct location. Those accounts can coexist; neither supplied account states a logically exclusive location fact. This remains a substantive reasoning error even though the proposed review is correct. |
| `driver-missing-input` | `ADP_STREAM_INCOMPLETE` | **Unassessable; not a pass** | No final response or structured result exists. |
| `driver-rebuttal-location-uncertainty` | `ADP_STREAM_INCOMPLETE` | **Unassessable; not a pass** | The preceding candidate's material policy-denial error cannot be shown fixed by a missing response. |
| `driver-rebuttal-location-uncertainty-with-own-brief` | `ADP_STREAM_INCOMPLETE` | **Unassessable; not a pass** | No final response or concession output exists. |
| `judge-missing-input` | `ADP_STREAM_INCOMPLETE` | **Unassessable; not a pass** | No final input-gate response exists. |
| `judge-reverse-fee` | `ADP_STREAM_INCOMPLETE` | **Unassessable; not a pass** | No final proposal or citations exist. |
| `judge-location-uncertainty` | `ADP_STREAM_INCOMPLETE` | **Unassessable; not a pass** | The preceding waiting-wording defect cannot be shown fixed by a missing response. |
| `judge-uphold-fee` | Delivered; pass | **Pass** | UP-E3/UP-E4 verify continuous correct-location presence and the required waiting duration; UP-E5 grounds the existing charge and zero additional adjustment. Uphold/zero, no uncertainty and the exact citation summaries are supported. |

## Delivery limitations and conclusion

All six incomplete tests received HTTP 200 and an SSE stream containing `request_ack` followed by `done`, but no reply, completed event, response status or provider error code. The evaluator correctly refused to treat this as success. This establishes missing final responses; it does not independently establish whether the root cause was the network, provider, account state or another service condition. No model content should be inferred from these failures.

The delivered advocate outputs all use raw JSON when appropriate; the Rider missing-input response uses plain language. The previously omitted Driver unanswered question is now present. The false account-contradiction concession remains, and half the regression suite has no assessable result. Preserve this failed/incomplete batch; it is not a complete baseline-preservation result or a successful repeat.
