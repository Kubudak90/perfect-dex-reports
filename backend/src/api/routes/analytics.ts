import type { FastifyInstance } from 'fastify';
import {
  getProtocolOverviewHandler,
  getProtocolTVLHistoryHandler,
  getProtocolVolumeHistoryHandler,
  getTopPoolsHandler,
  getTopTokensHandler,
  getTrendingPoolsHandler,
} from '../handlers/analytics.handler.js';
import {
  getProtocolOverviewSchema,
  getProtocolTVLHistorySchema,
  getProtocolVolumeHistorySchema,
  getTopPoolsSchema,
  getTopTokensSchema,
  getTrendingPoolsSchema,
} from '../schemas/analytics.schema.js';

export async function analyticsRoutes(fastify: FastifyInstance) {
  /**
   * GET /v1/analytics/overview (public - no auth required)
   * Get protocol overview statistics
   */
  fastify.get(
    '/overview',
    {
      schema: getProtocolOverviewSchema,
      config: { public: true },
    },
    getProtocolOverviewHandler
  );

  /**
   * GET /v1/analytics/tvl (public - no auth required)
   * Get protocol TVL history
   */
  fastify.get(
    '/tvl',
    {
      schema: getProtocolTVLHistorySchema,
      config: { public: true },
    },
    getProtocolTVLHistoryHandler
  );

  /**
   * GET /v1/analytics/volume (public - no auth required)
   * Get protocol volume history
   */
  fastify.get(
    '/volume',
    {
      schema: getProtocolVolumeHistorySchema,
      config: { public: true },
    },
    getProtocolVolumeHistoryHandler
  );

  /**
   * GET /v1/analytics/top-pools (public - no auth required)
   * Get top pools by various metrics
   */
  fastify.get(
    '/top-pools',
    {
      schema: getTopPoolsSchema,
      config: { public: true },
    },
    getTopPoolsHandler
  );

  /**
   * GET /v1/analytics/top-tokens (public - no auth required)
   * Get top tokens by various metrics
   */
  fastify.get(
    '/top-tokens',
    {
      schema: getTopTokensSchema,
      config: { public: true },
    },
    getTopTokensHandler
  );

  /**
   * GET /v1/analytics/trending (public - no auth required)
   * Get trending pools (by volume change)
   */
  fastify.get(
    '/trending',
    {
      schema: getTrendingPoolsSchema,
      config: { public: true },
    },
    getTrendingPoolsHandler
  );
}
