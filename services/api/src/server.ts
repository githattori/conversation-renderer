import 'dotenv/config';
import Fastify from 'fastify';
import { DiagramService } from './service.js';
import { diagramRoutes } from './routes/diagram.js';
import { messagesRoutes } from './routes/messages.js';
import { sessionsRoutes } from './routes/sessions.js';

const fastify = Fastify({ logger: true });
const service = new DiagramService();

async function buildServer() {
  await sessionsRoutes(fastify, service);
  await messagesRoutes(fastify, service);
  await diagramRoutes(fastify, service);
  return fastify;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildServer()
    .then((app) => app.listen({ port: Number(process.env.PORT ?? 3333), host: '0.0.0.0' }))
    .catch((err) => {
      fastify.log.error(err);
      process.exit(1);
    });
}

export default buildServer;
