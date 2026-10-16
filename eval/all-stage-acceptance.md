# Acceptance contract for the supplied samples

Status: this is the stricter experimental target introduced after the checkpoint selected by the user. The active prompts, model inputs and sample expectations have been restored to the earlier 12/12 regression and 3/3 final-decision checkpoint. Its known semantic defects remain documented. This contract and its tests are preserved for future improvement; it is not evidence that the restored baseline satisfies every stage. See `experiments/checkpoint-successor/README.md`.

This evaluation contract is not imported by the application or sent to a model. It combines the supplied case evidence with the selected Policy v2.1. Expected answers are kept here and in `expectations/`, separate from runtime evidence.

## What a passing run means

All twelve historical/augmented regression checks pass, all three final decisions and amounts match, and all fifteen sample-stage artifacts pass a source-grounded semantic audit. A correct Judge outcome cannot repair the acceptance score of an incorrect earlier brief. Preserve first failures and audit each attempt separately. Two consecutive complete passing runs of the same prompt/input/runtime candidate are the repeatability target; this is still not a guarantee for unseen cases.

The semantic reviewer must inspect position/response, each claim, adverse evidence, concessions and gaps, plus every Judge field. Pass requires:

- Internally consistent facts, conclusion and permitted decision path.
- Exact, supporting current-case citations; policy applications cite both the case fact and rule. No policy-only entries or unrelated IDs added to satisfy the schema.
- Correct calculation units/anchors and supported actor attribution. Facts asserted in the Judge explanation also appear in cited findings.
- Fair opposing evidence and retained valid own concessions. Correcting an invalid prior concession is allowed with a cited explanation.
- No invented fault, notification, continuous location, credibility inference, policy condition, confidence score or financial execution.
- Relevant supplied policy precedents are compared in the Judge rationale without borrowing their facts, amount or confidence as current evidence.

A rebuttal addresses one strongest material claim; it does not need to repeat every case fact. Concise paraphrases are valid. Changed concession wording and minor nonmisleading style issues are reviewed, not automatically failed. Material contradictions, unsupported conclusions and materially wrong citations fail the stage.

## Governing differences from embedded sample answers

- Route: the sample reference refund is S$3.44, but its 4.3 km deviation exceeds the selected v2.1 automatic-ruling limit of 2 km. The accepted outcome is human review with zero automatic adjustment. S$3.44 may be a reviewer reference, not an award.
- No-show: the recorded platform timer uses arrival at 08:43; v2.1 uses scheduled pickup at 08:45. Policy-eligible time is 360 seconds, while arrival-to-cancellation elapsed time is 480 seconds. Keep both measurements correctly labeled.
- Party reputation, history and fraud-based credibility are excluded under the project's fairness constraints. Source examples relying on them must not be reproduced as valid reasoning.
- The stationary GPS samples corroborate pickup waiting at recorded times. The policy does not prescribe a continuous-measurement or sampling-gap standard. The accepted fixture assessment uses this corroboration; describe it honestly rather than inventing continuous tracking or a new independent-rider-GPS condition.

## No-show: DISP-002

Required facts: scheduled pickup 08:45; 360 policy-eligible seconds through 08:51; five-minute minimum; separate 480-second arrival interval; stationary pickup-coordinate GPS samples at 08:43, 08:45, 08:48 and 08:51; four driver chat attempts and one unanswered in-app call before cancellation; driver cancellation recorded in `chat-006`; S$5 fee. The rider reports being at pickup and unable to find the driver. The rider's account can coexist with the GPS observations.

Both advocates must assess retention fairly under §§2.1–2.3, acknowledging the rider's concern, sampling limits and valid wait/contact evidence. Neither missing rider GPS nor an unanswered call is an added policy requirement. Rebuttals can agree; do not manufacture disagreement. The §7.3 historical contact-failure precedent is distinguishable because current required attempts occurred.

Judge: `uphold_fee`, adjustment `0`. Cite the correct scheduled-wait calculation, pickup corroboration, both contact attempts and the actor-identifying record when naming who cancelled. Do not turn incidental unknowns such as why the call was unanswered into a mandatory review trigger.

## Surge: DISP-003

Required facts: S$12 quote, S$16.50 actual fare, multiplier 1.0 to 1.5; unchanged S$9 surgeable subtotal and S$3 fixed components; backend-verified S$4.50 difference solely from surge; explicit `rider_notified: false`. This is stronger than merely finding no message in chat. §§3.1–3.4 support refunding the differential and §6.1 permits this amount automatically.

Both advocates must acknowledge the supported differential reversal. The Driver may emphasize completed service, absence of demonstrated driver fault and retention of the undisputed fare; none waives the notification requirement. Completed travel is not acceptance of an undisclosed change. Apply the §7.2 precedent's principle using this case's amount.

Judge: `reverse_fee`, adjustment `450`. Cite the current verified monetary calculation and explicit notification status. Do not refund the entire fare or invent uncertainty about an already supplied calculation.

## Route: DISP-001

Required facts: actual 24.8 km minus recommended 20.5 km gives 4.3 km (4,300 m); S$0.80/km yields S$3.44 candidate excess-distance fare; the total S$6.50 fare difference is a different quantity. Traffic fire/congestion supports rerouting justification. The rider's route question and driver's generic assurance do not establish the required reason/notification; absent chat notice does not establish that no permitted verbal notice occurred.

Both initial briefs and both rebuttals must recommend human review, cite the distance with §6.2 in supporting claims, and leave retention/reversal unresolved. They may discuss the rider's excess-distance/notice concern and the driver's traffic justification. Neither low value nor traffic justification overrides the distance restriction. The §7.1 precedent's 1.8 km case differs materially from the current 4.3 km case.

Judge: `human_review`, adjustment `0`. Known distance independently triggers review, so `uncertainty: []` is permitted. If discussing notice on the merits, identify the unresolved availability/content of timely verbal notice or acknowledgment without inventing its absence.

## Recording acceptance

Raw reports retain final-decision checks, per-stage contract checks and pending semantic reviews. A separate review companion binds to the raw report hash and records a summary and any issues for every stage. `evaluateOverallAcceptance` combines those results. Never overwrite raw outputs, silently add citations, delete failed claims or treat a pending audit as passed.
