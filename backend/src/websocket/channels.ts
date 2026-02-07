/**
 * WebSocket channel patterns
 * Clients subscribe to these channels to receive real-time updates
 */

/**
 * Channel: prices:chainId
 * Receives: All token price updates for a chain
 * Update frequency: Every 10 seconds
 */
export const pricesChannel = (chainId: number) => `prices:${chainId}`;

/**
 * Channel: pool:poolId
 * Receives: Updates for a specific pool
 * Update frequency: On every swap/mint/burn
 */
export const poolChannel = (poolId: string) => `pool:${poolId}`;

/**
 * Channel: pools:chainId
 * Receives: Updates for all pools on a chain
 * Update frequency: On every swap/mint/burn
 */
export const poolsChannel = (chainId: number) => `pools:${chainId}`;

/**
 * Channel: swaps:chainId
 * Receives: All swap events on a chain
 * Update frequency: Real-time (on every swap)
 */
export const swapsChannel = (chainId: number) => `swaps:${chainId}`;

/**
 * Channel: liquidity:chainId
 * Receives: All mint/burn events on a chain
 * Update frequency: Real-time (on every mint/burn)
 */
export const liquidityChannel = (chainId: number) => `liquidity:${chainId}`;

/**
 * Redis pub/sub channel patterns (internal)
 * These are used by the backend to publish updates
 */
export const RedisChannels = {
  prices: (chainId: number) => `channel:prices:${chainId}`,
  pool: (chainId: number, poolId: string) => `channel:pools:${chainId}:${poolId}`,
  pools: (chainId: number) => `channel:pools:${chainId}`,
  swaps: (chainId: number) => `channel:swaps:${chainId}`,
  liquidity: (chainId: number) => `channel:liquidity:${chainId}`,
};

/**
 * Available channels that clients can subscribe to
 */
export const AVAILABLE_CHANNELS = {
  PRICES: 'prices',
  POOL: 'pool',
  POOLS: 'pools',
  SWAPS: 'swaps',
  LIQUIDITY: 'liquidity',
} as const;
