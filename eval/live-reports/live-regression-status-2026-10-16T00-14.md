# LLM regression results — 16 October 2026

**The live regression run is not passing.** The local backend tests are green, but the live LLM still produces incomplete responses, invalid citations and contradictory policy conclusions.

This batch began at approximately 8:14 a.m. Singapore time and started 20 calls to the configured Tencent applications. There were no retries or prompt changes.

## Results at a glance

| Check | Result |
| --- | --- |
| Prompt regression scenarios | 7 passed automated checks, 1 failed, 4 returned no complete answer |
| Full dispute scenarios | 0 of 3 reached a final decision |
| Backend tests | 278 of 278 passed across 21 test files |
| Build | Passed |
| Offline policy expectations | 3 of 3 passed |

An incomplete answer is not evidence of a wrong decision, but it prevents the scenario from passing. Automated checks alone do not establish correct reasoning; the available answers were also inspected for substantive errors.

## Prompt regression findings

All four Rider scenarios passed automated checks and had supported core reasoning. There is one minor classification issue: the Rider brief lists the existence of the charge as adverse evidence, although a recorded charge does not prove that it is valid.

The Driver brief correctly recommends human review and distinguishes the recorded elapsed time from verified presence at the pickup location. It does not repeat the previous unsupported assertion that the two parties' accounts necessarily contradict each other. The Driver missing-input response correctly requests evidence and policy. The Driver rebuttal supplied with its own prior brief correctly recommends review and preserves both prior concessions.

**The standalone Driver rebuttal failed.** It endorses reversing the fee while also stating that the location uncertainty requires human review. It also includes a policy-only claim without a required evidence citation, so its output fails validation.

**All four Judge scenarios returned incomplete responses.** The service acknowledged the requests and ended the streams without a final answer. This affected the missing-input, reverse-fee, location-uncertainty and uphold-fee tests. The recorded error is `ADP_STREAM_INCOMPLETE`; the underlying cause has not been established.

## Full dispute findings

### No-show fee — DISP-002

The case stopped at the Rider brief because two claims lacked required evidence citations (`INVALID_AGENT_SCHEMA`). Neither rebuttal nor the Judge stage was reached.

The Rider also recommended mandatory human review without a supported policy trigger, despite acknowledging sufficient waiting and contact attempts. The supplied policy does not add an independent rider-location verification requirement.

The Driver brief supported retaining the fee using the 360-second policy-eligible interval, pickup GPS samples, required contact attempts and identified cancellation actor. However, its broad assertion that there was no safety allegation cited only the trip record, which does not substantiate that assertion across the evidence bundle.

### Surge differential — DISP-003

The Rider brief and rebuttal correctly supported refunding the verified S$4.50 surge differential. They used the explicit lack of notification and the verified calculation showing that other fare components were unchanged. The rebuttal preserved the prior concession.

**The Driver brief contradicted its own evidence and policy citations.** It recommended retaining the fare and denied refund entitlement while acknowledging both the lack of notification and the rule requiring a differential refund.

The Driver rebuttal returned no complete answer (`ADP_STREAM_INCOMPLETE`), so the Judge stage was not reached.

### Route deviation — DISP-001

Both initial briefs failed without complete answers (`ADP_STREAM_INCOMPLETE`). No later stage was reached, and there is no model reasoning to assess for this case.

## Current priorities

1. Diagnose why acknowledged requests end without final model answers.
2. Eliminate claims that omit required evidence citations.
3. Resolve Driver conclusions that contradict mandatory review or refund rules.

All three system prompt hashes match the preceding live regression batch. This run does not establish a complete pass or reliable repeated performance. Earlier attempts made in the restricted environment failed immediately with connection errors; those records remain separate from this authorized live batch.

## Raw test records

- [Prompt regression inputs, outputs and automated checks](prompt-regressions-2026-10-16T00-14-46.233Z.json)
- [Full dispute inputs, available stage outputs and failures](ryde-v21-2026-10-16T00-14-58.787Z.json)

The raw records are unchanged. This report reviews the available responses; missing stages remain unassessed.
