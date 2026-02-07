/**
 * API Configuration
 * Centralized configuration for API and WebSocket endpoints
 */

export const API_CONFIG = {
  // Base URLs
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1',
  wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',

  // Timeouts (in milliseconds)
  timeout: 30000, // 30 seconds
  quoteTimeout: 10000, // 10 seconds for quotes
  wsReconnectDelay: 1000, // Start with 1 second
  wsMaxReconnectAttempts: 5,
  wsPingInterval: 30000, // 30 seconds

  // Cache TTL (in seconds)
  cache: {
    prices: 10, // Price cache: 10 seconds
    pools: 30, // Pool data: 30 seconds
    tokens: 300, // Token data: 5 minutes
    quotes: 15, // Quote cache: 15 seconds
  },

  // Endpoints
  endpoints: {
    // Health
    health: '/health',

    // Swap
    quote: '/swap/quote',
    route: '/swap/route',
    buildTx: '/swap/build-tx',

    // Pools
    pools: '/pools',
    poolById: (poolId: string) => `/pools/${poolId}`,
    poolTicks: (poolId: string) => `/pools/${poolId}/ticks`,
    poolTransactions: (poolId: string) => `/pools/${poolId}/transactions`,
    poolChart: (poolId: string) => `/pools/${poolId}/chart`,

    // Tokens
    tokens: '/tokens',
    tokenById: (address: string) => `/tokens/${address}`,
    tokenPrice: (address: string) => `/tokens/${address}/price`,
    tokenSearch: '/tokens/search',

    // Positions
    positions: '/positions',
    positionsByOwner: (owner: string) => `/positions/owner/${owner}`,
    positionById: (tokenId: string) => `/positions/${tokenId}`,

    // Analytics
    analyticsOverview: '/analytics/overview',
    analyticsVolume: '/analytics/volume',
    analyticsTVL: '/analytics/tvl',
    analyticsFees: '/analytics/fees',
    analyticsTopPools: '/analytics/top-pools',
    analyticsTopTokens: '/analytics/top-tokens',
  },

  // WebSocket channels
  wsChannels: {
    prices: 'prices',
    swaps: 'swaps',
    pools: 'pools',
    pool: (poolId: string) => `pool:${poolId}`,
    positions: 'positions',
    position: (tokenId: string) => `position:${tokenId}`,
  },
} as const;

/**
 * Get full API URL for an endpoint
 */
export function getApiUrl(endpoint: string): string {
  return `${API_CONFIG.baseUrl}${endpoint}`;
}

/**
 * Get WebSocket URL
 */
export function getWsUrl(): string {
  return API_CONFIG.wsUrl;
}

/**
 * Check if API is available
 */
export async function checkApiAvailability(): Promise<boolean> {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.endpoints.health), {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}
