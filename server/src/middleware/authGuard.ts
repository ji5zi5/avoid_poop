import {FastifyReply, FastifyRequest} from 'fastify';

import {resolveSessionUser} from '../modules/auth/auth.service.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: number;
      username: string;
    } | null;
  }
}

export async function optionalUser(request: FastifyRequest) {
  request.user = await resolveSessionUser(request);
}

export async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  request.user = await resolveSessionUser(request);
  if (!request.user) {
    return reply.status(401).send({error: 'Authentication required.'});
  }
}
