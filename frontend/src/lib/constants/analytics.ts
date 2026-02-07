/**
 * Mock analytics data for development
 * In production, this will be fetched from the backend API
 */

export interface AnalyticsDataPoint {
  timestamp: number;
  date: string;
  value: number;
}

export interface ProtocolStats {
  totalValueLockedUsd: number;
  volume24hUsd: number;
  volume7dUsd: number;
  fees24hUsd: number;
  fees7dUsd: number;
  totalTransactions: number;
  uniqueUsers: number;
  poolCount: number;
}

/**
 * Generate mock historical data
 */
function generateMockData(days: number, baseValue: number, volatility: number): AnalyticsDataPoint[] {
  const data: AnalyticsDataPoint[] = [];
  const now = Date.now();
  let currentValue = baseValue;

  for (let i = days; i >= 0; i--) {
    const timestamp = now - i * 24 * 60 * 60 * 1000;
    const date = new Date(timestamp);

    // Add some random variation
    const change = (Math.random() - 0.5) * volatility;
    currentValue = Math.max(baseValue * 0.5, currentValue + change);

    data.push({
      timestamp,
      date: date.toISOString().split('T')[0],
      value: currentValue,
    });
  }

  return data;
}

/**
 * Get TVL historical data
 */
export function getTVLData(days: number = 30): AnalyticsDataPoint[] {
  return generateMockData(days, 108000000, 5000000); // ~$108M base, ±$5M daily
}

/**
 * Get Volume historical data
 */
export function getVolumeData(days: number = 30): AnalyticsDataPoint[] {
  return generateMockData(days, 65000000, 8000000); // ~$65M base, ±$8M daily
}

/**
 * Get Fees historical data
 */
export function getFeesData(days: number = 30): AnalyticsDataPoint[] {
  return generateMockData(days, 114000, 15000); // ~$114K base, ±$15K daily
}

/**
 * Get protocol statistics
 */
export function getProtocolStats(): ProtocolStats {
  const tvlData = getTVLData(7);
  const volumeData = getVolumeData(7);
  const feesData = getFeesData(7);

  return {
    totalValueLockedUsd: tvlData[tvlData.length - 1].value,
    volume24hUsd: volumeData[volumeData.length - 1].value,
    volume7dUsd: volumeData.reduce((sum, d) => sum + d.value, 0),
    fees24hUsd: feesData[feesData.length - 1].value,
    fees7dUsd: feesData.reduce((sum, d) => sum + d.value, 0),
    totalTransactions: 1250847,
    uniqueUsers: 45623,
    poolCount: 8,
  };
}

/**
 * Top pools by volume
 */
export interface TopPoolData {
  poolId: string;
  token0Symbol: string;
  token1Symbol: string;
  token0LogoURI?: string;
  token1LogoURI?: string;
  feeTier: number;
  volumeUsd: number;
  tvlUsd: number;
  feesUsd: number;
}

export function getTopPools(limit: number = 5): TopPoolData[] {
  return [
    {
      poolId: '0x2222222222222222222222222222222222222222222222222222222222222222',
      token0Symbol: 'ETH',
      token1Symbol: 'USDC',
      feeTier: 3000,
      volumeUsd: 25000000,
      tvlUsd: 45000000,
      feesUsd: 75000,
    },
    {
      poolId: '0x1111111111111111111111111111111111111111111111111111111111111111',
      token0Symbol: 'ETH',
      token1Symbol: 'USDC',
      feeTier: 500,
      volumeUsd: 8500000,
      tvlUsd: 12500000,
      feesUsd: 4250,
    },
    {
      poolId: '0x3333333333333333333333333333333333333333333333333333333333333333',
      token0Symbol: 'USDC',
      token1Symbol: 'DAI',
      feeTier: 100,
      volumeUsd: 12000000,
      tvlUsd: 8200000,
      feesUsd: 1200,
    },
    {
      poolId: '0x5555555555555555555555555555555555555555555555555555555555555555',
      token0Symbol: 'ETH',
      token1Symbol: 'DAI',
      feeTier: 3000,
      volumeUsd: 9500000,
      tvlUsd: 18000000,
      feesUsd: 28500,
    },
    {
      poolId: '0x7777777777777777777777777777777777777777777777777777777777777777',
      token0Symbol: 'ETH',
      token1Symbol: 'cbETH',
      feeTier: 500,
      volumeUsd: 4800000,
      tvlUsd: 9200000,
      feesUsd: 2400,
    },
  ].slice(0, limit);
}

/**
 * Top tokens by volume
 */
export interface TopTokenData {
  symbol: string;
  name: string;
  logoURI?: string;
  priceUsd: number;
  priceChange24h: number;
  volumeUsd: number;
  tvlUsd: number;
}

export function getTopTokens(limit: number = 5): TopTokenData[] {
  return [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      priceUsd: 2450.5,
      priceChange24h: 2.34,
      volumeUsd: 42800000,
      tvlUsd: 84700000,
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      priceUsd: 1.0,
      priceChange24h: 0.01,
      volumeUsd: 54500000,
      tvlUsd: 69400000,
    },
    {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      priceUsd: 1.0001,
      priceChange24h: -0.01,
      volumeUsd: 21500000,
      tvlUsd: 31200000,
    },
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      priceUsd: 2450.5,
      priceChange24h: 2.34,
      volumeUsd: 8000000,
      tvlUsd: 15700000,
    },
    {
      symbol: 'cbETH',
      name: 'Coinbase Wrapped Staked ETH',
      priceUsd: 2499.1,
      priceChange24h: 2.56,
      volumeUsd: 7200000,
      tvlUsd: 15700000,
    },
  ].slice(0, limit);
}

/**
 * Calculate percentage change
 */
export function calculateChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Get 24h change for stats
 */
export function get24hChange(data: AnalyticsDataPoint[]): number {
  if (data.length < 2) return 0;
  const current = data[data.length - 1].value;
  const previous = data[data.length - 2].value;
  return calculateChange(current, previous);
}
