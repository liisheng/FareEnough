// Explicit, bounded live test. Reads keys through server config; prints no secrets.
if (!process.argv.includes('--run')) {
  console.error('Use --run to send the organizer sample to the three configured ADP applications (up to five model calls).');
  process.exit(1);
}
process.env.AI_MODE = 'live';
process.env.MODEL_PROVIDER = 'adp';
const { buildServer } = await import('../dist/server.js');
const { closeDb } = await import('../dist/db/connection.js');
const app = await buildServer();
try {
  const response = await app.inject({ method: 'POST', url: '/api/cases/DISP-002/runs', payload: { mode: 'live' } });
  const body = response.json();
  console.log(JSON.stringify({
    httpStatus: response.statusCode, runId: body.runId, mode: body.mode,
    status: body.status, provider: body.provider, code: body.code,
    stagesCompleted: body.events?.filter((event) => event.status === 'completed').map((event) => event.stage),
    judgeOutcome: body.judgeProposal?.outcome,
    validation: body.validatedDecision?.validationStatus,
    simulatedAdjustmentCents: body.validatedDecision?.amountMinor,
  }, null, 2));
  if (response.statusCode !== 201) process.exitCode = 1;
} finally {
  await app.close();
  closeDb();
}
