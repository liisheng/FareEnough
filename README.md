# FareEnough

FareEnough is a local hackathon prototype for fair, explainable ride dispute resolution. A Rider Advocate and Driver Advocate independently assess the same evidence, complete one rebuttal round, and present their cases to a Judge. Deterministic code then validates the proposed outcome before anything can be recorded as an action.

This baseline implements the seeded DISP-002 no-show dispute with an auditable replay and an optional Tencent ADP live adapter. Financial outcomes remain simulations. Live operation requires the three published ADP applications; supported cases start automatically after both accounts arrive; local automated tests use synthetic responses.

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

The combined responsive workspace has three views:

- Rider: submit a complaint for the suggested organizer trip and see its saved status and outcome.
- Driver: submit an immutable account for an assigned case, with a neutral category summary and own-account export.
- Support: inspect both accounts, watch automatic Live AI progress, and inspect briefs, rebuttals, Judge proposal and validated result.

Cases, accounts, progress and results are saved in SQLite and restored after refresh. Demo role sessions enforce assigned ownership and role-specific responses on the backend; the persona switch intentionally lets a local presenter assume any demo role and is not production sign-in. Rider and driver APIs/exports omit the opposing narrative and internal model artifacts. Original browser-local requests are not automatically uploaded or deleted.

### Connected walkthrough

1. Open Rider. A unique demo trip reference is filled automatically. Select No-show charge and submit your account. Each reference represents an independent copy of the organizer fixture; a fresh reference is prepared automatically after each successful submission. Failed submissions retain their reference for retry.
2. Open Driver. Select that case and submit the driver's account.
3. Submitting the second account automatically queues Live AI review (requires configured ADP). Open Support to watch progress; that page does not need to be open for the agents to run.
4. Support shows progress and all five artifacts: two briefs, two rebuttals and the Judge proposal. Return to Rider or Driver to see the saved, role-scoped outcome. Refresh retains the case and result.

Live review sends both new statements plus the matching organizer evidence to all three agents. Submitted-case replay is an offline pipeline exercise: it acknowledges the statements and requests human review rather than applying the original fixture's prerecorded ruling to new accounts. The standalone DISP-002 walkthrough has been removed from the interface; the underlying fixture and policy remain the source for generated demo trips.

Unknown trips, route disputes and safety-flagged cases are saved for human review without model execution. Automatic review requires the known no-show trip and both accounts. Full route policy coverage and a manual reviewer disposition workflow remain unimplemented. Missing responses do not imply fault. Completed cases cannot be adjudicated again; technical failures and interrupted cases can be retried explicitly. Completed live decisions requesting human judgment require a reviewer. A server restart marks queued and in-flight cases for review without automatically resuming model calls.

The Support interface offers live review only. Replay remains an internal testing API and is not offered in the review controls. Technical failures show an explicit retry action; completed live results requiring human judgment do not. Connection interruptions require checking the saved run state before another attempt. The support view enables Live AI only when the backend reports configured ADP access. No model call starts on page load or rider intake. The first saved driver response completes the pair and triggers automatic live review for supported cases. Duplicate responses never trigger another attempt. Cases queue behind active reviews, sharing the existing provider concurrency and call-budget limits. Technical failures retry after 2 and 5 seconds, up to three total attempts. At the limit, Support can click Retry AI review for one additional attempt. Configuration and usage-limit failures stop immediately and remain saved for explicit Support retry; they never fall back to replay. The result displays the actual run mode, and cases needing human review are labeled accordingly.

### Connect published ADP applications

Copy `.env.example` to `backend/.env` (ignored by Git). Set `MODEL_PROVIDER=adp`, fill `ADP_RIDER_APP_KEY`, `ADP_DRIVER_APP_KEY`, and `ADP_JUDGE_APP_KEY`, and set `AI_MODE=live` when ready to enable external calls. Never put AppKeys in frontend files, screenshots, logs, or commits. Configuration prefers `backend/.env` and falls back to the repository root `.env` when that file is absent, independent of launch directory. Existing process environment variables take precedence. Relative database paths still resolve against the process working directory; use the npm scripts from the project root consistently.

Run `npm run build`, then `npm start` and `npm run frontend` in separate terminals. Submit both party accounts to start automatic review. Support can retry technical failures. Each run makes at most five ADP calls with separate conversations: two briefs, two rebuttals, and one Judge proposal. Every call receives the full case evidence and selected policy; only the appropriate prior arguments are included. The repository prompt is supplied through ADP's `SystemRole` parameter.

The v2 SSE endpoint is restricted to `https://wss.lke.tencentcloud.com/adp/v2/chat`, following the [official HTTP SSE API](https://www.tencentcloud.com/document/product/1254/81449). Only the completed assistant reply is parsed. One enclosing JSON code fence is tolerated; arbitrary prose, plain-text clarifications, wrong roles, unknown citations (including adverse evidence), extra fields, and malformed proposals fail validation. Transport and validation failures leave no automatic financial decision, record a sanitized failed run, and never silently fall back to replay.

Limits are five calls per run, one concurrent live run, and at most 60 reserved calls per server process (configurable downward with `MAX_MODEL_CALLS_PER_SESSION`). Failed runs retain their five-call reservation. Restarting the process resets this counter. Per-call and run deadlines use `MODEL_CALL_TIMEOUT_MS` and `RUN_TIMEOUT_MS`, capped at 120 and 480 seconds. Input is bounded to 256 KiB per call and 1 MiB per run; SSE responses to 2 MiB per call; final answers to 120 KiB. Automatic workspace review allows three total attempts (up to 15 reserved calls), subject to the same session budget. The provider adapter itself does not retry. Successful human-review decisions are never retried automatically. These limits are not a billing ceiling; cancelling HTTP does not guarantee Tencent stops an already-started generation. Token and currency budget settings are not advertised because this adapter does not enforce them.

For an explicitly authorized live smoke test, build first, then run `node scripts/live-adp-smoke.mjs --run` from `backend/`. It temporarily enables ADP for that process, sends the organizer sample for up to five calls, stores the usual local audit trail, and prints only status metadata. Without `--run` it makes no call. Live API verification is separate from passing offline tests.

The deterministic financial evaluator supports only the seeded DISP-002 organizer profile. A live model connection does not expand that policy coverage to arbitrary cases or route disputes. Reported material uncertainty always blocks automatic validation.

Frontend files are organized as follows:

```text
frontend/
  index.html          Rider, driver and support workspace shells
  styles/demo.css     Replay workspace styling
  scripts/app.js      Seeded evidence loading, replay/live trigger and results
  scripts/participation.js  API-backed intake, responses, progress and outcomes
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
  policies/
    organizer-disp002-v1.json  Policy bundle with rules, namespaces, and source IDs
eval/
  expectations/
    disp-002.json              Answer key (never imported by runtime code)
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
