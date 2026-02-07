import type { FastifyInstance } from 'fastify';
import {
  getPoolOHLCVHandler,
  getPoolTVLHistoryHandler,
  getPoolVolumeHistoryHandler,
  getPoolFeesHistoryHandler,
} from '../handlers/charts.handler.js';
import {
  getPoolOHLCVSchema,
  getPoolTVLHistorySchema,
  getPoolVolumeHistorySchema,
  getPoolFeesHistorySchema,
} from '../schemas/charts.schema.js';

export async function chartsRoutes(fastify: FastifyInstance) {
  /**
   * GET /v1/charts/ohlcv/:poolId (public - no auth required)
   * Get OHLCV (candlestick) data for a pool
   */
  fastify.get(
    '/ohlcv/:poolId',
    {
      schema: getPoolOHLCVSchema,
      config: { public: true },
    },
    getPoolOHLCVHandler
  );

  /**
   * GET /v1/charts/tvl/:poolId (public - no auth required)
   * Get TVL history for a pool
   */
  fastify.get(
    '/tvl/:poolId',
    {
      schema: getPoolTVLHistorySchema,
      config: { public: true },
    },
    getPoolTVLHistoryHandler
  );

  /**
   * GET /v1/charts/volume/:poolId (public - no auth required)
   * Get volume history for a pool
   */
  fastify.get(
    '/volume/:poolId',
    {
      schema: getPoolVolumeHistorySchema,
      config: { public: true },
    },
    getPoolVolumeHistoryHandler
  );

  /**
   * GET /v1/charts/fees/:poolId (public - no auth required)
   * Get fees history (with APR calculation) for a pool
   */
  fastify.get(
    '/fees/:poolId',
    {
      schema: getPoolFeesHistorySchema,
      config: { public: true },
    },
    getPoolFeesHistoryHandler
  );
}
