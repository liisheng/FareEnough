# FareEnough implementation handoff

Read [SRS.md](../SRS.md) before implementation. It is the detailed product baseline; this file is a short entry point for a new conversation.

## Agreed product

Build a local live-demo application for Ryde's hackathon dispute-resolution challenge. Use three real AI roles: Rider Advocate, Driver Advocate, Judge. Cover no-show charges and route-deviation disputes. Prioritize fair decisions, evidence, and explanations. Visible communication is required, and the roles must address opposing evidence rather than merely exchange messages.

Provide a rider intake/status/outcome flow and an internal support console. No driver portal. Generate a driver explanation for support to preview; do not send messages. Clear supported cases resolve automatically with simulated financial outcomes; uncertain cases go to a human reviewer. No real payments, public hosting, voice, or extra agents are required. Visual styling is deferred.

## Files to read

1. [SRS.md](../SRS.md), especially policy profiles, decision gates, data contracts, and acceptance scenarios.
2. [Policy reference](POLICY_REFERENCE.md), including public-source gaps and conflicts.
3. [Resource index](resources/README.md) and the organizer sample. Preserve all originals.

The repository started empty. Documentation and source resources exist; application code and tests do not. The GitHub repository is [liisheng/FareEnough](https://github.com/liisheng/FareEnough), with `main` as the intended primary branch. Check the current Git state before starting work. No hackathon registration, submission, or application deployment has been performed by this documentation task.

## Recommended technical starting point

Use TypeScript with npm workspaces, React/Vite, a local Fastify backend, Zod schemas, and SQLite. Use an explicit bounded coordinator rather than adopting a large agent framework by default. A server-side configurable DeepSeek adapter is the initial model candidate, subject to available credentials and budget. Confirm runtime/package compatibility and provider tool/JSON behavior before investing in the UI.

The user delegated technical choice but did not provide model credentials or approve a purchase. Set up offline fixtures and clearly labeled replay while provider access is being arranged. Never present replay as a live model run.

## First implementation slice

1. Inspect the current repository before changing it; another conversation may have started work after this handoff.
2. Define shared runtime schemas, migrations, evidence IDs, policy versions, and safe role projections.
3. Extract only the organizer dataset JSON into runtime fixtures. Keep the expected outcome and editorial summary exclusively in evaluation data.
4. Implement exact timing and money calculations, the organizer profile, evidence discrepancy display, and threshold tests.
5. Implement case-scoped read tools, separate advocate contexts, bounded responses, Judge output, and deterministic validation.
6. Connect one local rider-to-support-to-outcome flow; then add the route/ERP scenario and required recovery/review cases.

See SRS section 19 for team workstreams and complete milestones. Capture genuine CodeBuddy or WorkBuddy usage history and at least three screenshots while building; this requirement is not satisfied by using another assistant alone.

## Decisions that must survive handoff

- The organizer fixture uses S$5, five free minutes, and an eight-minute total no-show threshold. Its explicit demo clock starts at the corroborated 08:43 arrival, producing 480 seconds. Retain the 08:43:10 timer event and early-arrival discrepancy visibly.
- Current public Ryde rules use different fee/timing values. Select a versioned profile per case; do not silently combine them.
- `UPHELD` in the sample means the fee stands, therefore the rider's claim is rejected and no extra money is charged.
- Fixed-fare extra distance is not automatically a monetary overcharge. The route demo should prove an actual unsupported charge, or clearly distinguish a service complaint from the fare outcome.
- Historical ratings, names, account age, and dispute flags do not establish current fault. The proposed core prompt projection omits them.
- A missing log is not automatically evidence of wrongdoing. Material uncertainty blocks automatic financial action.
- Tools and agents never execute payments; a local validated transaction records a clearly marked simulation once.
- The observer sees concise arguments, evidence retrieval, responses, and reasons, not hidden chain-of-thought.

## Report back with evidence

When implementing, report what works, which acceptance scenarios passed, whether model runs were live or controlled/replayed, and any remaining limitation. Do not claim the prototype or hackathon submission is complete until the relevant SRS gates and submission items have actually been met.
