import {FastifyInstance} from 'fastify';

import {requireUser} from '../../middleware/authGuard.js';
import {getRecordsForUser, saveRunResult} from './records.service.js';
import {recordsResponseSchema, runResultPayloadSchema} from './records.schemas.js';

export async function recordsRoutes(app: FastifyInstance) {
  app.get('/', {preHandler: requireUser}, async (request) => {
    return recordsResponseSchema.parse(getRecordsForUser(request.user!.id));
  });

  app.post('/', {preHandler: requireUser}, async (request, reply) => {
    const parsed = runResultPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({error: parsed.error.issues[0]?.message ?? 'Invalid payload.'});
    }

    const stored = saveRunResult(request.user!.id, parsed.data);
    return reply.status(201).send(stored);
  });
}
