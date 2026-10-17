# Semantic review of focused prompt candidates

Reviewed `prompt-regressions-2026-10-15T17-47-27.670Z.json`, completed 2026-10-15T17:48:37.359Z. All 12 requests completed and all 12 machine checks passed. The 12 user input strings were compared directly with `prompt-regressions-2026-10-15T17-38-50.725Z.json` and are identical. That prior run had 10 machine passes, with Rider standalone and Judge uncertainty failures.

This run uses the focused prompt candidates below. The previously reported application settings were unchanged: temperature 0.1 for all three applications and Judge Deep Thinking enabled in both model slots. The remote settings are user-reported; prompt versions are attested by the saved hashes.

- Rider: `sha256:4d817e0e51a44ad4b1bb0dab19db82ef8a68dc01982fedaf4f271c68fa1208a9`
- Driver: `sha256:57000654fd119ecb283d4506ce60a803e0784b7c9e7ad426aca51a551333d256`
- Judge: `sha256:af63e502b008ab6cb6d4041f0187ed971d56ab9ad028df03f6dbc5c88443f5f8`

All 12 responses pass the core semantic assessment for supported facts, policy decision path, input gates and concession handling in this run. The previous empty-citation defects are resolved without padding policy-only statements with unrelated evidence IDs. Minor framing issues are recorded below rather than concealed. This is one successful regression run, not a repeatability guarantee or an assessment of the separate sample-case run.

| Test | Assessment |
| --- | --- |
| Rider brief: location uncertainty | Core pass. The first claim expressly distinguishes numerical satisfaction of the elapsed-time threshold; the second ties unavailable location records to TEST-P2. Driver account remains attributed, and the unresolved question concerns actual pickup presence. Minor framing: the ledger's existence is placed in adverse evidence even though it is procedural context, not proof that the charge is valid. “The charge cannot be validated” is understandable as the pending-review status here, but “cannot yet be validated automatically” would state that limitation more precisely. No refund entitlement or permanent invalidity is asserted. |
| Rider missing input | Pass. Requests identified evidence and policy in plain language, makes no decision, and explicitly states that inability to assess does not invalidate the request. |
| Rider standalone rebuttal | Pass. The former empty-ID policy summary is replaced by a case-specific application: the documented location gap triggers TEST-P2, with TEST-E5 cited. There are no invented citations or prior concessions. Empty concessions are allowed for a standalone argument with no own brief. |
| Rider rebuttal with own brief | Pass. Explains both the elapsed calculation's limitation and the unavailable location records, applies the review rule with the supporting records, and preserves both supplied own concessions exactly. No automatic fee determination is inferred. |
| Driver brief: location uncertainty | Pass. Uses the verified elapsed interval and ties the required-location gap to the applicable rules. Rider account remains attributed in the adverse evidence and concession. The question concerns the unresolved physical location during the interval. |
| Driver missing input | Pass. Correct identified-evidence/policy request with no fee decision. |
| Driver standalone rebuttal | Pass. Acknowledges the valid location uncertainty and correctly rejects an automatic reversal in favor of mandatory review. Its standalone concession is grounded in the supplied record and does not assert an invented earlier brief. |
| Driver rebuttal with own brief | Pass. The response and case-specific claims establish the review path, rather than endorsing the opponent's reversal conclusion. Both supplied own concessions are retained exactly. |
| Judge missing input | Pass. Requests case evidence, policy, both briefs/rebuttals and needed calculations; no invented outcome. |
| Judge reversal | Pass. Verified 240-second correct-location waiting falls below REV-P1's requirement. REV-E5 supports the 500-cent reversal amount and is included in the summary. The reversal condition is established by the earlier timing findings; the monetary/policy finding uses the actual monetary record rather than an unrelated citation. |
| Judge location uncertainty | Pass. Former empty-ID policy summaries are removed. TEST-E5 directly supports the case-specific review application, while TEST-E4 is accurately described as elapsed time. The previously empty uncertainty array now asks the decisive location question. Review with zero adjustment is supported. |
| Judge uphold | Pass. The supplied backend fact explicitly verifies waiting at the required location, satisfying UP-P1. The ledger/zero-adjustment fact is cited. No material unknown is invented, so the empty uncertainty array is appropriate. |

No empty evidence citations, unrelated citation padding, fabricated identifiers, unsupported actor attribution, cross-case imports, or executed financial actions were found. Judge citation summaries include the IDs used by the findings, and the proposal amounts agree with the supplied calculations. No evidence-backed question is replaced with a procedural question already resolved by policy.

The raw report remains unchanged. This review read final outputs and recorded test inputs only; it made no provider calls or further prompt/code edits.
