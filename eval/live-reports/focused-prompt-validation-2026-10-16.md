# Focused prompt validation — 16 October 2026

## Current result

**All automated regression and sample-outcome checks pass in this run; this is not a clean semantic pass of every agent stage.**

| Suite | Result |
| --- | --- |
| Historical/augmented regression checks | 12/12 passed |
| Regression core semantic review | Passed, with minor Rider framing/classification caveats |
| Full sample final-outcome checks | 3/3 passed |
| All sample stages completed | 15/15 |
| Every sample advocate statement semantically correct | No |

The user confirmed Judge-only Deep Thinking enabled in both model slots and published, with both advocates unchanged and all temperatures still 0.1. Generative Model remains the user-reported DeepSeek V3.2. No console setting was changed by the agent. Execution-level reasoning telemetry was not independently verified.

## Two separate experiments

1. With the earlier prompts frozen, the published Judge setting comparison used 27 calls: 10/12 regression checks and 3/3 sample outcomes passed. This fixed the no-show/route final outcomes in that run, but retained a Rider citation failure and introduced a Judge citation/uncertainty failure. See the [preserved setting comparison](judge-deep-thinking-comparison-2026-10-16.md).
2. A focused revision of all three local prompts then used a further 27 calls: 12/12 regression checks and 3/3 sample outcomes passed. Model settings, policies, fixture inputs, expected outcomes, provider code and validation were unchanged. All twelve regression user inputs exactly match the preceding run.

Total for this turn: 54 bounded calls, no automatic retries or transport failures. Both first-attempt failures and later results are retained; successful results have not replaced failed outputs. No further live calls are running or scheduled, and no financial actions were executed.

## Prompt changes

- Rider and Judge: strengthen the requirement for a case-specific fact plus an applicable rule, rather than policy-only entries with empty citations. Examples use no fixture/test IDs or expected answers.
- All roles: match cited records to the exact actor and calculation anchors; distinguish sampled GPS observations from continuous presence; inspect notification content rather than treating generic reassurance as notice.
- All roles: distinguish an absent submission from a supplied case with a missing decisive calculation. The former requests input; the latter assesses the documented gap and review requirement.
- Judge: derive the unresolved-question array from the case rather than copying an advocate's empty array.

The backend reads these repository prompts for each review and sends them in ADP SystemRole. This revision is active for backend requests without changing the console prompt. Direct ADP-console prompt text was not edited or published by the agent.

| Prompt | SHA-256 |
| --- | --- |
| rider-advocate.md | 4d817e0e51a44ad4b1bb0dab19db82ef8a68dc01982fedaf4f271c68fa1208a9 |
| driver-advocate.md | 57000654fd119ecb283d4506ce60a803e0784b7c9e7ad426aca51a551333d256 |
| judge.md | af63e502b008ab6cb6d4041f0187ed971d56ab9ad028df03f6dbc5c88443f5f8 |

## Sample decisions and remaining semantic defects

| Case | Expected and actual Judge/backend result |
| --- | --- |
| DISP-002 no-show | Retain fee; zero adjustment |
| DISP-003 surge | Reverse S$4.50 differential |
| DISP-001 route | Mandatory human review; zero adjustment |

The initial no-show Rider brief contradicts itself: it supports the charge, then calls a permission for automatic determination a review trigger, then supports the charge again. It also overstates sampled GPS as continuous presence. The Judge uses the correct scheduled waiting interval, contact requirements and sampled observations, but its explanation still names the cancelling actor without including the actor-identifying record in its findings/summary citations.

The initial route briefs are also inconsistent with the mandatory review restriction: the Rider advocates reversal despite citing the restriction in adverse evidence, and the Driver advocates retention using generic reassurance as notice. Their rebuttals recover mandatory review and the Judge selects the correct review outcome.

These are material upstream reasoning defects, not formatting failures or evidence of a fully reliable system. Final-outcome checks do not certify intermediate arguments. The no-show fixture also retains the documented interpretation limit: sampled GPS sufficiency is a backend assessment, while the supplied policy specifies no continuous-GPS or sampling-gap standard. No such rule was invented to force a passing result.

## Artifacts and validation limits

- [Regression raw report](prompt-regressions-2026-10-15T17-47-27.670Z.json)
- [Regression semantic audit](prompt-regressions-2026-10-15T17-47-27.670Z-semantic-review.md)
- [Sample raw report](ryde-v21-2026-10-15T17-48-59.544Z.json)
- [Sample semantic audit](ryde-v21-2026-10-15T17-48-59.544Z-semantic-review.md)

No runtime code changed in this turn. The earlier 227 backend and 15 frontend test passes and successful build remain the last local code validation; they were not rerun for these prompt/document-only edits. Existing workspace changes remain uncommitted. The historical Judge regression inputs include three explicitly reconstructed scenarios, not recovered original verbatim requests.

This is one full passing automated run of the candidate, not a repeatability guarantee. The next engineering issue is consistency of intermediate advocate arguments with mandatory policy constraints; further model or prompt changes should preserve these reports and rerun the same regression and outcome checks.
