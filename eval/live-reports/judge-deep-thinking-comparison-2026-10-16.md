# Judge Deep Thinking comparison — 16 October 2026

## Frozen comparison result

The user confirmed that Deep Thinking was enabled in both the Thinking and Generative model slots of the Judge application and published. Both advocates were unchanged and all temperatures remained at 0.1. These are user-reported console settings, not independently observed execution metadata.

The comparison made 27 bounded calls without automatic retries. All calls completed. All three system prompt hashes and all twelve regression inputs exactly match the preceding temperature-0.1 run. The sample inputs, provider code and effective system prompts also match that baseline.

| Check | Previous run | Judge Deep Thinking run |
| --- | --- | --- |
| Historical/augmented regression checks | 11/12 | 10/12 |
| Sample final outcomes | 1/3 | 3/3 |
| No-show | Unnecessary review | Retain fee, zero adjustment |
| Surge | Reverse S$4.50 | Reverse S$4.50 |
| Route | Incorrect S$3.44 reversal, blocked by backend | Mandatory review, zero adjustment |

This is a useful sample-outcome improvement in one run, not evidence that every response is correct or that Deep Thinking reliably caused the improvement. The preceding run's actual Deep Thinking state was not recorded. The unchanged advocates also produce variable outputs.

## Remaining defects

- The Rider standalone rebuttal again includes a policy-only claim with an empty evidence citation array.
- The Judge location-uncertainty regression includes two policy-only findings with empty evidence citations and returns an empty uncertainty array despite identifying an unresolved required location. Its human-review outcome is correct, but the response fails the contract.
- Sample semantic review found citation/wording defects despite correct final outcomes: the no-show Judge attributes cancellation without citing the actor-identifying record; an advocate confuses elapsed-time and scheduled-wait source records; some GPS wording overstates continuous presence; route reassurance is misclassified as notice by the Driver Advocate.
- No-show interpretation limit: the backend treats the supplied stationary GPS samples as sufficient corroboration for its fixture assessment, while the supplied policy does not specify a sampling sufficiency standard. The input explicitly says samples are not continuous measurement. Retain this caveat rather than inventing a policy rule or changing the approved expectation to fit a response.

No outputs were patched to add citations or remove failed claims. No real financial action was executed. The regression transport's limited message-label metadata cannot establish whether the service internally used Deep Thinking.

## Preserved artifacts

- [Regression raw report](prompt-regressions-2026-10-15T17-38-50.725Z.json)
- [Regression semantic audit](prompt-regressions-2026-10-15T17-38-50.725Z-semantic-review.md)
- [Sample raw report](ryde-v21-2026-10-15T17-40-26.954Z.json)
- [Sample semantic audit](ryde-v21-2026-10-15T17-40-26.954Z-semantic-review.md)
- [Previous comparison](temperature-0.1-comparison-2026-10-16.md)

These results precede the subsequent focused prompt revision. They must not be relabeled as a passing full suite or combined with later successes to hide first-attempt failures.
