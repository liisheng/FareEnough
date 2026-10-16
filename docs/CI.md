# Automated checks

After these files are pushed to GitHub, **CI / Build and tests** runs on every push and pull request, and can also be started from Actions. It installs the lockfile dependencies with Node 24, builds the backend, and runs:

- `npm test`: backend unit tests, API integration tests, database tests, and controlled ADP transport tests.
- `npm run test:frontend`: frontend rendering and behavior tests.
- `npm run test:e2e`: browser journeys with deterministic providers.
- `npm run eval:policy`: deterministic policy expectations.
- `npm run eval:prompts`: prompt scenario inventory only; actual prompt responses are checked in the live workflow.

Ordinary CI receives no ADP keys and makes no live model calls. Browser tests use installed Chromium on CI and Edge locally. Failed browser checks retain screenshots and traces in the browser-report artifact for seven days. Later suites still run after a test failure; failures remain failures for the job.

## Real API calls

Create a GitHub environment named `live-api` under **Settings → Environments**. Add these environment secrets:

- `ADP_RIDER_APP_KEY`
- `ADP_DRIVER_APP_KEY`
- `ADP_JUDGE_APP_KEY`

In **Actions → Live API tests → Run workflow**, select the default branch and a suite. Other branches are skipped. This explicitly starts real Tencent requests using sample evidence and consumes API credits:

| Suite | Maximum calls | Checks |
| --- | --- | --- |
| smoke | 5 | Actual application run endpoint with the live provider |
| policy | 15 | Three supplied cases, final decisions and structural stage checks |
| prompts | 12 | Twelve prompt regressions with ten-second pacing |
| all | 32 | All three suites, sequentially |

Live workflow runs are serialized and do not retry failed model requests automatically. Missing secrets fail before any request. All selected suites run even if an earlier suite fails; any failure fails the job. Logs include the existing evaluators' status summaries. Raw live responses, evidence reports, and the database are not uploaded as Actions artifacts. They exist only on the temporary runner. Passing machine checks does not replace semantic review of model reasoning.

The workflow uses environment variables directly (`NODE_ENV=test` prevents loading local credential files). It never changes the published ADP applications.

## Deployment

These workflows provide CI and live API validation. Automatic deployment is not configured: the current delivery is a local demo, and a hosting target has not been selected. GitHub branch protection can require **Build and tests** before merging.

References: [GitHub Node.js workflows](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs) and [Playwright CI setup](https://playwright.dev/docs/ci).
