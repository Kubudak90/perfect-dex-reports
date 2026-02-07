import type { FastifyInstance } from 'fastify';
import {
  getPositionsByAddressHandler,
  getPositionByIdHandler,
  getPoolTicksHandler,
} from '../handlers/positions.handler.js';
import {
  getPositionsByAddressSchema,
  getPositionByIdSchema,
  getPoolTicksSchema,
} from '../schemas/positions.schema.js';

export async function positionsRoutes(fastify: FastifyInstance) {
  /**
   * GET /v1/positions/:address
   * Get all positions for an address
   */
  fastify.get(
    '/:address',
    {
      schema: getPositionsByAddressSchema,
    },
    getPositionsByAddressHandler
  );

  /**
   * GET /v1/positions/id/:tokenId
   * Get position details by token ID
   */
  fastify.get(
    '/id/:tokenId',
    {
      schema: getPositionByIdSchema,
    },
    getPositionByIdHandler
  );

  /**
   * GET /v1/positions/ticks/:poolId
   * Get tick data for a pool (liquidity distribution)
   */
  fastify.get(
    '/ticks/:poolId',
    {
      schema: getPoolTicksSchema,
    },
    getPoolTicksHandler
  );
}
