# FareEnough completion task list

Updated for the `Integration` branch on 2026-10-15. Architecture diagrams are tracked separately.

## Implemented and verified

- [x] Rider/driver intake, ownership controls, duplicate protection, role-safe projections, and retained input.
- [x] Five-stage agent workflow: two independent briefs, two rebuttals, and one Judge proposal.
- [x] SQLite persistence, refresh/restart recovery, progress events, audit history, exports, and Admin decisions.
- [x] DISP-002 deterministic 480-second no-show validation and bounded simulated fee treatment.
- [x] Synthetic route/ERP vertical slice with route/reference records, consent, fare/payment/gantry evidence, deterministic differences, and an exact 325-cent capped simulated refund.
- [x] Complete decision vocabulary and invariant checks for no-change, refund, voucher, partial, and human-review outcomes.
- [x] Backend confidence rubric using the disclosed 35/30/25/10 weights; confidence is labelled as profile support, not truthfulness.
- [x] Separate allowlisted rider and driver explanations, strongest opposing-evidence treatment, limitations, citations, and policy labels.
- [x] Separate organizer, public Ryde, and synthetic route policy bundles; no silent profile mixing.
- [x] Route-aware support UI, evidence inspector, confidence breakdown, queue search/filters, mobile layout, and keyboard evidence access.
- [x] Hackathon demo experience: honest guided presets, evidence timeline, schematic route comparison, visible five-stage deliberation, deterministic safeguard panel, and collapsed deep analysis.
- [x] Request/run rate limits, provider concurrency and call budgets, strict schemas, citation validation, timeouts, prompt-injection boundaries, and secret-safe errors.
- [x] Offline verification: TypeScript build, backend tests, frontend tests, and desktop/mobile Playwright journeys.
- [x] Live Tencent validation: three no-show runs and one route/ERP run; sanitized results are in `eval/LIVE_VALIDATION_2026-10-15.md`.
- [x] Credentials live only in ignored `backend/.env`; configured key values were not found in tracked files.

## Known release limitation

- [ ] Improve and re-evaluate live no-show stability. All three runs completed, but only one auto-validated; two conservatively entered human review. Do not enable live mode by default or claim stable automatic agreement yet.
- [ ] Run a larger labelled live evaluation if credits/time permit. The single successful live route run is not enough for a statistical claim.

## Submission work still requiring the team

- [ ] Prepare the architecture diagram, exact-16:9 cover image, short blurb, full project description, and optional fallback video.
- [ ] Capture at least three genuine CodeBuddy/WorkBuddy screenshots with no keys or personal data visible.
- [ ] Rehearse the no-show, route/ERP rider win, and human-review walkthroughs.
- [ ] From a fresh checkout, add `backend/.env`, install dependencies, and rerun `npm run build`, `npm test`, `npm run test:frontend`, and `npm run test:e2e`.
- [ ] Disclose replay mode, simulation-only money, synthetic data, demo authentication, local-only rate limits, and the measured live no-show inconsistency.

## Recommended demo setting

Keep `AI_MODE=replay` while setting up and rehearsing. Switch deliberately to `AI_MODE=live` only for the live segment, because it spends credits and the no-show model currently escalates inconsistently. The route replay remains a deterministic presentation fallback and must be labelled Replay.
