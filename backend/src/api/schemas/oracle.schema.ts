import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// --- Zod schemas for type inference ---

const oraclePricesQuerystringZod = z.object({
  chainId: z.coerce.number().int().positive().default(8453),
  tokens: z.string().optional().describe('Comma-separated token addresses'),
});

const twapPriceParamsZod = z.object({
  token: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address')
    .describe('Token address'),
});

const twapPriceQuerystringZod = z.object({
  chainId: z.coerce.number().int().positive().default(8453),
  period: z.coerce.number().int().positive().default(3600).describe('TWAP period in seconds'),
});

// --- Fastify route schemas (JSON Schema) ---

/**
 * Get oracle prices schema
 */
export const getOraclePricesSchema = {
  querystring: zodToJsonSchema(oraclePricesQuerystringZod),
  response: {
    200: zodToJsonSchema(
      z.object({
        success: z.boolean(),
        data: z.object({
          prices: z.record(
            z.object({
              address: z.string(),
              symbol: z.string(),
              priceUsd: z.string(),
              priceEth: z.string(),
              decimals: z.number(),
              lastUpdated: z.number(),
            })
          ),
          timestamp: z.number(),
        }),
      })
    ),
  },
};

/**
 * Get TWAP price schema
 */
export const getTWAPPriceSchema = {
  params: zodToJsonSchema(twapPriceParamsZod),
  querystring: zodToJsonSchema(twapPriceQuerystringZod),
  response: {
    200: zodToJsonSchema(
      z.object({
        success: z.boolean(),
        data: z.object({
          token: z.string(),
          symbol: z.string(),
          twapPriceUsd: z.string(),
          spotPriceUsd: z.string(),
          period: z.number(),
          timestamp: z.number(),
        }),
      })
    ),
  },
};

// Export types
export type GetOraclePricesQuerystring = z.infer<typeof oraclePricesQuerystringZod>;
export type GetTWAPPriceParams = z.infer<typeof twapPriceParamsZod>;
export type GetTWAPPriceQuerystring = z.infer<typeof twapPriceQuerystringZod>;
