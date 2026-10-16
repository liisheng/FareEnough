# Restored focused-validation checkpoint — 16 October 2026

The user requested restoration to the checkpoint documented in [focused-prompt-validation-2026-10-16.md](focused-prompt-validation-2026-10-16.md), followed by fresh regression validation and a commit.

## Fresh results

| Check | Result |
| --- | --- |
| Full live prompt regression suite | 12/12 passed |
| Regression core semantic review | Passed with minor wording/citation caveats |
| Live sample final decisions | 3/3 passed |
| Sample stages completed | 15/15 |
| Every intermediate argument semantically reliable | No |
| Backend tests | 272 passed across 22 files |
| Frontend tests | 15 passed |
| Build and offline sample expectations | Passed |

The no-show result retains the existing fee with zero adjustment; surge proposes a 450-cent reversal; route requires human review with zero automatic adjustment. The route source's 344-cent amount remains reviewer reference context under the selected v2.1 distance restriction.

The first fresh regression attempt returned ten passing answers and two incomplete ADP streams. It is preserved in [the failed attempt](prompt-regressions-2026-10-16T00-31-59.516Z.json). The next complete run used a ten-second pause between requests and passed all twelve. This does not prove that request rate caused the earlier failures. Both attempts use identical prompts, test inputs and expected checks, with no automatic retries or replacement of failed outputs.

The restoration validation used 39 bounded live calls: twelve in the incomplete attempt, twelve in the full passing regression run, and fifteen in the sample run. No financial action was executed.

## Exact restoration scope

All three repository prompt strings and hashes match the earlier passing 17:47 report exactly:

| Prompt | SHA-256 |
| --- | --- |
| Rider Advocate | 4d817e0e51a44ad4b1bb0dab19db82ef8a68dc01982fedaf4f271c68fa1208a9 |
| Driver Advocate | 57000654fd119ecb283d4506ce60a803e0784b7c9e7ad426aca51a551333d256 |
| Judge | af63e502b008ab6cb6d4041f0187ed971d56ab9ad028df03f6dbc5c88443f5f8 |

All three model-input snapshots and independent policy assessments match the earlier passing 17:48 sample report. Original waiting, contact, amount, uncertainty and safety validation remain intact. The twelve regression user inputs and expected assertions were unchanged. Active sample expected outcomes were restored from that report, not selected from new model outputs.

Later projection additions and stricter citation requirements are preserved under [the successor experiment](../experiments/checkpoint-successor/README.md). Its strict evaluation-helper tests remain active independently of the restored runtime. The newer diagnostics, audit tools and all failed reports are also retained. The restoration concerns the prompt and model-input behavior; it does not erase the experimental history or claim to satisfy its stronger semantic acceptance target.

## ADP configuration and application behavior

No ADP app settings or console prompts were changed during restoration. The prior inspection showed DeepSeek V3.2 in both slots, Generative Model temperature 0.1 for all three apps, and separate Thinking Model temperature 0.6. Judge Deep Thinking was enabled in both slots, while both advocates were disabled. The user had previously confirmed the Judge changes were published; inspection of current draft settings does not independently certify a published configuration.

Backend requests read the restored repository prompts and send them through `SystemRole`. Rebuild and restart a running backend to load changed compiled policy code. Evaluation here used a fresh build and the restored inputs directly.

## Limits and retained evidence

Known policy contradictions still occur in advocate arguments. In this sample rerun, the no-show Rider initially treats an automatic-decision permission as a review requirement, and the surge Driver initially treats completed travel as overriding missing notification. Later stages correct those errors. All four route advocate stages omit the mandatory distance restriction, which the Judge correctly applies. The Judge reaches all expected final decisions. This is a passing automated checkpoint with remaining reasoning defects, not a reliability certification.

- [Passing regression raw report](prompt-regressions-2026-10-16T00-35-06.071Z.json)
- [Regression semantic audit](prompt-regressions-2026-10-16T00-35-06.071Z-semantic-review.md)
- [Sample raw report](ryde-v21-2026-10-16T00-38-31.207Z.json)
- [Sample semantic audit](ryde-v21-2026-10-16T00-38-31.207Z-semantic-review.md)

Environment files, runtime databases and local recovery backups are excluded from the commit. Live reports preserve final answers and bounded diagnostic metadata, not private reasoning or raw response streams.
