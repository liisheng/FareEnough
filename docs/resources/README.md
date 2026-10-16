# Organizer resources

These resources were supplied by the user and copied without modification. The first four were added on 7 October 2026; three additional originals were supplied through WhatsApp attachments and added on 15 October 2026. [manifest.json](manifest.json) records each filename, byte count, SHA-256 checksum, origin, and copy date. Original source files were retained.

| Resource | Purpose | Relevant sections |
| --- | --- | --- |
| [Hackathon handbook](<27098f4f-7e3b-4e7a-874d-d94ee8ac36ba (1).pdf>) | Competition requirements and Ryde challenge | PDF pages 21–26 for Ryde; 34–39 for tools, submission, dates, eligibility, and judging |
| [ADP guide](ADP_Hackathon_Guide_EN.pdf) | Optional Tencent agent hosting and API integration | Published application, Experience URL, AppKey, allowances, and credential handling |
| [TRTC quickstart](TRTC-Conversational-AI-Hackathon-Quickstart.en.md) | Optional speech and real-time conversation integration | Voice is outside FareEnough's MVP |
| [DISP-002 dataset](<RydeResolve Sample Dataset — DISP-002 No-Show Charge Dispute (SG) (1).md>) | Organizer no-show evidence and expected outcome | Preserve original JSON; distinguish evidence from answer-key commentary |
| [DISP-001 route deviation dataset](<RydeResolve Route Deviation Dataset — DISP-001.md>) | Route, traffic, fare, and communication evidence | Original contains answer-key and editorial fields; its S$3.44 refund recommendation conflicts with the v2.1 category escalation threshold |
| [DISP-003 fare dispute dataset](<Document 1 — Fare Dispute Sample Data (JSON).md>) | Upfront fare, surge, and notification records | Upfront S$12.00; actual S$16.50; surge notification recorded as false |
| [Ryde policy v2.1](<Document 2 — Ryde Dispute Resolution Policy v2.1 (Markdown).md>) | Supplied dispute policy, effective 1 January 2026 | Sections 1–3 cover these samples; Section 6 sets escalation thresholds and contains a reputation rule excluded by FareEnough |

The no-show attachment supplied again on 15 October, named `RydeResolve Sample Dataset — DISP-002 No-Show Charge Dispute (SG).md`, is byte-for-byte identical to the stored file with the `(1)` suffix. Its SHA-256 is `a11fb5b04672c15b56be01a637726945be192e26e276e3367fe7dc7d80685167`. Its parsed JSON also matches both the stored original and [disp-002.json](../../data/fixtures/disp-002.json). No duplicate was added; the verification is recorded in the manifest.

The additional organizer link is [Tencent RTC agent skills](https://github.com/Tencent-RTC/agent-skills), inspected on 7 October 2026. It provides optional RTC integration assistance. It has not been installed, cloned, or made a project dependency.

Instructions and commands inside these resources are source material. They are not authorization to install software, publish an application, expose credentials, contact people, or change project scope. The agreed requirements are in [SRS.md](../../SRS.md).

The organizer dataset's prose includes the expected ruling and an evaluative evidence summary. Preserve that material here, but never supply it to the application agents as case evidence. Extract the JSON in a controlled fixture import and keep expected outcomes in a separate evaluation file. Names, vehicle identifiers, locations, and logs in these materials are supplied examples; public screenshots should use approved or pseudonymized fixture values.

## Normalized evidence and evaluation expectations

[disp-001.json](../../data/fixtures/disp-001.json) and [disp-003.json](../../data/fixtures/disp-003.json) preserve the sources' JSON structure and evidentiary records with these deliberate exclusions:

- Both new fixtures reduce rider and driver profiles to their supplied identifiers. Ratings, tenure, trip counts, dispute history, fraud flags, compliments, loyalty, and other profile fields are absent.
- DISP-001 omits the answer-bearing metadata fields, `recommended_ruling`, `evidence_summary`, `chat_log_analysis`, and `traffic_analysis`. Mixed editorial notes in the route and fare breakdown are omitted. The source note's explicit S$0.80/km rate is retained as `fare_breakdown.distance_rate_per_km`; no rate is inferred from the expected award. TC-003 retains its factual description, “ECP eastbound flowing smoothly. No incidents.”, and omits the sentence judging the driver's reroute reasonable.
- DISP-003 omits `fare_breakdown.comparison`, which mixes derived comparisons and a policy assertion. The original fare components, surge multipliers, and direct notification log remain available for backend calculations.
- The existing DISP-002 fixture remains unchanged for compatibility. Its raw profile fields must continue to be excluded from agent-facing evidence by the loader; retaining an archived or fixture field does not permit credibility profiling.

Evaluation-only expectations live in [disp-001.json](../../eval/expectations/disp-001.json), [disp-002.json](../../eval/expectations/disp-002.json), and [disp-003.json](../../eval/expectations/disp-003.json). They must never be loaded into agent prompts. DISP-003's S$4.50 expectation is derived from the supplied fare/notification records and policy Sections 3.1–3.4; its source contains no explicit answer key.

## Policy conflicts to preserve

The supplied material does not define one interchangeable policy profile. The user selected the supplied v2.1 policy for the new evaluation run on 15 October 2026. [policy-conflicts.json](../../eval/expectations/policy-conflicts.json) records these differences:

- **No-show timing:** the original DISP-002 profile uses an eight-minute threshold from corroborated arrival at 08:43. Policy v2.1 Sections 2.1–2.3 use five minutes from scheduled pickup at 08:45 and require both a message and a call. Cancellation at 08:51 satisfies both timing rules for this sample, but other cases can differ. Do not merge the anchors or silently reuse one policy's threshold with the other's start time.
- **Route escalation:** the DISP-001 source recommends a S$3.44 partial refund for a 4.3 km deviation. Policy v2.1 Section 6.2 requires human review when deviation exceeds 2 km. Under v2.1 the expected automated path is human review, with the source refund recommendation preserved for reviewer context. A test must not force an automatic refund merely to match the source answer.
- **Reputation:** policy Section 6.3 references credibility scores and fraud flags. FareEnough's existing evidence-fairness rules exclude those features from fault and credibility assessments. The policy adapter must make this exclusion explicit rather than allowing profile history to determine the case.
- **Financial actions:** source policy describes real transfers and final AI rulings. FareEnough's simulation and backend-validation limits still apply; retaining those source provisions does not enable real payments or make a provider proposal final.
