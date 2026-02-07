import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  HOST: z.string().default('0.0.0.0'),

  // Mock mode - allows running without DB/Redis
  MOCK_MODE: z.enum(['true', 'false']).default('false'),

  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),

  RPC_URL_BASE: z.string().url().optional(),
  RPC_URL_BASE_SEPOLIA: z.string().url().optional(),
  RPC_URL_ARBITRUM: z.string().url().optional(),
  RPC_URL_OPTIMISM: z.string().url().optional(),

  // Chainlink price feed RPC (defaults to RPC_URL_BASE if not set)
  CHAINLINK_RPC_URL: z.string().url().optional(),

  // Router service
  ROUTER_API_URL: z.string().url().default('http://localhost:3001'),

  // The Graph
  SUBGRAPH_URL: z.string().url().optional(),

  // Contract addresses - Base Mainnet (8453)
  POOL_MANAGER_ADDRESS_8453: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  SWAP_ROUTER_ADDRESS_8453: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  POSITION_MANAGER_ADDRESS_8453: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  QUOTER_ADDRESS_8453: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  PERMIT2_ADDRESS_8453: z.string().regex(/^0x[a-fA-F0-9]{40}$/).default('0x000000000022D473030F116dDEE9F6B43aC78BA3'),

  // Contract addresses - Base Sepolia (84532)
  POOL_MANAGER_ADDRESS_84532: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  SWAP_ROUTER_ADDRESS_84532: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  POSITION_MANAGER_ADDRESS_84532: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  QUOTER_ADDRESS_84532: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  PERMIT2_ADDRESS_84532: z.string().regex(/^0x[a-fA-F0-9]{40}$/).default('0x000000000022D473030F116dDEE9F6B43aC78BA3'),

  // Hook Addresses - Base Sepolia (84532)
  DYNAMIC_FEE_HOOK_ADDRESS_84532: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  ORACLE_HOOK_ADDRESS_84532: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  LIMIT_ORDER_HOOK_ADDRESS_84532: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  MEV_PROTECTION_HOOK_ADDRESS_84532: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  TWAP_ORDER_HOOK_ADDRESS_84532: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  AUTO_COMPOUND_HOOK_ADDRESS_84532: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),

  // Optional
  COINGECKO_API_KEY: z.string().optional(),
  THE_GRAPH_API_KEY: z.string().optional(),

  // Proxy trust configuration
  // Number of trusted proxy hops (e.g., 1 for a single load balancer/reverse proxy)
  // Set to the number of proxies between the client and this server
  TRUSTED_PROXY_HOPS: z.string().default('1'),

  // Rate limiting
  RATE_LIMIT_MAX: z.string().default('100'),
  RATE_LIMIT_TIMEWINDOW: z.string().default('60000'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3001'),

  // Frontend URL (used for CORS origin when set)
  FRONTEND_URL: z.string().optional(),

  // API Authentication
  // Comma-separated list of valid API keys. Leave empty to disable auth (dev mode).
  API_KEYS: z.string().default(''),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:');
      console.error(JSON.stringify(error.errors, null, 2));
      process.exit(1);
    }
    throw error;
  }
}

// Export validated env instance
export const env = validateEnv();
