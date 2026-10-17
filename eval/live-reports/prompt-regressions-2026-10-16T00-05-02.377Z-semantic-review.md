# Semantic review after restoring advocate input/output priorities

Reviewed all 12 outputs in `prompt-regressions-2026-10-16T00-05-02.377Z.json`, completed at 2026-10-16T00:06:16.968Z. This audit made no provider calls and changed no prompts, inputs, expectations, runtime code or raw reports.

The machine result improves to **11/12 passed**, but this is **not a clean semantic run**. The Driver standalone rebuttal materially misinterprets the explicit verified-location condition and mandatory review policy even though its IDs satisfy the mechanical checker. The Driver brief still omits the decisive unanswered question. Rider/Judge wording also promotes elapsed time to verified waiting in places.

All 12 user input strings are identical to the preceding `00:02:29.157Z` regression batch. Changes are to the advocate system prompts, not these manual case inputs. The Judge system prompt is unchanged. The new advocate prompts require the exact review prefix for brief positions only; rebuttals must clearly state the review consequence but need not use that exact prefix. Therefore the recorded rebuttal `promptCompliance.reviewOpening: false` values are not failures of this candidate's prefix rule.

| Role | Saved system prompt SHA-256 |
| --- | --- |
| Rider | `5dffdc833bc6e3736a1c266692d29d8c94995df741948fa476e8868437e7ef0f` |
| Driver | `dfbaad6eaecca36f19e66c19906b80ae55f728b66ded724b044552de14c9eb96` |
| Judge | `67297fd0934e17c296100da4f9df27161af257710c39026b924df69d026b09f9` |

## Per-test assessment

| Test | Machine result | Audit result | Evidence |
| --- | --- | --- | --- |
| `rider-brief-location-uncertainty` | Pass | **Fail: misleading measurement wording and policy-only claim** | The review recommendation, driver attribution and numerical-duration concession are supported. However, the question asks about the duration of a “verified waiting period”, while only elapsed time is verified. Claim 3 merely restates TEST-P2 with related IDs attached rather than applying it to the case. The location gap is now recorded, but the response is not fully compliant with the evidence/policy writing rules. |
| `rider-missing-input` | Pass | **Pass** | Exact required plain-language sentence; requests identified evidence/policy, states inability to assess, and preserves the validity distinction. No JSON wrapper or unsupported decision. |
| `rider-rebuttal-location-uncertainty` | Pass | **Pass** | Correctly distinguishes elapsed interval from location, ties TEST-E5 to mandatory review under TEST-P2, and says the fee cannot be automatically determined. Empty standalone concessions do not invent history. Raw JSON is valid. |
| `rider-rebuttal-location-uncertainty-with-own-brief` | Pass | **Pass** | Response identifies the numerical/verified-location distinction; the third claim explicitly requires review. Both own concessions are preserved exactly. No unsupported remedy or prior history is introduced. |
| `driver-brief-location-uncertainty` | Fail | **Fail: missing material question** | Correct review position, cited review trigger and attributed rider account. `unansweredQuestions` remains empty despite the explicit unresolved required-location fact. The prior false account-contradiction concession is absent. |
| `driver-missing-input` | Pass | **Pass** | Exact required plain-language input request with the non-invalidity statement. The previous fabricated review disposition and empty claims are absent. |
| `driver-rebuttal-location-uncertainty` | Pass | **Fail: material policy and evidence error** | The response calls the elapsed interval “verified waiting” and says independent location verification is not a condition for automatic determination. Its last claim denies that the documented location gap requires review because the duration is verified. TEST-P1 expressly requires verified waiting at the designated pickup point; TEST-E4 expressly does not verify location; TEST-E5 leaves that required fact unverified; TEST-P2 requires review for material location uncertainty. The response incorrectly neutralizes that requirement. Its preserved concession acknowledges the location gap, which conflicts with its conclusion. Merely citing TEST-E5 and TEST-P2 passes `citesReviewTrigger` but does not mean the trigger is correctly applied. |
| `driver-rebuttal-location-uncertainty-with-own-brief` | Pass | **Pass** | Correctly rejects automatic reversal and requires review because location is unresolved. Both own concessions are preserved verbatim. No exact response prefix is required by the current prompt. |
| `judge-missing-input` | Pass | **Pass** | Requests the complete required submission in plain language and explicitly avoids treating missing input as invalidity. |
| `judge-reverse-fee` | Pass | **Pass** | Correct 500-cent reversal. Unlike the preceding run, the coverage/timestamp finding cites REV-E3 and the numerical duration cites REV-E4. The duration condition is applied explicitly, and REV-E5 supplies the verified reversal amount. No uncited arrival anchor or executed reversal is asserted; summary citations match. |
| `judge-location-uncertainty` | Pass | **Fail: unsupported waiting wording; correct outcome** | Correctly proposes review/zero and cites the unresolved location. However, the explanation calls the measurement the driver's “waiting duration”, and the question calls it a “waiting period”. TEST-E4 verifies an elapsed interval only. Findings correctly preserve that distinction, so the final decision is supported, but the explanation/question overstate what is established. |
| `judge-uphold-fee` | Pass | **Pass** | UP-E3/UP-E4 establish continuous correct-location presence and the required waiting duration. Uphold/zero and an empty uncertainty array are supported; cited summaries match. |

## What improved and what remains

All outputs now comply with the raw-JSON versus plain-language format gate, and both advocate missing-input cases pass substantively. The Judge reversal's exact citation support improves. Both augmented rebuttals preserve their own concessions.

The standalone Driver rebuttal is a material regression that must not be hidden behind the 11/12 score. Avoiding invented evidence standards is appropriate only where the supplied policy does not require that standard; it cannot erase the expressly required verified-location condition in this manual test. The recorded location gap is material because it concerns that required condition, not merely because a particular data source is absent.

Eight tests are clean audit passes under the criterion above. Four need correction: one material policy interpretation, one missing decisive question, and two responses with unsupported waiting terminology or redundant policy summaries. These defects differ in severity, but none should be described as a fully clean result. All 12 calls completed without reported transport failure; no financial action or fabricated identifier was found.
