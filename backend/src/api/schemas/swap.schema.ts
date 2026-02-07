import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');
const AmountSchema = z.string().regex(/^\d+$/, 'Invalid amount');

// GET /swap/quote
export const GetQuoteRequestSchema = z.object({
  chainId: z.coerce.number().int().positive().default(8453),
  tokenIn: AddressSchema,
  tokenOut: AddressSchema,
  amountIn: AmountSchema,
  slippage: z.coerce.number().min(0.01).max(50).optional().default(0.5), // 0.5% default
  exactInput: z.coerce.boolean().optional().default(true),
});

export const RouteHopSchema = z.object({
  poolId: z.string(),
  tokenIn: AddressSchema,
  tokenOut: AddressSchema,
  fee: z.number(),
  sqrtPriceX96: z.string(),
  tick: z.number(),
  liquidity: z.string(),
});

export const GetQuoteResponseSchema = z.object({
  // Input/Output
  tokenIn: AddressSchema,
  tokenOut: AddressSchema,
  amountIn: z.string(),
  amountOut: z.string(),
  amountOutMin: z.string(), // With slippage applied

  // Route
  route: z.array(RouteHopSchema),
  routeString: z.string(), // "WETH → USDC"

  // Price info
  executionPrice: z.string(), // "2,450.50 USDC per WETH"
  priceImpact: z.number(), // Percentage (0.15 = 0.15%)
  priceImpactWarning: z.enum(['none', 'low', 'medium', 'high']).optional(), // Warning level

  // Gas
  gasEstimate: z.number(),
  gasEstimateUsd: z.number().optional(),

  // Metadata
  timestamp: z.number(),
  cached: z.boolean(),
});

// JSON Schema exports for Fastify
export const GetQuoteSchema = {
  querystring: zodToJsonSchema(GetQuoteRequestSchema),
  response: {
    200: zodToJsonSchema(GetQuoteResponseSchema),
  },
};

// TypeScript types
export type GetQuoteRequest = z.infer<typeof GetQuoteRequestSchema>;
export type GetQuoteResponse = z.infer<typeof GetQuoteResponseSchema>;
export type RouteHop = z.infer<typeof RouteHopSchema>;
