import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// --- Zod schemas for type inference ---

const protocolOverviewQuerystringZod = z.object({
  chainId: z.coerce.number().int().positive().default(8453),
});

const protocolTVLHistoryQuerystringZod = z.object({
  chainId: z.coerce.number().int().positive().default(8453),
  period: z.enum(['7d', '30d', '90d', '1y', 'all']).default('30d'),
});

const protocolVolumeHistoryQuerystringZod = z.object({
  chainId: z.coerce.number().int().positive().default(8453),
  period: z.enum(['7d', '30d', '90d', '1y', 'all']).default('30d'),
});

const topPoolsQuerystringZod = z.object({
  chainId: z.coerce.number().int().positive().default(8453),
  orderBy: z.enum(['tvl', 'volume24h', 'fees24h', 'apr']).default('tvl'),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

const topTokensQuerystringZod = z.object({
  chainId: z.coerce.number().int().positive().default(8453),
  orderBy: z.enum(['volume24h', 'tvl', 'priceChange24h']).default('volume24h'),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

const trendingPoolsQuerystringZod = z.object({
  chainId: z.coerce.number().int().positive().default(8453),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

// --- Fastify route schemas (JSON Schema) ---

/**
 * Get protocol overview schema
 */
export const getProtocolOverviewSchema = {
  querystring: zodToJsonSchema(protocolOverviewQuerystringZod),
  response: {
    200: zodToJsonSchema(
      z.object({
        success: z.boolean(),
        data: z.object({
          tvlUsd: z.string(),
          volume24h: z.string(),
          volume7d: z.string(),
          fees24h: z.string(),
          fees7d: z.string(),
          poolCount: z.number(),
          txCount24h: z.number(),
          uniqueUsers24h: z.number().optional(),
          timestamp: z.number(),
        }),
      })
    ),
  },
};

/**
 * Get protocol TVL history schema
 */
export const getProtocolTVLHistorySchema = {
  querystring: zodToJsonSchema(protocolTVLHistoryQuerystringZod),
  response: {
    200: zodToJsonSchema(
      z.object({
        success: z.boolean(),
        data: z.object({
          history: z.array(
            z.object({
              timestamp: z.number(),
              tvlUsd: z.string(),
            })
          ),
        }),
      })
    ),
  },
};

/**
 * Get protocol volume history schema
 */
export const getProtocolVolumeHistorySchema = {
  querystring: zodToJsonSchema(protocolVolumeHistoryQuerystringZod),
  response: {
    200: zodToJsonSchema(
      z.object({
        success: z.boolean(),
        data: z.object({
          history: z.array(
            z.object({
              timestamp: z.number(),
              volumeUsd: z.string(),
              feesUsd: z.string(),
              txCount: z.number(),
            })
          ),
        }),
      })
    ),
  },
};

/**
 * Get top pools schema
 */
export const getTopPoolsSchema = {
  querystring: zodToJsonSchema(topPoolsQuerystringZod),
  response: {
    200: zodToJsonSchema(
      z.object({
        success: z.boolean(),
        data: z.object({
          pools: z.array(
            z.object({
              poolId: z.string(),
              token0: z.object({
                address: z.string(),
                symbol: z.string(),
                name: z.string(),
              }),
              token1: z.object({
                address: z.string(),
                symbol: z.string(),
                name: z.string(),
              }),
              feeTier: z.number(),
              tvlUsd: z.string(),
              volume24h: z.string(),
              fees24h: z.string(),
              apr24h: z.string(),
            })
          ),
        }),
      })
    ),
  },
};

/**
 * Get top tokens schema
 */
export const getTopTokensSchema = {
  querystring: zodToJsonSchema(topTokensQuerystringZod),
  response: {
    200: zodToJsonSchema(
      z.object({
        success: z.boolean(),
        data: z.object({
          tokens: z.array(
            z.object({
              address: z.string(),
              symbol: z.string(),
              name: z.string(),
              priceUsd: z.string(),
              priceChange24h: z.string(),
              volume24h: z.string(),
              tvl: z.string(),
            })
          ),
        }),
      })
    ),
  },
};

/**
 * Get trending pools schema
 */
export const getTrendingPoolsSchema = {
  querystring: zodToJsonSchema(trendingPoolsQuerystringZod),
  response: {
    200: zodToJsonSchema(
      z.object({
        success: z.boolean(),
        data: z.object({
          pools: z.array(
            z.object({
              poolId: z.string(),
              token0: z.object({
                address: z.string(),
                symbol: z.string(),
              }),
              token1: z.object({
                address: z.string(),
                symbol: z.string(),
              }),
              feeTier: z.number(),
              volume24h: z.string(),
              volumeChange: z.string(),
              priceChange: z.string(),
            })
          ),
        }),
      })
    ),
  },
};

// Export types
export type GetProtocolOverviewQuerystring = z.infer<typeof protocolOverviewQuerystringZod>;
export type GetProtocolTVLHistoryQuerystring = z.infer<typeof protocolTVLHistoryQuerystringZod>;
export type GetProtocolVolumeHistoryQuerystring = z.infer<typeof protocolVolumeHistoryQuerystringZod>;
export type GetTopPoolsQuerystring = z.infer<typeof topPoolsQuerystringZod>;
export type GetTopTokensQuerystring = z.infer<typeof topTokensQuerystringZod>;
export type GetTrendingPoolsQuerystring = z.infer<typeof trendingPoolsQuerystringZod>;
