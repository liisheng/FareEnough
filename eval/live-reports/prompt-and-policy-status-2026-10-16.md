# Prompt and policy evaluation status — 16 October 2026

This checkpoint is historical. See the [current full-run results](focused-prompt-validation-2026-10-16.md): 12/12 regression checks and 3/3 sample final outcomes passed, with remaining intermediate reasoning defects. The [temperature-0.1 comparison](temperature-0.1-comparison-2026-10-16.md) and all earlier results remain preserved.

## Current status

The latest full sample run produced all three policy-supported final outcomes. The current role prompts also have passing coverage of all 12 historical/augmented regression scenarios across two reports. This is not one clean repeated full-suite run: the Driver prompt was subsequently changed and tested separately. Do not describe the application as fully reliable or all five stages as semantically flawless.

| Coverage | Evidence | Result |
| --- | --- | --- |
| All three supplied samples | [17:04 sample run](ryde-v21-2026-10-15T17-04-02.950Z.json) | 3/3 final outcome checks passed; 15 calls; earlier prompt version |
| Rider and Judge current prompts | [17:15 regression run](prompt-regressions-2026-10-15T17-15-13.137Z.json) | All eight Rider/Judge scenarios passed; two Driver scenarios failed |
| Current Driver prompt | [17:17 focused regression run](prompt-regressions-2026-10-15T17-17-21.479Z.json) | All four Driver scenarios passed |
| Local validation | Backend and frontend suites | 227 backend tests and 15 frontend tests passed; build passed |

Current prompt SHA-256 values:
- Rider: c0df75bebefaffcef9c4f77d241c355be3146f0fdee04735b24d3c6c0e71fef6
- Driver: b3aae12d0f975c74aa0b1954257b8cd8662262aeb1eda2aa875452ca49c5a022
- Judge: fc5a3e623a37e1680cbc7dc8d6d1b6ad2d6d7f62471793dd83a064149ea07eb3

The unchanged Rider/Judge hashes match the two latest reports. Current Driver coverage comes from the later focused report. Failed attempts remain retained; successful outputs have not replaced earlier failures.

## Policy and outcomes

The policy is the supplied Document 2, Ryde Dispute Resolution Policy v2.1, not an invented policy or an online source. Its organizational provenance has not been independently authenticated. The user selected this document to govern the conflict with the route sample answer.

- DISP-002: retain the existing S$5 no-show charge, zero adjustment. Policy-eligible time is 360 seconds from scheduled pickup, distinct from 480 seconds elapsed since arrival; both contact attempts are documented.
- DISP-003: propose reversing the S$4.50 unnotified surge differential.
- DISP-001: human review, zero automated adjustment. The 4.3 km deviation exceeds the policy's 2 km automation limit. S$3.44 is a reviewer reference, not an automatic award.

These evaluations do not execute or persist financial actions. Expected outcomes stay outside runtime evidence and model requests.

All agents receive selected category rules plus common policy restrictions, case records and backend calculations. The Judge additionally receives both briefs and both rebuttals. The knowledge base is not required for this pipeline. Repository prompts are sent through the per-request SystemRole override; ADP console prompts/settings have not been edited in this iteration. A prior synthetic probe observed override behavior.

## What changed

- Separated policy-eligible waiting and arrival-to-cancellation elapsed time into distinct derived records, retaining source anchors and raw evidence.
- Supplied a stage-specific JSON response contract with permitted citation IDs.
- Reworked all three role prompts, including missing-input handling, citation grounding, concession preservation and uncertainty.
- Added an executable regression harness preserving six exact historical advocate prompts and the exact Judge missing-input prompt; two own-brief rebuttal extensions and three explicitly labeled reconstructed Judge inputs supplement them.
- Required explicit policyRuleIds fields, exact citation summaries, cited applicable policy grounds and cited verified monetary amounts for reversals. The backend rejects missing fields and unsupported proposals rather than silently repairing them.
- Added safe transport diagnostics that omit credentials, thought content and upstream error bodies.

## Semantic limits

The [17:04 sample semantic review](ryde-v21-2026-10-15T17-04-02.950Z-semantic-review.md) found supported final decisions but flawed intermediate arguments: invented safety speculation in the no-show Rider stages, overstatements about notification in route arguments and an inaccurate rebuttal characterization. Correct final outcomes did not erase these failures.

Inspection of the eight current Rider/Judge outputs and four current Driver outputs found supported core decisions and valid structured citations. Residual wording caveats remain: a Driver concession loses the attribution “reports,” and one response overstates how elapsed time corroborates a reported wait. Several outputs repeat policy summaries. These checks do not prove every sentence is semantically grounded or guarantee future model behavior.

Sampled GPS corroboration also needs a clear documented evidence standard: the backend uses qualifying recorded observations, not continuous GPS proof. The source policy does not explicitly define that evidentiary sufficiency standard. Conservative review remains permissible; no model review request is converted into an automatic refund.

The historical standalone rebuttals allowed supported factual concessions without a prior own brief. An initially added empty-concessions-only check was therefore removed; its saved results remain unchanged. Missing material-location questions are now checked explicitly. Machine scores from different checker revisions are not directly comparable.

## Reproduction and next comparison

Offline, no external calls:
```text
npm run eval:policy
npm run eval:prompts
npm test
npm run test:frontend
```

Explicit live evaluation, bounded and without automatic retries:
```text
node backend/scripts/evaluate-prompt-regressions.mjs --live --max-calls 12
node backend/scripts/evaluate-policy-fixtures.mjs --live --max-calls 15
```

All saved case-evaluation and prompt-regression reports total 167 API calls across development attempts, plus one earlier synthetic override probe. This is development iteration, not an unbiased performance estimate. No further live batch is running or scheduled.

The user confirmed that all three applications use DeepSeek V3.2 as Generative Model at temperature 0.6. A controlled comparison has been requested: change only generation temperature to 0.1 on all three, publish, then rerun the fixed prompt version and test inputs. Publication is not yet confirmed. Native JSON-schema output is an option to investigate, but must preserve distinct brief/rebuttal formats and the existing plain-language missing-input behavior; it has not been enabled. No model settings have been changed by this agent.

Changes remain local and uncommitted. A complete same-version sample/regression rerun and repeatability assessment remain outstanding.
