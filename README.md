# FareEnough

FareEnough is a local hackathon prototype for fair, explainable ride dispute resolution. A Rider Advocate and Driver Advocate independently assess the same evidence, complete one rebuttal round, and present their cases to a Judge. Deterministic code then validates the proposed outcome before anything can be recorded as an action.

This prototype implements the seeded DISP-002 no-show dispute and a clearly labelled synthetic RydeX route/ERP dispute, with auditable replay and an optional Tencent ADP live adapter. Financial outcomes remain simulations. Live operation requires the three published ADP applications; supported cases start automatically after both accounts arrive; local automated tests use deterministic synthetic responses.

## Run the local demo

After installing dependencies, build and start the backend (startup applies database migrations):

```text
npm run build
npm start
```

In another terminal, start the frontend and open http://127.0.0.1:3000:

```text
npm run frontend
```

The combined responsive workspace has four role views:

- Rider: submit a complaint for the suggested organizer trip and see its saved status and outcome.
- Driver: submit an immutable account for an assigned case, with a neutral category summary and own-account export.
- Support: inspect both accounts, watch automatic Live AI progress, and inspect briefs, rebuttals, Judge proposal and validated result.
- Admin: inspect cases requiring a person and record a supported, simulated final decision.
- Guided demo: prepare the no-show, unsupported ERP, or safety-to-human-review story from one honest preset without bypassing the real workflow.
- Evidence story: read the operational sequence as a timeline, compare reference and actual routes in a schematic overlay, and see the deterministic safeguards that allowed automation or required a person.

Cases, accounts, progress and results are saved in SQLite and restored after refresh. Demo role sessions enforce assigned ownership and role-specific responses on the backend; the persona switch intentionally lets a local presenter assume any demo role and is not production sign-in. Rider and driver APIs/exports omit the opposing narrative and internal model artifacts. Original browser-local requests are not automatically uploaded or deleted.

### Connected walkthrough

1. Open Rider. A unique demo trip reference is filled automatically. Select No-show charge and submit your account. Each reference represents an independent copy of the organizer fixture; a fresh reference is prepared automatically after each successful submission. Failed submissions retain their reference for retry.
2. Open Driver. Select that case and submit the driver's account.
3. Submitting the second account automatically queues Live AI review (requires configured ADP). Open Support to watch progress; that page does not need to be open for the agents to run.
4. Support shows progress and all five artifacts: two briefs, two rebuttals and the Judge proposal. Return to Rider or Driver to see the saved, role-scoped outcome. Refresh retains the case and result.

Live review sends both new statements plus the category-matched evidence to all three agents. For submitted no-show cases, replay acknowledges the statements and requests human review instead of treating a prerecorded outcome as a fresh assessment. The synthetic route/ERP replay is deterministic: verified consent settles the route allegation, while complete payment and gantry records support an exact 325-cent simulated refund for the unsupported ERP line.

Unknown trips and safety-flagged cases are saved for human review without model execution. Automatic review supports the known no-show and synthetic route/ERP profiles after both accounts arrive. Missing responses do not imply fault. Completed cases cannot be adjudicated again; technical failures and interrupted cases can be retried explicitly. Completed live decisions requesting human judgment require a reviewer. A server restart marks queued and in-flight cases for review without automatically resuming model calls.

The Support interface offers live review only. Replay remains an internal testing API and is not offered in the review controls. Technical failures show an explicit retry action; completed live results requiring human judgment do not. Connection interruptions require checking the saved run state before another attempt. The support view enables Live AI only when the backend reports configured ADP access. No model call starts on page load or rider intake. The first saved driver response completes the pair and triggers automatic live review for supported cases. Duplicate responses never trigger another attempt. Cases queue behind active reviews, sharing the existing provider concurrency and call-budget limits. Technical failures retry after 2 and 5 seconds, up to three total attempts. At the limit, Support can click Retry AI review for one additional attempt. Configuration and usage-limit failures stop immediately and remain saved for explicit Support retry; they never fall back to replay. The result displays the actual run mode, and cases needing human review are labeled accordingly.

### Supplied policy v2.1 and regression evaluation

