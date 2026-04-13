import {FastifyInstance} from 'fastify';

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    reply.status(500).send({error: 'Internal server error.'});
  });
}
