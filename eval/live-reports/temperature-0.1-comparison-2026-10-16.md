# Temperature 0.1 evaluation — 16 October 2026

Historical comparison: see the [later Judge-setting and focused-prompt results](focused-prompt-validation-2026-10-16.md) for the current candidate. The results below remain unchanged.

## Result

**Not a passing suite.** One bounded evaluation made 27 API calls: 12 historical/augmented prompt tests followed by three five-stage sample reviews. No automatic retries or transport failures occurred. Prompts and test inputs were unchanged during this run.

| Suite | Result |
| --- | --- |
| Prompt regression checks | 11/12 passed |
| Sample policy/outcome checks | 1/3 passed |
| All five stages completed per sample | 3/3 |
| Invalid route financial proposal blocked by backend | Yes, human review with zero adjustment |

Model/settings metadata is user-reported: DeepSeek V3.2 as Generative Model for all three apps; temperature changed from 0.6 to 0.1 and published. Deep Thinking was instructed to remain unchanged; its actual enabled/disabled state was not recorded. Console settings were not independently inspected.

## Sample decisions

| Case | Required result under selected policy | Judge proposal | Backend result |
| --- | --- | --- | --- |
| DISP-002 no-show | Retain fee, zero adjustment | Human review, zero | Human review retained; expected outcome failed |
| DISP-003 surge | Reverse S$4.50 differential | Reverse S$4.50 | Validated simulated proposal; passed |
| DISP-001 route | Human review, zero adjustment | Reverse S$3.44 | Blocked; human review, zero |

No-show: the Judge correctly used 360 seconds from scheduled pickup and both contact attempts, but introduced an implicit requirement for independent rider-location verification. It also described a rider failing to find the vehicle as directly contradicting driver presence, although those facts can coexist.

Route: the Judge explicitly claimed that the low-value rule in §6.1 overrides the route restriction in §6.2. The supplied policy does not contain that override. The 4.3 km deviation requires review. Backend validation detected the outcome and amount conflicts and preserved zero adjustment.

Surge: the S$4.50 reversal is supported by the increased multiplier, recorded missing notification and backend-verified differential.

These are evaluation proposals only. The evaluator does not execute financial actions or create new workspace adjudications.

## Regression findings

The failed case was rider-rebuttal-location-uncertainty: a standalone policy-summary claim contained evidenceIds: []. It was rejected without adding a citation or deleting the claim.

All four Driver scenarios and all four Judge scenarios passed machine checks. Rider brief and own-brief rebuttal also passed machine checks. Semantic review additionally found that the Rider brief treated unverified location as establishing that the policy does not support the fee; uncertainty alone must leave fee validity unresolved.

## Comparison limits

The 0.1 regression run uses the exact same role prompt hashes and user test text as the latest 0.6 role baselines: Rider/Judge from 17:15 and Driver from 17:17. Those baselines passed all 12 checks across two reports, not in a single repeated full run. The new run did not preserve every passing result.

The previous full sample run at 17:04 passed all three final outcomes but had semantic defects. All three role prompts and backend validation were revised after that sample run. Therefore, the sample difference cannot be attributed solely to temperature. This is the first complete sample run of the frozen current candidate at the reported 0.1 setting.

One run per configuration does not establish a statistical reliability improvement or degradation. The supported conclusion is narrower: lowering temperature did not eliminate the observed citation and policy-reasoning failures.

## Artifacts

- [Regression raw report](prompt-regressions-2026-10-15T17-26-40.673Z.json)
- [Regression semantic review](prompt-regressions-2026-10-15T17-26-40.673Z-semantic-review.md)
- [Sample raw report](ryde-v21-2026-10-15T17-27-52.914Z.json)
- [Sample semantic review](ryde-v21-2026-10-15T17-27-52.914Z-semantic-review.md)
- [Previous status and fixed prompt hashes](prompt-and-policy-status-2026-10-16.md)

No prompts, policies, expectations, model settings or runtime code were changed during this comparison. The raw reports are preserved. Credential checks found no configured ADP key in either raw report.

Earlier local validation remains 227 backend tests and 15 frontend tests passed, with a successful build; no runtime code changed afterward in this comparison. Changes remain local and uncommitted. No further live calls are running or scheduled.

The next proposed setting experiment is Deep Thinking on the Judge, if it is currently disabled, while retaining temperature 0.1 and the fixed prompts. Its state must be confirmed rather than assumed. Structured output and a separately bounded repair path remain other options; neither has been enabled or implemented by this experiment.
