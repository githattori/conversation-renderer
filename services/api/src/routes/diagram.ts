import { FastifyInstance } from 'fastify';
import { DiagramService } from '../service.js';
import { DiagramFormat } from '../types.js';

interface FormatBody {
  sessionId: string;
  format: DiagramFormat;
}

interface ExportBody {
  sessionId: string;
}

export async function diagramRoutes(fastify: FastifyInstance, service: DiagramService) {
  fastify.post('/v1/diagram/format', async (request, reply) => {
    const body = request.body as FormatBody;
    const contract = service.formatDiagram(body.sessionId, body.format);
    return contract;
  });

  fastify.post('/v1/export', async (request, reply) => {
    const body = request.body as ExportBody;
    return service.exportSession(body.sessionId);
  });
}
