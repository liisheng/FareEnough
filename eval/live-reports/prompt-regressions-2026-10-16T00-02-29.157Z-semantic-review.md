# Semantic review of the concise advocate candidate

Reviewed all 12 final outputs in `prompt-regressions-2026-10-16T00-02-29.157Z.json`, completed at 2026-10-16T00:03:50.977Z. This audit made no provider calls and changed no prompts, inputs, expectations, runtime code or raw results.

The saved machine result is **5/12 passed**. This is **not a clean semantic or prompt-contract run**. Both advocate briefs omit the decisive unresolved-location question; the Driver brief invents a contradiction between compatible accounts; the Driver missing-input response invents a review disposition instead of requesting input. Multiple advocate responses also violate the raw-JSON or exact review-opening requirements. The Judge's reversal is substantively correct but has a citation-support defect described below.

All 12 user input strings match `prompt-regressions-2026-10-15T17-47-27.670Z.json` exactly. The run contains the original historical advocate inputs, own-brief extensions, and the same explicitly reconstructed Judge scenarios. The supplied policy precedents and additional mechanical case facts used in the separate sample evaluation are not present in these unchanged manual inputs.

| Role | Saved system prompt SHA-256 |
| --- | --- |
| Rider | `1b705b675cc664f233fcdeebcc153175fba46fdad61d2cdbe02ede7d8b0452d5` |
| Driver | `89442594857a533c75eb8044453bc927166876a3ee77758b10cb068e2835e55a` |
| Judge | `67297fd0934e17c296100da4f9df27161af257710c39026b924df69d026b09f9` |

## Per-test assessment

“Audit pass” below requires supported case reasoning and compliance with the material input/output rules. A correct conclusion inside a fenced or invalid response remains an output-contract failure; this is distinguished from a wrong factual or policy conclusion.

| Test | Machine result | Audit result | Evidence |
| --- | --- | --- | --- |
| `rider-brief-location-uncertainty` | Fail | **Fail: missing material question and format** | Correctly recommends review, attributes both accounts, and distinguishes elapsed time from location. However, `unansweredQuestions` is empty despite the expressly unresolved pickup location, and output is fenced. The duration concession is limited to the numerical threshold; it does not establish location. |
| `rider-missing-input` | Fail | **Fail: input-gate contract** | The required missing-input sentence appears inside a partial brief JSON object with empty claims. Its substance requests identified evidence/policy and correctly says the request is not invalid, but the gate requires that sentence alone in plain language. No false fee decision occurs. |
| `rider-rebuttal-location-uncertainty` | Fail | **Fail: format and required opening** | Core reasoning is supported: elapsed time does not verify location, and TEST-E2/TEST-E5 with TEST-P2 ground review. Empty standalone concessions are allowed. Output is fenced and `response` does not begin with the required review sentence. |
| `rider-rebuttal-location-uncertainty-with-own-brief` | Fail | **Fail: format and required opening** | Correctly applies the location gap to TEST-P2 and preserves both own concessions verbatim. Output is fenced and omits the required review opening. No unsupported automatic remedy is asserted. |
| `driver-brief-location-uncertainty` | Fail | **Fail: unsupported contradiction and missing question** | The position and cited claims correctly require review. The concession nevertheless says the rider's inability to find the driver contradicts the driver's report of being present; both could be true. `unansweredQuestions` is empty despite the location gap. Output is also fenced. |
| `driver-missing-input` | Fail | **Fail: unsupported disposition and invalid structure** | Produces `Human review is required.` with two empty-evidence claims despite no identified case evidence or policy. It describes missing inputs rather than actually asking for them, and omits the required non-invalidity statement. This confuses an absent submission with a supplied case that warrants review. The checker’s `requests_*` keyword matches do not establish that a request was made. |
| `driver-rebuttal-location-uncertainty` | Fail | **Fail: format and required opening** | Supported claims distinguish the driver's report, elapsed interval and missing location; the final claim explicitly invokes mandatory review. The response emphasizes duration and non-disproof without stating the review consequence, and lacks the required opening. It is fenced. The numerical duration statement does not establish all fee conditions. |
| `driver-rebuttal-location-uncertainty-with-own-brief` | Pass | **Fail: required opening** | Raw JSON is valid; both own concessions are preserved exactly and the decisive claim applies TEST-P2 to TEST-E5. The response does not begin with the required review sentence or expressly state the review consequence, although the claims do. The report records `promptCompliance.reviewOpening: false`, outside its machine `passed` score. |
| `judge-missing-input` | Pass | **Pass** | Plain-language request for evidence, policy, advocates and needed calculations; explicitly says inability to assess does not invalidate the request. No outcome or action is invented. |
| `judge-reverse-fee` | Pass | **Fail: citation support; correct outcome** | Reversal of 500 cents is supported by the 240-second calculation and verified monetary record. However, finding 1 calls the duration continuous and anchored at arrival-to-cancellation while citing only REV-E4, which states the verified total duration, not those additional coverage/anchor facts. REV-E3 supplies continuous correct-location coverage but is not cited anywhere; neither cited record explicitly labels the start as an arrival event. The last finding is also a standalone policy summary with related IDs attached, forbidden by the current prompt. The supported reversal does not make every finding valid. |
| `judge-location-uncertainty` | Pass | **Pass** | Correct review/zero proposal. TEST-E4 remains elapsed time; TEST-E5 grounds the location gap and TEST-P2 application. The uncertainty array identifies the unresolved required-location question, and citation summaries match the findings. |
| `judge-uphold-fee` | Pass | **Pass** | UP-E3/UP-E4 explicitly establish continuous required-location waiting and the full numerical duration, supporting retention/zero. No material unknown is invented. Citation summaries match. The first and third findings overlap, but neither changes the supported decision. |

## Conclusion

Only the Judge missing-input, location-uncertainty and uphold outputs are clean audit passes under the above criterion. Several other outputs have supported core reasoning but fail a required contract; two Driver outputs introduce material unsupported reasoning, and the Judge reversal adds unsupported citation detail. These distinctions should be preserved rather than collapsing them into a final-outcome pass.

All 12 calls completed without reported transport failure. No invented evidence identifiers, reputation-based fault inference, claimed refund execution or cross-case imports were found. Own-brief concession strings were preserved in both augmented rebuttals. Those successful properties do not remove the failures above. This candidate does not meet the requested baseline-preservation criterion and should not be presented as a passing repeat.
