import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');
const PoolIdSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid pool ID');

// Token response (nested in pool)
const TokenSchema = z.object({
  id: z.number(),
  address: AddressSchema,
  symbol: z.string(),
  name: z.string(),
  decimals: z.number(),
  logoUri: z.string().nullable(),
});

// GET /pools
export const GetPoolsRequestSchema = z.object({
  chainId: z.coerce.number().int().positive().default(8453),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['tvl', 'volume', 'apr', 'createdAt']).default('tvl'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  token0: AddressSchema.optional(),
  token1: AddressSchema.optional(),
  minTvl: z.coerce.number().min(0).optional(),
});

export const PoolResponseSchema = z.object({
  id: z.number(),
  poolId: PoolIdSchema,
  chainId: z.number(),

  // Tokens
  token0: TokenSchema,
  token1: TokenSchema,

  // Pool config
  feeTier: z.number(),
  tickSpacing: z.number(),
  hookAddress: z.string().nullable(),

  // Current state
  sqrtPriceX96: z.string(),
  currentTick: z.number(),
  liquidity: z.string(),
  token0Price: z.string().nullable(),
  token1Price: z.string().nullable(),

  // Stats (24h)
  volume24hUsd: z.string(),
  volume24hToken0: z.string(),
  volume24hToken1: z.string(),
  fees24hUsd: z.string(),
  txCount24h: z.number(),

  // TVL
  tvlUsd: z.string(),
  tvlToken0: z.string(),
  tvlToken1: z.string(),

  // Calculated
  apr24h: z.string(),

  // Metadata
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const GetPoolsResponseSchema = z.object({
  pools: z.array(PoolResponseSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

// GET /pools/:poolId
export const GetPoolRequestSchema = z.object({
  poolId: PoolIdSchema,
  chainId: z.coerce.number().int().positive().default(8453),
});

export const PoolDetailResponseSchema = PoolResponseSchema.extend({
  // Additional detail fields
  volume7dUsd: z.string().optional(),
  volume30dUsd: z.string().optional(),
  fees7dUsd: z.string().optional(),
  fees30dUsd: z.string().optional(),
});

// JSON Schema exports for Fastify
export const GetPoolsSchema = {
  querystring: zodToJsonSchema(GetPoolsRequestSchema),
  response: {
    200: zodToJsonSchema(GetPoolsResponseSchema),
  },
};

export const GetPoolSchema = {
  params: zodToJsonSchema(z.object({ poolId: PoolIdSchema })),
  querystring: zodToJsonSchema(z.object({ chainId: z.coerce.number().int().positive().default(8453) })),
  response: {
    200: zodToJsonSchema(PoolDetailResponseSchema),
  },
};

// TypeScript types
export type GetPoolsRequest = z.infer<typeof GetPoolsRequestSchema>;
export type GetPoolsResponse = z.infer<typeof GetPoolsResponseSchema>;
export type GetPoolRequest = z.infer<typeof GetPoolRequestSchema>;
export type PoolResponse = z.infer<typeof PoolResponseSchema>;
export type PoolDetailResponse = z.infer<typeof PoolDetailResponseSchema>;
