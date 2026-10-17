import type { FastifyInstance } from 'fastify';
import { loadDisp002Fixture } from '../fixtures/loader.js';
import { projectCaseEvidence } from '../projections/case-projection.js';
import { CaseEvidenceResponseSchema } from '../schemas/api.js';

// ---------------------------------------------------------------------------
// GET /api/cases/:id/evidence — returns a safe case/evidence projection.
//
// Currently serves the DISP-002 fixture. Future cases will query the
// database and apply the same projection pattern.
// ---------------------------------------------------------------------------

export async function caseRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/cases/:id/evidence', async (request, reply) => {
    const { id } = request.params as { id: string };

    if (id !== 'DISP-002') {
      return reply.code(404).send({ error: 'Case not found', caseId: id });
    }

    const fixture = loadDisp002Fixture();
    const projection = projectCaseEvidence(fixture);

    // Validate the response against the API schema before sending.
    const result = CaseEvidenceResponseSchema.safeParse(projection);
    if (!result.success) {
      request.log.error(
        { issues: result.error.issues },
        'Response projection failed schema validation',
      );
      return reply.code(500).send({ error: 'Internal projection error' });
    }

    return reply.send(result.data);
  });
}
