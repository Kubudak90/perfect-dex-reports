import type { FastifyPluginAsync } from 'fastify';
import { healthCheckHandler, detailedHealthCheckHandler } from '../handlers/health.handler.js';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // Basic health check (public - no auth required)
  fastify.get('/health', { config: { public: true } }, healthCheckHandler);

  // Detailed health check with dependencies (public - no auth required)
  fastify.get('/health/detailed', { config: { public: true } }, detailedHealthCheckHandler);

  // WebSocket stats (public - no auth required)
  fastify.get('/health/ws-stats', { config: { public: true } }, async (_request, reply) => {
    const stats = fastify.wsManager.getStats();
    const workerStatus = fastify.priceSyncWorker.getStatus();

    return reply.send({
      websocket: stats,
      workers: {
        priceSync: workerStatus,
      },
    });
  });
};
