import {FastifyInstance} from 'fastify';
import { z } from 'zod';

import { gameModeSchema, singlePlayerRunSessionSchema } from '../../../../shared/src/contracts/records.js';
import {requireUser} from '../../middleware/authGuard.js';
import { createVerifiedRunSession, getRecordsForUser, heartbeatVerifiedRunSession, saveRunResult } from './records.service.js';
import {recordsResponseSchema, runResultPayloadSchema} from './records.schemas.js';

export async function recordsRoutes(app: FastifyInstance) {
  app.post('/run-session', {preHandler: requireUser}, async (request, reply) => {
    const parsed = z.object({ mode: gameModeSchema }).safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({error: parsed.error.issues[0]?.message ?? 'Invalid payload.'});
    }

    const runSession = await createVerifiedRunSession(request.user!.id, parsed.data.mode);
    return reply.status(201).send(singlePlayerRunSessionSchema.parse(runSession));
  });

  app.post('/run-session/:runSessionId/heartbeat', {preHandler: requireUser}, async (request, reply) => {
    const params = request.params as { runSessionId?: string };
    const runSessionId = params.runSessionId?.trim();
    if (!runSessionId) {
      return reply.status(400).send({error: 'Run session is required.'});
    }

    const updated = await heartbeatVerifiedRunSession(request.user!.id, runSessionId);
    if (!updated) {
      return reply.status(404).send({error: 'Run session not found.'});
    }

    return reply.send({ok: true});
  });

  app.get('/', {preHandler: requireUser}, async (request) => {
    return recordsResponseSchema.parse(await getRecordsForUser(request.user!.id));
  });

  app.post('/', {preHandler: requireUser}, async (request, reply) => {
    const parsed = runResultPayloadSchema.extend({
      runSessionId: singlePlayerRunSessionSchema.shape.id.optional(),
    }).safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({error: parsed.error.issues[0]?.message ?? 'Invalid payload.'});
    }

    const stored = await saveRunResult(request.user!.id, parsed.data);
    request.log.info(
      {
        event: 'record_saved',
        userId: request.user!.id,
        mode: parsed.data.mode,
        score: parsed.data.score,
        reachedRound: parsed.data.reachedRound,
      },
      'Saved run result',
    );
    return reply.status(201).send(stored);
  });
}
