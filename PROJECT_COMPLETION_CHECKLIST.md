# FareEnough Project Completion Checklist

Current branch: `feat/adp-live-integration`

The live Tencent ADP adapter is already implemented. Adding the three ADP AppKeys will enable live mode, but the project still has several functional and submission requirements before it should be considered complete.

The largest missing requirement is support for the second dispute category. The current implementation covers only the seeded `DISP-002` no-show dispute, while the SRS requires both selected categories to work end to end.

## 1. Required Product Work

### P0 — Complete before presentation readiness

- [ ] **Route/ERP dispute vertical slice**
  - Create a clearly labelled synthetic route-dispute fixture.
  - Include actual GPS points and a reference route.
  - Include quoted fare, paid fare and individual fare/ERP lines.
  - Calculate route distance, duration and ERP differences deterministically.
  - Run the same Rider Advocate, Driver Advocate, rebuttal and Judge workflow.
  - Validate the proposed financial adjustment in backend code.
  - Demonstrate a case where the rider receives a precise simulated adjustment.

- [x] **Human-review workflow (existing organizer no-show scope)**
  - Add a review queue for uncertain, invalid or failed runs.
  - Display the machine proposal, if one exists.
  - Display the blocking reasons and incomplete evidence.
  - Implemented on the separate Admin decisions page: close without adjustment or reverse the verified SGD 5.00 organizer no-show fee. Unsupported financial profiles remain unavailable.
  - Allow a reviewer to choose a supported disposition and action.
  - Require a reviewer rationale.
  - Validate currency, non-negative amounts, paid-amount caps and duplicate adjustments.
  - Preserve the original machine proposal rather than overwriting it.
  - Keep all financial effects simulation-only.

- [ ] **Rider complaint intake**
  - Let the rider select one of their seeded trips.
  - Let the rider choose the dispute category.
  - Accept and validate the rider complaint.
  - Create the case and run through the backend.
  - Prevent duplicate case submissions.
  - Preserve rider input after recoverable failures.

- [ ] **Persistent case and run retrieval**
  - Add endpoints for retrieving a case, its latest run and its outcome.
  - Restore completed results from SQLite after a browser refresh.
  - Allow support to inspect previous runs and their artifacts.
  - Do not rerun agents merely because the page was refreshed.

- [ ] **Safe party explanations**
  - Build rider and driver explanations from validated, allowlisted facts.
  - Include the decision, financial effect, decisive evidence and policy reference.
  - Explain how the strongest opposing evidence was handled.
  - Avoid accusatory wording.
  - Do not copy unrestricted Judge prose directly into the rider response.

### P1 — Complete for a strong, defensible project

- [ ] **Server-side demo personas and ownership**
  - Create explicit rider and support demo sessions.
  - Enforce rider ownership in backend handlers.
  - Prevent riders from accessing other cases or support-only information.
  - Label the persona system as demonstration access, not production authentication.

- [ ] **Live progress events**
  - Persist agent events before displaying them.
  - Add polling or Server-Sent Events for in-progress runs.
  - Show evidence retrieval, brief submission, rebuttal, Judge proposal and validation.
  - Allow reconnection by event sequence without re-running the agents.

- [ ] **Evidence inspector**
  - Make citation pills clickable.
  - Open the exact GPS, chat, app event, derived fact or policy rule.
  - Show source, timestamp, provenance and visibility classification.
  - Show the inputs and calculation version for derived facts.
  - Treat broken or unknown citations as validation failures.

- [ ] **Human-readable agent timeline**
  - Replace internal names such as `rider_brief_started` with readable labels.
  - Distinguish started, completed, blocked and failed stages.
  - Show concise summaries without exposing chain-of-thought or raw provider responses.

- [ ] **Failure and restart recovery**
  - Mark interrupted active runs as failed/review-required during startup.
  - Preserve partial completed artifacts from failed runs.
  - Never silently switch from live mode to replay mode.
  - Allow a fresh explicit run with a new run ID.

- [ ] **Deterministic confidence rubric**
  - Calculate evidence coverage.
  - Calculate corroboration quality.
  - Calculate policy coverage.
  - Persist the component inputs.
  - Explain that confidence measures support under the selected profile, not truthfulness.
  - Do not automatically display 100% merely because a result passed validation.

- [ ] **Public Ryde policy profile**
  - Add a separate `ryde-public-2026-10-07-v1` policy bundle.
  - Keep it isolated from the organizer DISP-002 policy.
  - Implement the published 661-cent no-show amount where applicable.
  - Implement the strict `>180 seconds` condition.
  - Send unsupported services and unresolved early-arrival clocks to review.
  - Clearly label official rules, organizer rules and demo interpretations.

- [ ] **Exports**
  - Add a support JSON export containing evidence references, policy version, arguments, decision, confidence, action, execution mode and human override.
  - Add a rider-safe export containing only the public rider projection.
  - Ensure exports do not contain secrets, prompts, internal notes or counterpart history.

## 2. Live AI Readiness

