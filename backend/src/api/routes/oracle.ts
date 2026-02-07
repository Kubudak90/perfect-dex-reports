import type { FastifyInstance } from 'fastify';
import {
  getOraclePricesHandler,
  getTWAPPriceHandler,
} from '../handlers/oracle.handler.js';
import {
  getOraclePricesSchema,
  getTWAPPriceSchema,
} from '../schemas/oracle.schema.js';

export async function oracleRoutes(fastify: FastifyInstance) {
  /**
   * GET /v1/oracle/prices (public - no auth required)
   * Get current oracle prices for tokens
   */
  fastify.get(
    '/prices',
    {
      schema: getOraclePricesSchema,
      config: { public: true },
    },
    getOraclePricesHandler
  );

  /**
   * GET /v1/oracle/twap/:token (public - no auth required)
   * Get TWAP (Time-Weighted Average Price) for a token
   */
  fastify.get(
    '/twap/:token',
    {
      schema: getTWAPPriceSchema,
      config: { public: true },
    },
    getTWAPPriceHandler
  );
}
