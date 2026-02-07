import { validateEnv } from './env.js';
import type { Env } from './env.js';
import { isMockMode } from './mock.js';

export const env: Env = validateEnv();

export { supportedChains, getChain, isSupportedChain, DEFAULT_CHAIN_ID } from './chains.js';
export type { SupportedChainId } from './chains.js';

export { contractAddresses, getContractAddresses, validateAddresses } from './addresses.js';
export type { ContractAddresses } from './addresses.js';

// ---------------------------------------------------------------------------
// Production mode validation
// When MOCK_MODE is disabled, DATABASE_URL and REDIS_URL must be provided.
// Without them the server would connect to non-existent default endpoints.
// ---------------------------------------------------------------------------
if (!isMockMode()) {
  if (!env.DATABASE_URL) {
    console.warn(
      '[config] WARNING: MOCK_MODE=false but DATABASE_URL is not set. ' +
      'Falling back to default postgresql://localhost:5432 -- this will fail ' +
      'unless PostgreSQL is running locally with matching credentials.'
    );
  }
  if (!env.REDIS_URL) {
    console.warn(
      '[config] WARNING: MOCK_MODE=false but REDIS_URL is not set. ' +
      'Falling back to default redis://localhost:6379 -- this will fail ' +
      'unless Redis is running locally.'
    );
  }
}

export const config = {
  env: env.NODE_ENV,
  port: parseInt(env.PORT, 10),
  host: env.HOST,
  mockMode: isMockMode(),

  database: {
    url: env.DATABASE_URL || 'postgresql://mock:mock@localhost:5432/mock',
  },

  redis: {
    url: env.REDIS_URL || 'redis://localhost:6379',
  },

  rpc: {
    8453: env.RPC_URL_BASE,
    84532: env.RPC_URL_BASE_SEPOLIA,
    42161: env.RPC_URL_ARBITRUM,
    10: env.RPC_URL_OPTIMISM,
  },

  // Number of trusted proxy hops for x-forwarded-for parsing
  trustProxyHops: parseInt(env.TRUSTED_PROXY_HOPS, 10),

  rateLimit: {
    max: parseInt(env.RATE_LIMIT_MAX, 10),
    timeWindow: parseInt(env.RATE_LIMIT_TIMEWINDOW, 10),
  },

  cors: {
    origin: env.FRONTEND_URL
      ? [env.FRONTEND_URL, ...env.CORS_ORIGIN.split(',').map(o => o.trim())]
      : env.CORS_ORIGIN.split(',').map(o => o.trim()),
  },

  logging: {
    level: env.LOG_LEVEL,
  },
} as const;
