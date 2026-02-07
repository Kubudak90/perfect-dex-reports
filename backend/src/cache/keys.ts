export const CacheKeys = {
  // Prices (TTL: 10s)
  price: (chainId: number, address: string) => `price:${chainId}:${address}`,
  prices: (chainId: number) => `prices:${chainId}`,

  // Pools (TTL: 30s)
  pool: (chainId: number, poolId: string) => `pool:${chainId}:${poolId}`,
  poolState: (chainId: number, poolId: string) => `pool:state:${chainId}:${poolId}`,
  poolList: (chainId: number, sortBy: string) => `pool:list:${chainId}:top:${sortBy}`,
  poolTicks: (chainId: number, poolId: string) => `pool:ticks:${chainId}:${poolId}`,

  // Tokens (TTL: 5m)
  token: (chainId: number, address: string) => `token:${chainId}:${address}`,
  tokenList: (chainId: number) => `token:list:${chainId}`,
  tokenTrending: (chainId: number) => `token:trending:${chainId}`,
  tokenSearch: (chainId: number, query: string) => `token:search:${chainId}:${query}`,

  // Routes (TTL: 15s)
  route: (chainId: number, tokenIn: string, tokenOut: string, bucket: string) =>
    `route:${chainId}:${tokenIn}:${tokenOut}:${bucket}`,
  quote: (chainId: number, tokenIn: string, tokenOut: string, amount: string) =>
    `quote:${chainId}:${tokenIn}:${tokenOut}:${amount}`,

  // User (TTL: 30s)
  userPositions: (chainId: number, address: string) =>
    `user:${chainId}:${address}:positions`,
  userBalances: (chainId: number, address: string) =>
    `user:${chainId}:${address}:balances`,

  // Positions (TTL: 30s)
  position: (chainId: number, tokenId: string) => `position:${chainId}:${tokenId}`,

  // Analytics (TTL: 1-5m)
  analyticsOverview: (chainId: number) => `analytics:${chainId}:overview`,
  analyticsVolume: (chainId: number) => `analytics:${chainId}:volume:daily`,
  analyticsTVL: (chainId: number) => `analytics:${chainId}:tvl:daily`,

  // Oracle (TTL: 10-30s)
  oraclePrices: (chainId: number, tokens: string) => `oracle:prices:${chainId}:${tokens}`,
  oracleTWAP: (chainId: number, token: string, period: number) =>
    `oracle:twap:${chainId}:${token}:${period}`,

  // Chainlink price feeds (TTL: 30s)
  chainlinkPrice: (chainId: number, address: string) =>
    `chainlink:price:${chainId}:${address}`,
};

export const CacheTTL = {
  price: 10,
  pool: 30,
  poolState: 15,
  poolList: 300,
  token: 300,
  route: 15,
  quote: 10,
  user: 30,
  analytics: 60,
  chainlinkPrice: 30,
};