- [ ] Add the three ADP AppKeys only to the ignored backend environment file.
- [ ] Confirm that each ADP application is published and available.
- [ ] Confirm that the Rider Advocate, Driver Advocate and Judge use separate applications and conversations.
- [ ] Perform repeated live runs rather than relying on one successful response.
- [ ] Confirm that citations and monetary outcomes remain stable across runs.
- [ ] Confirm that timeouts and malformed results visibly enter human review.
- [ ] Record provider/model, prompt, policy and fixture versions for evaluated runs.
- [ ] Track latency and provider usage where the API exposes it.

### Current live-result concern

Recorded live DISP-002 runs are not yet fully consistent:

- One live run produced `uphold_fee` and passed deterministic validation.
- A later live run produced `human_review` because the model treated the rider-location disagreement as materially unresolved.

This does not mean the answer key should be inserted into the prompts. The prompts and policy materiality rules should instead make clear which uncertainties change the configured organizer-profile result and which uncertainties are acknowledged limitations.

See `eval/adp-live-disp002-revised-result.json` for the recorded assessment.

## 3. Demonstration Scenarios

The final walkthrough should show three meaningfully different outcomes.

### Scenario A — Organizer no-show case

- [ ] Run `DISP-002` in Live AI mode.
- [ ] Show the Rider Advocate's strongest objection.
- [ ] Show the Driver Advocate's GPS, contact and waiting evidence.
- [ ] Explain the explicit 480-second organizer interpretation.
- [ ] Show the Judge proposal and deterministic validation.
- [ ] Show that keeping the original fee creates no additional charge or fake transaction.

### Scenario B — Route/ERP rider win

- [ ] Show actual and reference routes.
- [ ] Show that a rider-approved route change settles the route allegation.
- [ ] Show an independently unsupported 325-cent ERP entry.
- [ ] Produce an exact 325-cent simulated adjustment.
- [ ] Cite the route, consent, receipt and gantry evidence.

### Scenario C — Human review

- [ ] Use missing, contradictory or unreliable material evidence.
- [ ] Show the agents acknowledging the uncertainty.
- [ ] Show the deterministic gate blocking automation.
- [ ] Record a reviewer decision and rationale.
- [ ] Demonstrate that abstaining is safer than inventing facts.

## 4. Submission Materials

- [ ] **Architecture diagram** matching the implemented system.
- [ ] **16:9 cover image**, preferably `1280×720` unless the portal specifies otherwise.
- [ ] **Short blurb under 10 words**.
  - Proposed: `Fair ride dispute resolutions backed by clear evidence.`
- [ ] **Full project description** covering:
  - User problem and observed pain points.
  - Rider and support journeys.
  - Three-agent design.
  - Evidence and policy architecture.
  - Deterministic financial safeguards.
  - Human-review behavior.
  - Measured evaluation results and limitations.
- [ ] **Rehearsed live walkthrough**.
- [ ] **Clearly labelled replay fallback** matching the demonstrated fixture and prompt versions.
- [ ] **Optional 5–8 minute video** as a fallback.
- [ ] **Complete GitHub repository** with setup instructions and sanitized fixtures.
- [ ] **Final CodeBuddy/WorkBuddy evidence**:
  - At least three genuine screenshots.
  - Conversation history retained.
  - Explanation of the meaningful implementation work performed with the tool.
  - No secrets or personal data visible.

## 5. Evaluation and Release Work

- [ ] Record how many scenarios were evaluated and their composition.
- [ ] Measure agreement with reviewed expected outcomes.
- [ ] Measure exact monetary correctness.
- [ ] Measure decisive citation coverage.
- [ ] Measure correct escalation for uncertain cases.
- [ ] Review explanation completeness and respectful language.
- [ ] Run identity/history counterfactuals.
- [ ] Run prompt-injection and invalid-citation scenarios.
- [ ] Check desktop layout at `1366×768`.
- [ ] Check rider flow at `390px` width.
- [ ] Complete keyboard-only navigation.
- [ ] Verify that no secrets, answer keys or restricted profile data cross the wrong boundary.
- [ ] Verify a fresh checkout using the documented setup commands.

Required operational scripts still include an end-to-end browser test command such as `npm run test:e2e` and a safe local reset/export procedure.

## 6. Recommended Implementation Order

1. Build the route/ERP vertical slice.
2. Build the human-review workflow.
3. Add rider intake and server-side ownership.
4. Add persistent case/run retrieval.
5. Add safe party explanations and evidence inspection.
6. Add live progress and restart recovery.
7. Add the confidence rubric and public Ryde policy profile.
8. Prepare the architecture diagram and submission material.
9. Complete repeated live evaluation and the final release checks.

## 7. Definition of Complete

FareEnough should be considered complete when:

- Both no-show and route/ERP categories work from complaint to outcome or review.
- All three agents make real model calls in Live AI mode.
- Replay mode remains available and is always clearly labelled.
- Evidence and policy citations resolve to inspectable records.
- Financial calculations and actions are validated by deterministic backend code.
- Human review works as a real persisted workflow.
- Completed cases survive process and browser restarts.
- Rider and support data boundaries are enforced server-side.
- Live, replay, human-review and failure states are visibly different.
- Submission materials and genuine CodeBuddy/WorkBuddy evidence are ready.
- Known limitations are disclosed honestly.

For the authoritative requirements, see `SRS.md`, especially sections 3–17 and the hackathon deliverables in section 18.
