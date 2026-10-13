# FareEnough

FareEnough is a local hackathon prototype for fair, explainable ride dispute resolution. A Rider Advocate and Driver Advocate independently assess the same evidence, complete one rebuttal round, and present their cases to a Judge. Deterministic code then validates the proposed outcome before anything can be recorded as an action.

This baseline implements the seeded DISP-002 no-show dispute as an end-to-end, auditable replay. It does not call a live model or execute a real payment.

## Run the local demo

In one terminal, start the backend:

```text
npm start
```

In another terminal, start the frontend and open http://127.0.0.1:3000:

```text
npm run frontend
```

The responsive workspace has two views:

- Rider outcome: a concise explanation, fee treatment, decisive facts and policy citations.
- Support review: the 480-second derived fact, progress events, separate advocate briefs, rebuttals, Judge proposal and validated result.

The `REPLAY` label is intentional: the provider returns deterministic structured responses for a reliable demo. The same orchestration boundary can later receive a live provider after credentials are configured and live-mode tests are added.

Frontend files are organized as follows:

```text
frontend/
  index.html          Rider and support workspace shells
  styles/demo.css     Replay workspace styling
  scripts/app.js      Evidence loading, replay trigger and result rendering
  assets/             Reserved for images and other static assets
  serve.mjs           Local-only HTTP server
```

- [Software Requirements Specification](SRS.md): the authoritative implementation scope and acceptance criteria.
- [Implementation handoff](docs/IMPLEMENTATION_HANDOFF.md): where the next conversation should start.
- [Policy reference](docs/POLICY_REFERENCE.md): public Ryde policies, source links, limitations, and differences from the organizer sample.
- [Organizer resources](docs/resources/README.md): all four original attachments and their integrity manifest.

The agreed delivery is a live demonstration running locally. Rider and driver participation is included under the 12 October scope amendment. Public hosting, external notifications, real payment execution, and voice integration remain outside the MVP. Model API calls may still require internet access and separate credentials or credits.

Run `npm run test:frontend` for UI contract and rendering checks. These checks use a DOM stub and do not replace browser or access-control testing.

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
| POST | `/api/cases/DISP-002/runs` | Runs the explicit replay workflow with body `{ "mode": "replay" }`, validates it and persists its audit trail. |

### Three-agent baseline

- Rider Advocate and Driver Advocate receive independent initial contexts.
- Each advocate gets one rebuttal against the other side's brief.
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
    providers/             Provider interface and deterministic replay provider
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
