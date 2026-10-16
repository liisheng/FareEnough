# Semantic review: reported temperature 0.1, unchanged prompts

Reviewed `prompt-regressions-2026-10-15T17-26-40.673Z.json`, completed 2026-10-15T17:27:52.798Z. All 12 requests completed; 11 machine checks passed and one failed. The user reported publishing all three applications at temperature 0.1. The report does not independently attest the remote temperature setting, so this is a comparison of runs associated with the reported setting, not a controlled temperature-effect estimate.

Baseline comparison uses Rider and Judge outputs from `prompt-regressions-2026-10-15T17-15-13.137Z.json` and Driver outputs from `prompt-regressions-2026-10-15T17-17-21.479Z.json`. The exact role prompt hashes match:

- Rider: `sha256:c0df75bebefaffcef9c4f77d241c355be3146f0fdee04735b24d3c6c0e71fef6`
- Driver: `sha256:b3aae12d0f975c74aa0b1954257b8cd8662262aeb1eda2aa875452ca49c5a022`
- Judge: `sha256:fc5a3e623a37e1680cbc7dc8d6d1b6ad2d6d7f62471793dd83a064149ea07eb3`

The combined baseline had 12 machine passes, with documented wording caveats. This run has a citation-schema regression and an additional unsupported rider position. It does not establish that the lower reported temperature reliably improves the suite. The raw report is unchanged; no new provider calls were made for this review.

| Test | Machine | Semantic assessment and comparison |
| --- | --- | --- |
| Rider brief: location uncertainty | Pass | **Needs correction.** It correctly calls for review, but adds “The policy does not support the no-show fee because the driver's location cannot be verified.” Missing verification leaves fee validity unresolved; it is not a basis to characterize the fee as unsupported outright. The baseline avoided this conclusion. The new concession also uses “elapsed waiting time” instead of the verified elapsed interval/numerical threshold distinction. A relevant unresolved location question is present. |
| Rider missing input | Pass | Pass, unchanged in substance. Requests identified evidence and policy, makes no decision, and explicitly avoids invalidating the request. |
| Rider standalone rebuttal | Fail | **Citation-schema failure.** The second claim is a standalone TEST-P2 policy summary with `evidenceIds: []`. Review reasoning and the other claims are supported, and its factual concessions are grounded in TEST-E2/TEST-E4 rather than invented prior history. The baseline had no empty citation arrays. |
| Rider rebuttal with own brief | Pass | Core semantics pass. Correctly links unavailable location records to mandatory review; own concessions are preserved exactly. The second claim is a redundant general policy statement, although it cites TEST-E5/TEST-P2. No invented threshold trigger or automatic reversal. |
| Driver brief: location uncertainty | Pass | Pass in substance. Distinguishes verified elapsed time from unverified pickup location, cites the review trigger, and includes the decisive location question. Concession attribution improves over baseline: it now says “The rider's account indicates...” rather than treating the rider account as established fact. The duration comparison should consistently be called numerical, but the location condition is explicitly unresolved. |
| Driver missing input | Pass | Pass, unchanged in substance. Requests identified evidence and policy without ruling on the fee. |
| Driver standalone rebuttal | Pass | Pass in substance. Acknowledges material uncertainty and mandatory review; it does not infer automatic reversal or dismiss the driver's reported account solely because records are unavailable. The baseline's overbroad “corroborated” waiting wording is absent. Its factual concession is supported by TEST-E5 and does not claim an earlier brief. |
| Driver rebuttal with own brief | Pass | Pass. Clearly rejects automatic reversal from missing records, cites the material gap, keeps elapsed time separate from location verification, and preserves its own concessions exactly. |
| Judge missing input | Pass | Pass, unchanged in substance. Requests identified case evidence, policy, both briefs/rebuttals and needed calculations. No unsupported financial ruling. |
| Judge reversal | Pass | Pass. Verified correct-location waiting is 240 seconds, below the required 480; REV-E5 supports the 500-cent reversal. Policy applications and citation summaries support the outcome. No action is claimed executed. |
| Judge location uncertainty | Pass | Core semantics pass. Review/zero adjustment is supported and the unresolved pickup-location question is present. Two general policy-summary findings are redundant under the prompt's case-specific-claim instruction; one cites the fee ledger for a statement primarily about the rule. The final combined finding correctly ties TEST-E4/TEST-E5 to TEST-P1/TEST-P2, so the decisive reasoning remains grounded. |
| Judge uphold | Pass | Pass. Authenticated continuous correct-location records plus the backend's 480-second wait satisfy UP-P1; the recorded charge/zero-adjustment fact is cited. Complete citation summaries and no invented uncertainty. |

No external-call error, invented identifier, cross-case fact, fabricated executed refund, or reputation-based inference was found. All three Judge outcomes remain supported in this run. The Rider brief's unsupported position and standalone rebuttal's empty evidence citation mean the full prompt regression suite is not cleanly passing, even though most individual cases retain correct reasoning.
