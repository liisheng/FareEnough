# Manual semantic review of historical prompt regressions

Reviewed the completed [12-test report](prompt-regressions-2026-10-15T16-59-17.088Z.json), completed at `2026-10-15T17:00:40.896Z`. The source report was not modified. This review used saved outputs only and made no external calls.

**Result: eight machine passes and four failures. The suite has not passed.** All three missing-input tests now respond appropriately in plain language. Both augmented rebuttals preserve their own supplied concessions. The two complete-evidence Judge decisions have supported outcomes and monetary amounts.

| Test | Review |
| --- | --- |
| `rider-brief-location-uncertainty` | Pass with wording caveat. Recommends required review, cites the location gap and review policy, attributes the driver account, and leaves validity unresolved. Its concession calls the interval “elapsed waiting time”; “elapsed interval meets the numerical duration threshold” would be more precise, since location is unverified. The actual claims distinguish elapsed time and unavailable location records. |
| `rider-missing-input` | Pass. Requests identified evidence and policy; explicitly says inability to assess does not invalidate the request. No invented citations, verdict, or executed action. |
| `rider-rebuttal-location-uncertainty` | Pass with wording caveat. Rejects automatic fee retention because location uncertainty triggers review, using the right evidence and policy. It correctly leaves `preservedConcessions` empty because no own prior brief was supplied. “Elapsed time condition is satisfied” should refer to the numerical duration component, not the full verified-wait condition; the subsequent text explicitly preserves the unresolved location requirement. |
| `rider-rebuttal-location-uncertainty-with-own-brief` | **Fail:** `claims[1].evidenceIds` is empty. It emits a redundant policy-only claim. The surrounding factual application and review outcome are supported, and both own concessions are preserved exactly; neither fixes the invalid claim. |
| `driver-brief-location-uncertainty` | **Fail:** `claims[2].evidenceIds` is empty. It emits a policy-only summary rather than applying that rule to an identified fact. The remaining review reasoning, reported accounts, and adverse evidence are supported. The concession's “elapsed waiting time” wording should be limited to the numerical interval, not verified waiting. |
| `driver-missing-input` | Pass. Requests identified evidence and policy without deciding the fee or treating absent input as fault. |
| `driver-rebuttal-location-uncertainty` | **Fail:** `challengedClaim` is an object, but the contract requires a string. Independently, `claims[1]` says the backend verifies that the driver **waited** for 480 seconds. TEST-E4 verifies only the elapsed interval and explicitly does not verify location. The final recommendation of review is appropriate, but that stronger factual wording is unsupported. |
| `driver-rebuttal-location-uncertainty-with-own-brief` | Pass. Recognizes the rider's supported uncertainty argument without endorsing automatic reversal. Applies TEST-P2 to TEST-E5 and preserves both of its own concessions exactly. |
| `judge-missing-input` | Pass. Requests identified evidence, policy, both briefs and rebuttals, and needed verified calculations. No partial JSON, invented citations, or final decision. |
| `judge-reverse-fee` | Pass. Authenticated correct-location presence and the backend's 240-second duration establish the policy breach. REV-P2 supports reversal; the verified 500-cent amount is cited in a finding and the top-level evidence summary. It proposes a reversal without claiming execution. |
| `judge-location-uncertainty` | **Fail:** `findings[3].evidenceIds` is empty. The review outcome and zero adjustment are supported by the location gap and TEST-P2, but the proposal is structurally invalid. Independently, `uncertainty` is empty despite the explanation and findings identifying the driver's unresolved pickup location; that field should retain the material question. |
| `judge-uphold-fee` | Pass. The supplied authenticated continuous-location record and verified 480-second duration meet UP-P1. UP-E5 supports zero additional adjustment. Evidence and policy summaries cover the findings, and no execution is claimed. |

## Cross-test observations

- All 12 responses use raw JSON or the expected plain-language form; the previous Markdown fence failures did not recur.
- The four failures are actual schema/citation-contract violations, not failures caused by enforcing a new rebuttal opening phrase.
- Review wording in a rebuttal is acceptable without a mandated opening phrase under the historical tests. Current prompt compliance is a separate advisory check.
- No new evidence or policy identifiers were invented in these saved outputs. Empty evidence arrays are still invalid, even when a correct cited application appears elsewhere.
- The original six advocate inputs and Judge missing-input input are exact retained strings. The augmented rebuttals add an own brief. Three Judge scenarios are explicitly reconstructed, so this review does not certify an exact replay of missing historical input text.
- A single successful response does not establish repeatability. The full suite must be rerun after any prompt changes, and schema-valid results still require semantic inspection.
