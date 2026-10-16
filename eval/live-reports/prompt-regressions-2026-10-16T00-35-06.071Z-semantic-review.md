# Restored checkpoint regression semantic review

Reviewed [the complete raw report](prompt-regressions-2026-10-16T00-35-06.071Z.json), completed at 2026-10-16T00:38:09.929Z. All 12 requests completed and all 12 automated checks passed. The raw report SHA-256 is `7514be459e4dc77ad883162a6ffc636e286c9716866282114f1e2f210b5c964a`.

All twelve user input strings, expected-check definitions, and all three system prompt strings exactly match the earlier passing `prompt-regressions-2026-10-15T17-47-27.670Z.json` checkpoint. This review read the supplied inputs and final answers without changing either or making provider calls.

**The core policy decisions, missing-input gates and concession handling pass this review, with minor wording and citation-precision caveats.** This is not an all-stage audit of the separate sample dataset and does not establish repeated model reliability. The preceding restoration run's two incomplete ADP deliveries remain preserved separately.

| Scenario | Semantic assessment |
| --- | --- |
| Rider brief: location uncertainty | Correctly recommends mandatory review and cites the location gap and TEST-P2. The elapsed interval is explicitly described as only numerically satisfying the threshold. Minor caveats: the existing charge is classified as adverse evidence although its existence does not prove validity; the question loosely says "waiting period" rather than "elapsed interval." "Cannot be validated" is contextualized by review, rather than a reversal award. |
| Rider missing input | Requests identified evidence and policy in plain language, without a verdict, and explicitly states that missing input does not invalidate the request. |
| Rider standalone rebuttal | Challenges automatic retention, applies TEST-P2 to TEST-E5 and preserves valid elapsed-time and attributed-driver-account points. No missing location record is treated as proof of wrongdoing. |
| Rider rebuttal with own brief | Correct review path and supported citations. Both original concessions are retained. |
| Driver brief: location uncertainty | Correctly separates the verified elapsed interval from unverified pickup presence, attributes the rider's account, and asks the decisive location question. Does not invent a contradiction between the parties' accounts. |
| Driver missing input | Requests identified evidence and policy without endorsing fee retention or inventing a partial brief. |
| Driver standalone rebuttal | Correctly rejects automatic reversal from the missing location record and recommends required review. Retains the valid location gap. |
| Driver rebuttal with own brief | Does not equate elapsed time with verified waiting. Applies the review rule and retains both supplied concessions. |
| Judge missing input | Requests identified evidence and policy, both briefs and rebuttals, and needed calculations. No invented outcome. |
| Judge reversal | Correctly proposes reversal of 500 cents because the verified 240-second duration falls below the requirement. Does not claim a refund was executed. Minor citation precision: the first finding adds "from arrival to cancellation" while citing only REV-E4; REV-E3 explicitly supplies those anchors. The duration and amount remain supported by the cited records. |
| Judge location uncertainty | Correctly proposes human review with zero adjustment, cites the actual location gap and applicable rules, and records the unresolved pickup question. The question's "waiting period" wording is loose, but the explanation and findings expressly distinguish elapsed time from verified location. |
| Judge uphold | Correctly retains the existing fee with zero adjustment using UP-E4's explicit verified duration at the required location and UP-E5's ledger calculation. No material uncertainty is invented. |

Every structured entry has supplied evidence identifiers; no invented identifiers, cross-case facts, executed financial actions or unsupported automatic remedy from missing records was found. The Judge summaries include their finding citations and the amounts match the supplied calculations. The minor caveats above remain visible rather than being treated as proof of a fully reliable system.

Application settings were not independently verified by this semantic review. The raw report attests the prompt strings; it does not establish the published ADP configuration.
