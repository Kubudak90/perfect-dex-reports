import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');

// GET /tokens
export const GetTokensRequestSchema = z.object({
  chainId: z.coerce.number().int().positive().default(8453),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  verified: z.coerce.boolean().optional(),
  search: z.string().min(1).optional(),
});

export const TokenResponseSchema = z.object({
  id: z.number(),
  address: AddressSchema,
  chainId: z.number(),
  symbol: z.string(),
  name: z.string(),
  decimals: z.number(),
  logoUri: z.string().nullable(),
  isVerified: z.boolean(),
  isNative: z.boolean(),
  priceUsd: z.string().nullable(),
  volume24hUsd: z.string(),
  tvlUsd: z.string(),
  priceChange24h: z.string(),
});

export const GetTokensResponseSchema = z.object({
  tokens: z.array(TokenResponseSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

// GET /tokens/:address
export const GetTokenRequestSchema = z.object({
  address: AddressSchema,
  chainId: z.coerce.number().int().positive().default(8453),
});

export const GetTokenResponseSchema = TokenResponseSchema;

// JSON Schema exports for Fastify
export const GetTokensSchema = {
  querystring: zodToJsonSchema(GetTokensRequestSchema),
  response: {
    200: zodToJsonSchema(GetTokensResponseSchema),
  },
};

export const GetTokenSchema = {
  params: zodToJsonSchema(z.object({ address: AddressSchema })),
  querystring: zodToJsonSchema(z.object({ chainId: z.coerce.number().int().positive().default(8453) })),
  response: {
    200: zodToJsonSchema(GetTokenResponseSchema),
  },
};

// TypeScript types
export type GetTokensRequest = z.infer<typeof GetTokensRequestSchema>;
export type GetTokensResponse = z.infer<typeof GetTokensResponseSchema>;
export type GetTokenRequest = z.infer<typeof GetTokenRequestSchema>;
export type GetTokenResponse = z.infer<typeof GetTokenResponseSchema>;
export type TokenResponse = z.infer<typeof TokenResponseSchema>;
