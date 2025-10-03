import { FastifyInstance } from 'fastify';
import { DiagramService } from '../service.js';
import { RolePreset } from '../types.js';

interface CreateSessionBody {
  role?: RolePreset;
}

export async function sessionsRoutes(fastify: FastifyInstance, service: DiagramService) {
  fastify.post('/v1/sessions', async (request, reply) => {
    const body = request.body as CreateSessionBody | undefined;
    const role: RolePreset = body?.role ?? 'analyst';
    const session = service.createSession(role);
    reply.code(201);
    return session;
  });
}
