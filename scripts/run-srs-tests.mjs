import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Run against isolated test databases and controlled providers, never the live server.
const cwd = fileURLToPath(new URL('../', import.meta.url));
const env = { ...process.env, NODE_ENV: 'test', AI_MODE: 'replay', MODEL_PROVIDER: 'test' };
for (const key of ['ADP_RIDER_APP_KEY', 'ADP_DRIVER_APP_KEY', 'ADP_JUDGE_APP_KEY']) delete env[key];
const steps = [
  ['build', 'node_modules/typescript/bin/tsc', ['--project', 'backend/tsconfig.json']],
  ['copy build assets', 'backend/scripts/copy-assets.mjs', []],
  ['backend acceptance and regression tests', '../node_modules/vitest/vitest.mjs', ['run'], 'backend/'],
  ['frontend tests', null, ['--test', 'frontend/tests/*.test.cjs']],
  ['browser journeys', 'node_modules/@playwright/test/cli.js', ['test']],
];
let failed = false;
for (const [label, script, args, directory] of steps) {
  console.log(`\nSRS checks: ${label}`);
  const result = spawnSync(process.execPath, script ? [script, ...args] : args, {
    cwd: directory ? fileURLToPath(new URL(directory, new URL('../', import.meta.url))) : cwd,
    env, stdio: 'inherit',
  });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) {
    // Tests need a valid build; independent suites can still report their failures.
    if (label === 'build' || label === 'copy build assets') process.exit(result.status ?? 1);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log('\nAutomated checks passed. See docs/SRS_TEST_COVERAGE.md for partial coverage and outstanding acceptance gates.');
