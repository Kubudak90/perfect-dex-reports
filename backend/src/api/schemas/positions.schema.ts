import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// --- Zod schemas for type inference ---

const positionsByAddressParamsZod = z.object({
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
    .describe('Ethereum address'),
});

const positionsByAddressQuerystringZod = z.object({
  chainId: z.coerce.number().int().positive().default(8453),
});

const positionByIdParamsZod = z.object({
  tokenId: z.string().describe('Position NFT token ID'),
});

const positionByIdQuerystringZod = z.object({
  chainId: z.coerce.number().int().positive().default(8453),
});

const poolTicksParamsZod = z.object({
  poolId: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid pool ID')
    .describe('Pool ID (keccak256 of PoolKey)'),
});

const poolTicksQuerystringZod = z.object({
  chainId: z.coerce.number().int().positive().default(8453),
  tickLower: z.coerce.number().int().optional(),
  tickUpper: z.coerce.number().int().optional(),
});

// --- Fastify route schemas (JSON Schema) ---

/**
 * Get positions by address schema
 */
export const getPositionsByAddressSchema = {
  params: zodToJsonSchema(positionsByAddressParamsZod),
  querystring: zodToJsonSchema(positionsByAddressQuerystringZod),
  response: {
    200: zodToJsonSchema(
      z.object({
        success: z.boolean(),
        data: z.object({
          positions: z.array(
            z.object({
              tokenId: z.string(),
              poolId: z.string(),
              pool: z.object({
                token0: z.object({
                  address: z.string(),
                  symbol: z.string(),
                  name: z.string(),
                  decimals: z.number(),
                }),
                token1: z.object({
                  address: z.string(),
                  symbol: z.string(),
                  name: z.string(),
                  decimals: z.number(),
                }),
                feeTier: z.number(),
              }),
              tickLower: z.number(),
              tickUpper: z.number(),
              liquidity: z.string(),
              tokensOwed0: z.string(),
              tokensOwed1: z.string(),
            })
          ),
          total: z.number(),
        }),
      })
    ),
  },
};

/**
 * Get position by token ID schema
 */
export const getPositionByIdSchema = {
  params: zodToJsonSchema(positionByIdParamsZod),
  querystring: zodToJsonSchema(positionByIdQuerystringZod),
  response: {
    200: zodToJsonSchema(
      z.object({
        success: z.boolean(),
        data: z.object({
          tokenId: z.string(),
          owner: z.string(),
          poolId: z.string(),
          pool: z.object({
            token0: z.object({
              address: z.string(),
              symbol: z.string(),
              name: z.string(),
              decimals: z.number(),
            }),
            token1: z.object({
              address: z.string(),
              symbol: z.string(),
              name: z.string(),
              decimals: z.number(),
            }),
            feeTier: z.number(),
            sqrtPrice: z.string(),
            tick: z.number(),
          }),
          tickLower: z.number(),
          tickUpper: z.number(),
          liquidity: z.string(),
          feeGrowthInside0LastX128: z.string(),
          feeGrowthInside1LastX128: z.string(),
          tokensOwed0: z.string(),
          tokensOwed1: z.string(),
        }),
      })
    ),
  },
};

/**
 * Get pool ticks schema
 */
export const getPoolTicksSchema = {
  params: zodToJsonSchema(poolTicksParamsZod),
  querystring: zodToJsonSchema(poolTicksQuerystringZod),
  response: {
    200: zodToJsonSchema(
      z.object({
        success: z.boolean(),
        data: z.object({
          ticks: z.array(
            z.object({
              tickIdx: z.number(),
              liquidityGross: z.string(),
              liquidityNet: z.string(),
            })
          ),
          currentTick: z.number(),
          tickSpacing: z.number(),
        }),
      })
    ),
  },
};

// Export types
export type GetPositionsByAddressParams = z.infer<typeof positionsByAddressParamsZod>;
export type GetPositionsByAddressQuerystring = z.infer<typeof positionsByAddressQuerystringZod>;

export type GetPositionByIdParams = z.infer<typeof positionByIdParamsZod>;
export type GetPositionByIdQuerystring = z.infer<typeof positionByIdQuerystringZod>;

export type GetPoolTicksParams = z.infer<typeof poolTicksParamsZod>;
export type GetPoolTicksQuerystring = z.infer<typeof poolTicksQuerystringZod>;
