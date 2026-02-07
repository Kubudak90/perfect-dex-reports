import { env } from './env.js';

/**
 * External service configurations
 */
export const services = {
  /**
   * Rust Router Service
   * Used for optimal swap route calculation
   */
  router: {
    url: env.ROUTER_API_URL,
    timeout: 5000, // 5 seconds
    endpoints: {
      quote: '/quote',
      route: '/route',
      health: '/health',
    },
  },

  /**
   * The Graph Subgraph
   * Used for historical data and event indexing
   */
  subgraph: {
    url: env.SUBGRAPH_URL,
    timeout: 10000, // 10 seconds
  },

  /**
   * CoinGecko API
   * Used for token price data (optional)
   */
  coingecko: {
    apiKey: env.COINGECKO_API_KEY,
    baseUrl: 'https://api.coingecko.com/api/v3',
    timeout: 5000,
  },
} as const;

/**
 * Get full URL for router endpoint
 */
export function getRouterUrl(endpoint: keyof typeof services.router.endpoints): string {
  return `${services.router.url}${services.router.endpoints[endpoint]}`;
}

/**
 * Check if subgraph is configured
 */
export function isSubgraphConfigured(): boolean {
  return !!services.subgraph.url;
}

/**
 * Check if CoinGecko API is configured
 */
export function isCoinGeckoConfigured(): boolean {
  return !!services.coingecko.apiKey;
}
