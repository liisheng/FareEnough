# FareEnough

FareEnough is a local hackathon prototype for fair, explainable ride dispute resolution. A Rider Advocate and Driver Advocate independently gather evidence and present their cases to a Judge. The intended first version covers no-show charges and route-deviation disputes, with human review for uncertain cases.

This repository contains requirements, source materials, and a standalone frontend design preview. The dispute-resolution backend and AI workflow are not implemented yet.

## Frontend preview

With Node.js installed, run `node frontend/serve.mjs` and open http://127.0.0.1:3000. Stop the server with Ctrl+C.

The responsive workspace keeps Ryde-inspired pink accents and rounded cards while following the SRS rider/support workflows. It works offline with system fonts.

- Rider workspace: enter a trip reference and complaint, save a local request, and track whether the driver has responded.
- Driver workspace: submit an independent account linked to the same request. Support can inspect both narratives; party exports contain only their own account.
- No seeded trips, sample cases, evidence, routes, charges, policies, or outcomes are shown. Trip references are user-entered and unverified. Existing browser-saved narratives are retained without their former mock trip metadata.
- Backend authentication, verified trip records, AI review, financial decisions, and external messages remain unconnected. The persona switch is a local demonstration, not an authorization boundary.

Local requests use the browser storage key `fareenough.requests.v1`. Clearing that key removes local requests.

This dependency-free visual slice is isolated in `frontend/` so it can be ported into the planned React frontend once shared API contracts are implemented. It does not replace the SRS implementation milestones.

Frontend files are organized as follows:

```text
frontend/
  index.html          Rider and support workspace shells
  styles/styles.css   Responsive styling
  scripts/app.js      Local intake, examples, queue, evidence and exports
  assets/             Reserved for images and other static assets
  serve.mjs           Local-only HTTP server
```

- [Software Requirements Specification](SRS.md): the authoritative implementation scope and acceptance criteria.
- [Implementation handoff](docs/IMPLEMENTATION_HANDOFF.md): where the next conversation should start.
- [Policy reference](docs/POLICY_REFERENCE.md): public Ryde policies, source links, limitations, and differences from the organizer sample.
- [Organizer resources](docs/resources/README.md): all four original attachments and their integrity manifest.

The agreed delivery is a live demonstration running locally. Rider and driver participation is included under the 12 October scope amendment. Public hosting, external notifications, real payment execution, and voice integration remain outside the MVP. Model API calls may still require internet access and separate credentials or credits.

Try the two-party flow: save a request under Rider, switch to Driver and submit an account, then open the same case in Support. Run `node --test frontend/tests/stakeholder-flow.test.cjs` for logic checks covering linked submissions, refresh persistence, duplicate prevention, escaped input, party export separation, and human-review preservation. These checks use a DOM stub and do not verify browser layout or real access control.

The hackathon brief requires genuine CodeBuddy or WorkBuddy usage and evidence of that usage. This documentation does not satisfy that requirement by itself. See the submission checklist in [the SRS](SRS.md#18-hackathon-deliverables).
