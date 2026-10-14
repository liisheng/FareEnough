import Fastify from 'fastify';
import { healthRoutes } from './routes/health.js';
import { caseRoutes } from './routes/cases.js';
import { runRoutes, type ReviewRunner } from './routes/runs.js';
import { createAutomaticReviews } from './automatic-reviews.js';
import { getDb } from './db/connection.js';
import { runMigrations } from './db/migrate.js';
import { HOST, PORT } from './config.js';
import { workspaceRoutes } from './routes/workspace.js';
import { recoverInterruptedCases } from './workspace.js';

// ---------------------------------------------------------------------------
// Fastify server — creates the instance, registers routes, runs migrations
// on startup, and listens on 127.0.0.1:PORT (default 3001).
// ---------------------------------------------------------------------------

export async function buildServer(): Promise<ReturnType<typeof Fastify>> {
  const app = Fastify({
    logger: {
      level: 'info',
      redact: ['req.headers.authorization', '*.MODEL_API_KEY', '*.SESSION_SECRET', '*.ADP_RIDER_APP_KEY', '*.ADP_DRIVER_APP_KEY', '*.ADP_JUDGE_APP_KEY', '*.AppKey'],
    },
  });

  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (origin === 'http://127.0.0.1:3000' || origin === 'http://localhost:3000') {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Vary', 'Origin');
      reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    if (request.method === 'OPTIONS') return reply.code(204).send();
  });

  // Run migrations on startup so the database is always ready.
  const db = getDb();
  runMigrations(db);
  recoverInterruptedCases();

  await app.register(healthRoutes);
  await app.register(caseRoutes);
  let runner!: ReviewRunner;
  await app.register(runRoutes, {onReady(value: ReviewRunner) {runner=value;}});
  const automatic=createAutomaticReviews(runner);
  app.addHook('onClose',async()=>{await automatic.close();});
  await app.register(workspaceRoutes,{enqueueReview:automatic.enqueue});

  return app;
}

export async function startServer(): Promise<void> {
  const app = await buildServer();

  try {
    await app.listen({ host: HOST, port: PORT });
    app.log.info(`FareEnough backend running at http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
