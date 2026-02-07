import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.js';
import { tokensRoutes } from './tokens.js';
import { poolsRoutes } from './pools.js';
import { swapRoutes } from './swap.js';
import { positionsRoutes } from './positions.js';
import { chartsRoutes } from './charts.js';
import { analyticsRoutes } from './analytics.js';
import { oracleRoutes } from './oracle.js';

export async function registerRoutes(fastify: FastifyInstance) {
  // Health check routes (no prefix)
  await fastify.register(healthRoutes);

  // API v1 routes
  await fastify.register(async (fastify) => {
    await fastify.register(tokensRoutes, { prefix: '/tokens' });
    await fastify.register(poolsRoutes, { prefix: '/pools' });
    await fastify.register(swapRoutes, { prefix: '/swap' });
    await fastify.register(positionsRoutes, { prefix: '/positions' });
    await fastify.register(chartsRoutes, { prefix: '/charts' });
    await fastify.register(analyticsRoutes, { prefix: '/analytics' });
    await fastify.register(oracleRoutes, { prefix: '/oracle' });
  }, { prefix: '/v1' });
}
