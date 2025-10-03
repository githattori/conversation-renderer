import { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { DiagramService } from '../service.js';
import { MessageInput } from '../types.js';

interface MessageBody {
  sessionId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export async function messagesRoutes(fastify: FastifyInstance, service: DiagramService) {
  await fastify.register(websocket);

  fastify.post('/v1/messages', async (request, reply) => {
    const body = request.body as MessageBody;
    const result = await service.processMessage(body as MessageInput);
    return {
      ...result.contract,
      diff: result.diff,
      systemPrompt: result.systemPrompt,
    };
  });

  fastify.get('/v1/messages/stream', { websocket: true }, (connection) => {
    connection.socket.on('message', (raw) => {
      try {
        const payload = JSON.parse(String(raw));
        Promise.resolve(service.processMessage(payload as MessageInput))
          .then((result) => {
            connection.socket.send(JSON.stringify({
              type: 'diagram.update',
              contract: result.contract,
              diff: result.diff,
            }));
          })
          .catch((error) => {
            connection.socket.send(JSON.stringify({
              type: 'error',
              message: error instanceof Error ? error.message : 'Unknown error',
            }));
          });
      } catch (error) {
        connection.socket.send(JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    });
  });
}
