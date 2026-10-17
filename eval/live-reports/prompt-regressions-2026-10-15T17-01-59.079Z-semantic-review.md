# Semantic review of the 17:01 prompt regression run

Source: `prompt-regressions-2026-10-15T17-01-59.079Z.json`, completed at 2026-10-15T17:03:10.577Z. This companion does not modify the recorded inputs, outputs, or original machine results. No additional provider calls were made for this review.

The recorded machine result was 11 passes out of 12. All 12 responses completed. The single recorded failure was the new empty-standalone-concessions restriction, not an unsupported incident fact. Separate semantic review found missing uncertainty arrays and one inaccurate review-trigger explanation. This is not a clean semantic suite pass.

| Test | Original machine result | Semantic assessment |
| --- | --- | --- |
| rider-brief-location-uncertainty | Pass | Review is supported by unavailable location records, and opposing driver evidence is cited. However, `unansweredQuestions` is empty despite the decisive unknown location. The concession calls the interval “elapsed waiting time”; this should remain an elapsed interval, with only the numerical duration condition met. |
| rider-missing-input | Pass | Pass. Requests identified evidence and policy; does not make a decision or imply the request is invalid. |
| rider-rebuttal-location-uncertainty | Fail | Pass against the original standalone-test semantics. The concession accurately acknowledges the backend's 480-second elapsed interval and the numerical threshold. No fictitious prior brief or history is asserted. The supporting claims distinguish location uncertainty and cite TEST-P2. The exact current opening phrase is not followed, but that newer wording rule was already advisory for historical rebuttals. |
| rider-rebuttal-location-uncertainty-with-own-brief | Pass | Needs correction. Own concessions are preserved exactly and the claims are grounded. The response says the opposing claim relies on “a threshold that triggers a review restriction”; the numerical 480-second threshold does not trigger review. Unavailable pickup-location verification triggers TEST-P2. |
| driver-brief-location-uncertainty | Pass | Core position and evidence are supported, including the rider's contrary account and the calculation's location limitation. `unansweredQuestions` is empty despite unknown pickup location. “Waiting threshold” should be qualified as the numerical duration threshold. |
| driver-missing-input | Pass | Pass. Requests identified evidence and policy without an unsupported fee decision. |
| driver-rebuttal-location-uncertainty | Pass | Core semantics pass: rejects automatic reversal, applies TEST-P2, retains attributed driver account, and describes the 480 seconds as elapsed. One redundant claim merely summarizes TEST-P2 despite the current prohibition on standalone policy summaries; the next claim supplies the case-specific application. |
| driver-rebuttal-location-uncertainty-with-own-brief | Pass | Pass in substance. The response keeps location unresolved and own concessions are retained exactly. Duration wording should consistently say numerical threshold, but no full location condition is claimed satisfied. |
| judge-missing-input | Pass | Pass. Requests identified evidence, policy, both briefs/rebuttals and needed calculations; makes no ruling. |
| judge-reverse-fee | Pass | Pass. Authenticated correct-location waiting of 240 seconds is below the supplied 480-second requirement; REV-E5 supports the 500-cent amount. Findings and citation summaries agree. |
| judge-location-uncertainty | Pass | Outcome and reasoning support human review with zero adjustment. `uncertainty` is empty despite the unresolved pickup-location fact explicitly described in the findings and explanation. |
| judge-uphold-fee | Pass | Pass. Supplied authenticated continuous location records and verified 480-second waiting satisfy UP-P1; zero adjustment is consistent with retention. |

## Checker calibration after this run

The original standalone rebuttal prompts explicitly ask to preserve valid concessions but do not supply an own prior brief. Earlier accepted outputs acknowledge evidence-supported opposing facts in this field. Requiring `preservedConcessions: []` was therefore a new instruction, not an original test condition. The checker now records empty-versus-nonempty standalone concessions under advisory prompt compliance and requires manual review of factual grounding and any invented prior history. The two augmented cases still machine-check preservation of the supplied own brief's concessions.

The checker now also requires a nonempty `unansweredQuestions` or `uncertainty` array in the three specific location-gap brief/Judge cases. This follows their known material gap; it does not force uncertainty into known-threshold or fully established cases. Array presence is only a machine check; the question's relevance remains a semantic check. With these calibrated checks, the recorded outputs would have nine machine passes and three gap-array failures. That is an offline reassessment, not a replacement of the original run or a new model trial.

Remaining defects cannot be resolved merely by changing the checker: the augmented rider rebuttal's review-trigger explanation is inaccurate, and the three gap arrays omit known material questions. No fabricated evidence IDs, executed financial action claims, or cross-case data imports were found in this run.
