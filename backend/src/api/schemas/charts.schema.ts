import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Time interval for chart data
 */
export const TimeInterval = z.enum(['1h', '4h', '1d', '1w', '1m']);
export type TimeInterval = z.infer<typeof TimeInterval>;

// --- Zod schemas for type inference ---

const poolIdParamsZod = z.object({
  poolId: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid pool ID')
    .describe('Pool ID (keccak256 of PoolKey)'),
});

const ohlcvQuerystringZod = z.object({
  chainId: z.coerce.number().int().positive().default(8453),
  interval: TimeInterval.default('1h'),
  from: z.coerce.number().int().positive().optional().describe('Start timestamp (Unix)'),
  to: z.coerce.number().int().positive().optional().describe('End timestamp (Unix)'),
  limit: z.coerce.number().int().positive().max(1000).default(100),
});

const historyQuerystringZod = z.object({
  chainId: z.coerce.number().int().positive().default(8453),
  interval: TimeInterval.default('1d'),
  from: z.coerce.number().int().positive().optional().describe('Start timestamp (Unix)'),
  to: z.coerce.number().int().positive().optional().describe('End timestamp (Unix)'),
  limit: z.coerce.number().int().positive().max(1000).default(100),
});

// --- Fastify route schemas (JSON Schema) ---

/**
 * Get pool OHLCV data schema
 */
export const getPoolOHLCVSchema = {
  params: zodToJsonSchema(poolIdParamsZod),
  querystring: zodToJsonSchema(ohlcvQuerystringZod),
  response: {
    200: zodToJsonSchema(
      z.object({
        success: z.boolean(),
        data: z.object({
          interval: TimeInterval,
          candles: z.array(
            z.object({
              timestamp: z.number(),
              open: z.string(),
              high: z.string(),
              low: z.string(),
              close: z.string(),
              volume: z.string(),
              volumeUsd: z.string(),
              txCount: z.number(),
            })
          ),
        }),
      })
    ),
  },
};

/**
 * Get pool TVL history schema
 */
export const getPoolTVLHistorySchema = {
  params: zodToJsonSchema(poolIdParamsZod),
  querystring: zodToJsonSchema(historyQuerystringZod),
  response: {
    200: zodToJsonSchema(
      z.object({
        success: z.boolean(),
        data: z.object({
          interval: TimeInterval,
          history: z.array(
            z.object({
              timestamp: z.number(),
              tvlUsd: z.string(),
              tvlToken0: z.string(),
              tvlToken1: z.string(),
            })
          ),
        }),
      })
    ),
  },
};

/**
 * Get pool volume history schema
 */
export const getPoolVolumeHistorySchema = {
  params: zodToJsonSchema(poolIdParamsZod),
  querystring: zodToJsonSchema(historyQuerystringZod),
  response: {
    200: zodToJsonSchema(
      z.object({
        success: z.boolean(),
        data: z.object({
          interval: TimeInterval,
          history: z.array(
            z.object({
              timestamp: z.number(),
              volumeUsd: z.string(),
              volumeToken0: z.string(),
              volumeToken1: z.string(),
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
 * Get pool fees history schema
 */
export const getPoolFeesHistorySchema = {
  params: zodToJsonSchema(poolIdParamsZod),
  querystring: zodToJsonSchema(historyQuerystringZod),
  response: {
    200: zodToJsonSchema(
      z.object({
        success: z.boolean(),
        data: z.object({
          interval: TimeInterval,
          history: z.array(
            z.object({
              timestamp: z.number(),
              feesUsd: z.string(),
              feesToken0: z.string(),
              feesToken1: z.string(),
              apr: z.number().optional(),
            })
          ),
        }),
      })
    ),
  },
};

// Export types
export type GetPoolOHLCVParams = z.infer<typeof poolIdParamsZod>;
export type GetPoolOHLCVQuerystring = z.infer<typeof ohlcvQuerystringZod>;

export type GetPoolTVLHistoryParams = z.infer<typeof poolIdParamsZod>;
export type GetPoolTVLHistoryQuerystring = z.infer<typeof historyQuerystringZod>;

export type GetPoolVolumeHistoryParams = z.infer<typeof poolIdParamsZod>;
export type GetPoolVolumeHistoryQuerystring = z.infer<typeof historyQuerystringZod>;

export type GetPoolFeesHistoryParams = z.infer<typeof poolIdParamsZod>;
export type GetPoolFeesHistoryQuerystring = z.infer<typeof historyQuerystringZod>;
