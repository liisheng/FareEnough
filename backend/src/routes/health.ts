import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { AI_MODE } from '../config.js';

// ---------------------------------------------------------------------------
// GET /health — returns backend and database readiness.
// Does not expose secrets or trigger model calls (SRS NFR-12).
// ---------------------------------------------------------------------------

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request, reply) => {
    let database = false;
    try {
      const db = getDb();
      db.prepare('SELECT 1').get();
      database = true;
    } catch {
      database = false;
    }

    const provider = AI_MODE === 'live';

    return reply.send({
      status: database ? 'ok' : 'degraded',
      database,
      provider,
      timestamp: new Date().toISOString(),
    });
  });
}