The additional organizer attachments are preserved under `docs/resources/` with SHA-256 hashes. The new runtime fixtures cover route deviation (DISP-001) and unnotified surge pricing (DISP-003); the re-supplied no-show document is identical to the existing DISP-002 source. Expected outcomes and editorial recommendations remain in `eval/` and are never sent to agents.

Select `REVIEW_POLICY_PROFILE=ryde-v2.1` in the server environment for future live no-show reviews to use the supplied policy. The compatibility default is `organizer-disp002-v1`; historical replay keeps that original profile. Each new run saves its actual policy version and evidence snapshot. Existing results are not re-labelled or overwritten. Interactive intake supports the organizer-backed no-show trip and the separate synthetic route/ERP scenario. The supplied v2.1 route-deviation (DISP-001) and surge (DISP-003) samples are evaluated through the fixture evaluator; selecting route in the interactive demo does not select DISP-001 or its policy.

Policy v2.1 uses five minutes from scheduled pickup plus both a message and an in-app call. The sample has 360 eligible seconds (480 seconds since arrival). The route sample's 4.3 km deviation exceeds v2.1's 2 km automatic-review limit, so its source S$3.44 refund recommendation is reviewer context rather than an automatic award. DISP-003 supports a S$4.50 surge-differential refund. Source Section 6.3's reputation-based calibration is deliberately excluded by FareEnough's existing fairness rules. No self-reported model confidence is accepted as a calibrated score; unsupported confidence-dependent cases require review.

Run `npm run eval:policy` to build and check all three deterministic policy expectations without network calls. After explicitly authorizing transmission of the sample evidence to the configured Tencent applications, run `node backend/scripts/evaluate-policy-fixtures.mjs --live --max-calls 15`. Use `--cases DISP-002` to evaluate only that sample. Each selected case makes at most five calls; there are no automatic retries. The evaluator saves each attempt, complete stage outputs, exact policy/evidence inputs, prompt hashes, checks and failures under `eval/live-reports/`. Passing outcome checks does not certify every factual claim or repeated model performance; inspect the artifacts for reasoning quality.

The v2.1 adapter and validator have independent tests for timing boundaries, contact omissions versus missing records, conflicting GPS and surge evidence, safety in submitted accounts, route/monetary thresholds, unknown citations and excessive refund proposals. Backend validation never changes a model's human-review request into an automatic award merely to match a test expectation.

At the user's request, the prompts and model inputs were restored to the earlier focused-validation checkpoint. A fresh complete run passed **12/12 regression checks and 3/3 sample final decisions**: retain the no-show fee, propose a S$4.50 surge reversal, and require route-dispute review. All fifteen sample stages completed. Some initial advocate arguments still contradict policy; these passing automated checks do not establish reliable reasoning at every stage. See the [restoration report](eval/live-reports/restored-checkpoint-2026-10-16.md), which preserves the prior incomplete attempt and remaining limitations. ADP settings were not changed during restoration.

The later [all-stage acceptance target](eval/all-stage-acceptance.md) and [projection/citation experiment](eval/experiments/checkpoint-successor/README.md) are preserved separately. They are not represented as satisfied by this restored checkpoint. Current reports separate final-decision checks, structural stage checks and semantic review. The optional review finalizer creates a separate hash-bound acceptance artifact and preserves failures: `node backend/scripts/finalize-policy-review.mjs --report <raw-report.json> --review <semantic-review.json>`.

Run `npm run eval:prompts` for a no-network inventory of the 12 regression scenarios. After building, `node backend/scripts/evaluate-prompt-regressions.mjs --live --max-calls 12 --delay-ms 10000` runs them against the configured applications with the pacing used in the restored passing run. The delay is optional, is recorded in the report, and does not change inputs, assertions or retry failed requests. The six original advocate prompts and Judge missing-input prompt are preserved exactly; three reconstructed Judge scenarios and two own-brief rebuttal extensions are labeled explicitly. Reports retain raw responses, prompt hashes, machine checks and separate semantic-review status. A machine pass is not a guarantee of correct reasoning or future repeatability.

### ADP connection configuration

Copy `.env.example` to `backend/.env` (ignored by Git). Set `MODEL_PROVIDER=adp`, fill `ADP_RIDER_APP_KEY`, `ADP_DRIVER_APP_KEY`, and `ADP_JUDGE_APP_KEY`, and set `AI_MODE=live` when ready to enable external calls. Never put AppKeys in frontend files, screenshots, logs, or commits. Configuration prefers `backend/.env` and falls back to the repository root `.env` when that file is absent, independent of launch directory. Existing process environment variables take precedence. Relative database paths still resolve against the process working directory; use the npm scripts from the project root consistently.

