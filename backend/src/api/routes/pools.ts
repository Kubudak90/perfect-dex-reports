import type { FastifyPluginAsync } from 'fastify';
import { PoolsHandler } from '../handlers/pools.handler.js';
import { GetPoolsSchema, GetPoolSchema } from '../schemas/pools.schema.js';

export const poolsRoutes: FastifyPluginAsync = async (fastify) => {
  const handler = new PoolsHandler(fastify);

  // GET /pools (public - no auth required)
  fastify.get('/', {
    schema: GetPoolsSchema,
    config: { public: true },
    handler: handler.getPools,
  });

  // GET /pools/:poolId (public - no auth required)
  fastify.get('/:poolId', {
    schema: GetPoolSchema,
    config: { public: true },
    handler: handler.getPool,
  });
};