Run `npm run build`, then `npm start` and `npm run frontend` in separate terminals. Submit both party accounts to start automatic review. Support can retry technical failures. Each run makes at most five ADP calls with separate conversations: two briefs, two rebuttals, and one Judge proposal. Every call receives the full case evidence and selected policy; only the appropriate prior arguments are included. The repository prompt is supplied through ADP's `SystemRole` parameter.

The three base prompt files retain the restored checkpoint text. Only the synthetic `demo-route-erp-v1` profile adds a Judge prompt appendix and response-contract extension for `refund_unsupported_charge`; the supplied v2.1 sample and regression inputs retain their checkpoint contracts.

The v2 SSE endpoint is restricted to `https://wss.lke.tencentcloud.com/adp/v2/chat`, following the [official HTTP SSE API](https://www.tencentcloud.com/document/product/1254/81449). Only the completed assistant reply is parsed. One enclosing JSON code fence is tolerated; arbitrary prose, plain-text clarifications, wrong roles, unknown citations (including adverse evidence), extra fields, and malformed proposals fail validation. Transport and validation failures leave no automatic financial decision, record a sanitized failed run, and never silently fall back to replay.

Limits are five calls per run, one concurrent live run, and at most 60 reserved calls per server process (configurable downward with `MAX_MODEL_CALLS_PER_SESSION`). Failed runs retain their five-call reservation. Restarting the process resets this counter. Per-call and run deadlines use `MODEL_CALL_TIMEOUT_MS` and `RUN_TIMEOUT_MS`, capped at 120 and 480 seconds. Input is bounded to 256 KiB per call and 1 MiB per run; SSE responses to 2 MiB per call; final answers to 120 KiB. Automatic workspace review allows three total attempts (up to 15 reserved calls), subject to the same session budget. The provider adapter itself does not retry. Successful human-review decisions are never retried automatically. These limits are not a billing ceiling; cancelling HTTP does not guarantee Tencent stops an already-started generation. Token and currency budget settings are not advertised because this adapter does not enforce them.

The local server also rate-limits callers in memory. By default, non-health API traffic is limited to 180 requests per minute and explicit AI-run starts to 6 per 10 minutes per caller. Configure these with `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`, `RUN_RATE_LIMIT_WINDOW_MS`, and `RUN_RATE_LIMIT_MAX_STARTS`. A rejected request returns HTTP 429 and `Retry-After`; limits reset when the single local server process restarts. This is suitable for the local hackathon demo, not a distributed production deployment.

For an explicitly authorized live smoke test, build first, then run `node scripts/live-adp-smoke.mjs --run` from `backend/`. It temporarily enables ADP for that process, sends the organizer sample for up to five calls, stores the usual local audit trail, and prints only status metadata. Without `--run` it makes no call. Live API verification is separate from passing offline tests.

The deterministic financial evaluator supports the seeded DISP-002 organizer profile and the synthetic `demo-route-erp-v1` profile. It validates zero/500-cent no-show treatment and the synthetic route scenario's exact 325-cent unsupported-line adjustment; route distance is never used as a refund formula. The selected v2.1 adapter separately adds the supplied sample cases within the limits described above; it does not establish coverage for arbitrary disputes. The `ryde-public-2026-10-07-v1` bundle records bounded public rules and limitations but is not silently substituted for a selected profile. Reported material uncertainty always blocks automatic validation.

Frontend files are organized as follows:

```text
frontend/
  index.html          Rider, driver, support and admin workspace shells
  styles/styles.css   Shared responsive workspace styling
  styles/experience.css  Guided evidence views, motion and responsive queues
  scripts/app.js      Evidence projections and review result rendering
  scripts/participation.js  API-backed intake, responses, progress and outcomes
  scripts/experience.js  Motion with reduced-motion support
  assets/             Reserved for images and other static assets
  serve.mjs           Local-only HTTP server
```

- [Software Requirements Specification](SRS.md): the authoritative implementation scope and acceptance criteria.
- [Implementation handoff](docs/IMPLEMENTATION_HANDOFF.md): where the next conversation should start.
- [Policy reference](docs/POLICY_REFERENCE.md): public Ryde policies, source links, limitations, and differences from the organizer sample.
- [Organizer resources](docs/resources/README.md): all four original attachments and their integrity manifest.

The agreed delivery is a live demonstration running locally. Rider and driver participation is included under the 12 October scope amendment. Public hosting, external notifications, real payment execution, and voice integration remain outside the MVP. Model API calls may still require internet access and separate credentials or credits.

Run `npm run test:frontend` for seeded UI contract and rendering checks. `npm test` also tests the actual participation scripts against Fastify and SQLite, including intake, response, all five controlled provider calls and refresh recovery, plus backend role/privacy and failure tests. Script tests use a DOM stub and do not replace visual browser testing or live model evaluation. Automated tests never load local credentials or call ADP.

The hackathon brief requires genuine CodeBuddy or WorkBuddy usage and evidence of that usage. This documentation does not satisfy that requirement by itself. See the submission checklist in [the SRS](SRS.md#18-hackathon-deliverables).

## Backend

The backend is a TypeScript Fastify server with SQLite persistence, Zod schemas, deterministic evidence calculations, bounded agent contracts and an auditable replay provider.

### Prerequisites

- Node.js 24 LTS (verified on v24.19.0)
- npm 11+ (verified on 11.17.0)
- Windows, macOS, or Linux

### Install

```text
npm install
```

If prompted, approve the install scripts for `better-sqlite3` (native SQLite binding) and `esbuild` (Vitest dependency):

```text
npm approve-scripts better-sqlite3
npm approve-scripts esbuild
npm install
```

### Commands

All commands are Windows-compatible and run from the project root.

| Command | Description |
| --- | --- |
| `npm run db:migrate` | Create the SQLite database at `.runtime/fareenough.sqlite` and apply migrations. |
| `npm run seed` | Run migrations (idempotent) and seed DISP-002 case data. Safe to re-run. |
| `npm run dev` | Start the Fastify dev server with hot reload on `http://127.0.0.1:3001`. |
| `npm run build` | Compile TypeScript to `backend/dist/` and copy SQL migration files via `scripts/copy-assets.mjs`. |
| `npm start` | Run the compiled server from `backend/dist/`. |
| `npm test` | Run the backend Vitest suite. |
| `npm run test:frontend` | Run the existing frontend logic tests (`node --test`). |
| `npm run test:e2e` | Build and run browser journeys with deterministic providers; no ADP calls. |
| `npm run eval:policy` | Build and check all three supplied policy sample expectations without network calls. |
| `npm run eval:prompts` | Build and list the 12 regression scenarios without model calls. |
| `npm run frontend` | Start the standalone frontend preview on `http://127.0.0.1:3000`. |

### Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Returns `{ status, database, provider, timestamp }`. Does not trigger model calls. |
| GET | `/api/cases/DISP-002/evidence` | Returns a safe case/evidence projection with derived facts. Strips historical rider/driver profile data. |
| POST | `/api/cases/DISP-002/runs` | Runs an explicit `{ "mode": "replay" }` or configured `{ "mode": "live" }` review, validates it and persists its audit trail. |
| POST | `/api/workspace/session` | Creates a local demo role session; disabled outside demo mode. |
| GET | `/api/workspace/trips` | Lists the rider's supported organizer demo trip. |
| POST | `/api/workspace/trips` | Allocates a unique organizer-backed demo trip reference; retries with the same request key return the same reference. |
| GET / POST | `/api/workspace/cases` | Lists role-scoped cases or creates a rider complaint with duplicate protection. |
| GET | `/api/workspace/cases/:id` | Restores the permitted case state; support also receives progress and internal artifacts. |
| POST | `/api/workspace/cases/:id/driver-response` | Saves the assigned driver's immutable response. |
| POST | `/api/cases/:id/runs` | Support-only review of a submitted supported case. The browser polls saved state while the request runs. |

### Three-agent baseline

- Rider Advocate and Driver Advocate receive independent initial contexts.
- Each advocate gets one rebuttal with both its own original brief and the other side's brief. Neither advocate sees the other's rebuttal; each can preserve its own concessions.
- The Judge receives both briefs and both rebuttals, then returns a structured proposal with evidence and policy citations.
- Zod checks every agent output and citation IDs are verified against case-scoped evidence tools.
- Deterministic code owns the 480-second threshold and S$5 reversal calculation. Uncertain, malformed, contradictory or uncited proposals go to human review.
- SQLite stores runs, artifacts, progress events and decisions. A valid no-change outcome does not create a fake financial transaction; reversals remain simulation-only.

### Derived facts

The waiting duration is calculated deterministically in code from the `driver_wait_start` (08:43:00+08:00) and `cancellation_time` (08:51:00+08:00) timestamps, producing **480 seconds** under the organizer profile (`organizer-disp002-v1`). The calculation uses epoch-millisecond difference, not a hardcoded value.

### Data layout

```text
data/
  fixtures/
    disp-002.json              Evidence only (no expected ruling or editorial summary)
    disp-001.json              Supplied route-deviation sample evidence
    disp-003.json              Supplied surge-charge sample evidence
    route-erp-001.json         Fully synthetic route, fare, consent and gantry evidence
  policies/
    organizer-disp002-v1.json  Policy bundle with rules, namespaces, and source IDs
    demo-route-erp-v1.json     Explicit demo interpretations for the synthetic route case
    ryde-public-2026-10-07-v1.json  Separate bounded public-rule profile
eval/
  expectations/
    disp-002.json              Answer key (never imported by runtime code)
    ryde-v21-suite.json        Three supplied v2.1 sample expectations
  LIVE_VALIDATION_2026-10-15.md  Sanitized measured ADP run summary
.runtime/                       SQLite database (gitignored)
```

### Backend structure

```text
backend/
  src/
    index.ts               Entry point
    server.ts              Fastify server factory and startup
    config.ts              Environment configuration (Zod-validated)
    routes/
      health.ts            GET /health
      cases.ts             GET /api/cases/:id/evidence
      runs.ts              POST /api/cases/:id/runs
    agents/                Prompts, structured schemas and five-call coordinator
    providers/             Provider interface, replay provider and ADP v2 SSE adapter
    tools/                 Case-scoped, read-only evidence/policy retrieval
    decisions/             Deterministic policy evaluator and safety validator
    persistence/           Atomic audit-trail persistence
    schemas/
      fixture.ts           Zod schemas for the DISP-002 fixture
      api.ts               Zod schemas for API responses
      derived-fact.ts      Zod schema for derived facts (SRS EVD-04)
    fixtures/
      loader.ts            Loads and validates disp-002.json
    calculations/
      waiting-duration.ts  Deterministic 480-second calculation
    projections/
      case-projection.ts   Safe projection (strips historical profiles)
    db/
      connection.ts        better-sqlite3 connection with WAL
      migrate.ts           Migration runner
      migrate-cli.ts       CLI: npm run db:migrate
      seed-cli.ts          CLI: npm run seed
      migrations/
        001-init.sql       Schema: cases, evidence_items, policy_bundles, derived_facts
        002-seed-disp002.sql  Idempotent seed for DISP-002
        003-agent-runs.sql    Runs, artifacts, events, decisions and simulated actions
  tests/
    fixture-validation.test.ts    11 tests
    waiting-duration.test.ts      10 tests
    answer-key-leakage.test.ts    10 tests
    health.test.ts                 1 test
    case-evidence.test.ts         Evidence endpoint tests
    agent-run-coordinator.test.ts Agent isolation, ordering and grounding tests
    decision-validator.test.ts    Deterministic guardrail tests
    run-persistence.test.ts       Atomicity and idempotency tests
    run-route.test.ts             End-to-end replay API tests
```

### Admin decisions

The former Support page is labelled **Review workspace**. **Admin decisions** (`/#admin`) lists cases needing human review or technical recovery and retains finalized cases. Admins inspect accounts and the original AI proposal, enter a required internal rationale, and either close without adjustment or reverse the verified organizer no-show fee (SGD 5.00, simulated only). Unsupported evidence cannot authorize a financial adjustment. Decisions are immutable, idempotent and stored separately from machine results; party views receive a safe final outcome without internal notes. Backend role checks restrict submission to the admin session. Like other local personas, this is not production authentication.
