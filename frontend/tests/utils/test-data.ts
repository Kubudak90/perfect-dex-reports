/**
 * Test Data Generators
 * Utilities for generating test data for comprehensive testing
 */

import { Token } from '../fixtures/tokens';

/**
 * Generate random Ethereum address
 */
export function generateAddress(): string {
  const hex = '0123456789abcdef';
  let address = '0x';
  for (let i = 0; i < 40; i++) {
    address += hex[Math.floor(Math.random() * 16)];
  }
  return address;
}

/**
 * Generate random token amount
 */
export function generateAmount(min: number = 0.001, max: number = 100): string {
  const amount = Math.random() * (max - min) + min;
  return amount.toFixed(8);
}

/**
 * Generate random token balance in wei
 */
export function generateBalance(decimals: number = 18): bigint {
  const amount = Math.random() * 1000;
  const multiplier = BigInt(10 ** decimals);
  return BigInt(Math.floor(amount * 100)) * multiplier / BigInt(100);
}

/**
 * Generate test token
 */
export function generateToken(overrides: Partial<Token> = {}): Token {
  const symbols = ['TEST', 'MOCK', 'DEMO', 'FAKE', 'STUB'];
  const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];

  return {
    address: generateAddress(),
    symbol: randomSymbol + Math.floor(Math.random() * 1000),
    name: `Test Token ${Math.floor(Math.random() * 1000)}`,
    decimals: 18,
    chainId: 8453,
    ...overrides,
  };
}

/**
 * Generate multiple test tokens
 */
export function generateTokens(count: number): Token[] {
  return Array.from({ length: count }, () => generateToken());
}

/**
 * Generate pool data
 */
export interface TestPool {
  id: string;
  token0: Token;
  token1: Token;
  feeTier: number;
  tvl: string;
  volume24h: string;
  apr: string;
}

export function generatePool(overrides: Partial<TestPool> = {}): TestPool {
  return {
    id: generateAddress() + generateAddress(),
    token0: generateToken(),
    token1: generateToken(),
    feeTier: [100, 500, 3000, 10000][Math.floor(Math.random() * 4)],
    tvl: (Math.random() * 10000000).toFixed(2),
    volume24h: (Math.random() * 1000000).toFixed(2),
    apr: (Math.random() * 100).toFixed(2),
    ...overrides,
  };
}

/**
 * Generate multiple pools
 */
export function generatePools(count: number): TestPool[] {
  return Array.from({ length: count }, () => generatePool());
}

/**
 * Generate position data
 */
export interface TestPosition {
  tokenId: number;
  pool: TestPool;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  amount0: string;
  amount1: string;
  unclaimedFees0: string;
  unclaimedFees1: string;
  inRange: boolean;
}

export function generatePosition(overrides: Partial<TestPosition> = {}): TestPosition {
  const currentTick = Math.floor(Math.random() * 100000) - 50000;
  const tickLower = currentTick - Math.floor(Math.random() * 10000);
  const tickUpper = currentTick + Math.floor(Math.random() * 10000);

  return {
    tokenId: Math.floor(Math.random() * 100000),
    pool: generatePool(),
    tickLower,
    tickUpper,
    liquidity: (Math.random() * 1000000).toFixed(0),
    amount0: (Math.random() * 100).toFixed(6),
    amount1: (Math.random() * 100000).toFixed(2),
    unclaimedFees0: (Math.random() * 10).toFixed(6),
    unclaimedFees1: (Math.random() * 1000).toFixed(2),
    inRange: currentTick >= tickLower && currentTick <= tickUpper,
    ...overrides,
  };
}

/**
 * Generate multiple positions
 */
export function generatePositions(count: number): TestPosition[] {
  return Array.from({ length: count }, () => generatePosition());
}

/**
 * Generate swap data
 */
export interface TestSwap {
  hash: string;
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
  amountOut: string;
  priceImpact: string;
  gasUsed: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
}

export function generateSwap(overrides: Partial<TestSwap> = {}): TestSwap {
  return {
    hash: '0x' + Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join(''),
    tokenIn: generateToken(),
    tokenOut: generateToken(),
    amountIn: generateAmount(0.1, 10),
    amountOut: generateAmount(100, 10000),
    priceImpact: (Math.random() * 5).toFixed(2),
    gasUsed: (Math.random() * 0.01).toFixed(6),
    timestamp: Date.now() - Math.floor(Math.random() * 86400000),
    status: ['pending', 'confirmed', 'failed'][Math.floor(Math.random() * 3)] as any,
    ...overrides,
  };
}

/**
 * Generate multiple swaps
 */
export function generateSwaps(count: number): TestSwap[] {
  return Array.from({ length: count }, () => generateSwap());
}

/**
 * Generate quote response
 */
export interface TestQuote {
  amountOut: string;
  executionPrice: string;
  priceImpact: string;
  route: string[];
  gasEstimate: string;
  minimumAmountOut: string;
}

export function generateQuote(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  overrides: Partial<TestQuote> = {}
): TestQuote {
  const rate = Math.random() * 3000 + 1000; // Random exchange rate
  const amountOutValue = parseFloat(amountIn) * rate;
  const priceImpact = Math.random() * 2; // 0-2% impact

  return {
    amountOut: amountOutValue.toFixed(6),
    executionPrice: rate.toFixed(2),
    priceImpact: priceImpact.toFixed(2),
    route: [tokenIn.symbol, tokenOut.symbol],
    gasEstimate: (Math.random() * 0.005).toFixed(6),
    minimumAmountOut: (amountOutValue * (1 - 0.005)).toFixed(6), // 0.5% slippage
    ...overrides,
  };
}

/**
 * Generate multi-hop quote
 */
export function generateMultiHopQuote(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: string,
  hops: number = 2
): TestQuote {
  const intermediateTokens = generateTokens(hops - 1);
  const route = [
    tokenIn.symbol,
    ...intermediateTokens.map((t) => t.symbol),
    tokenOut.symbol,
  ];

  const rate = Math.random() * 3000 + 1000;
  const amountOutValue = parseFloat(amountIn) * rate;
  const priceImpact = Math.random() * 4; // Higher impact for multi-hop

  return {
    amountOut: amountOutValue.toFixed(6),
    executionPrice: rate.toFixed(2),
    priceImpact: priceImpact.toFixed(2),
    route,
    gasEstimate: (Math.random() * 0.01 * hops).toFixed(6), // More gas for more hops
    minimumAmountOut: (amountOutValue * (1 - 0.005)).toFixed(6),
  };
}

/**
 * Generate chart data points
 */
export interface ChartDataPoint {
  timestamp: number;
  value: number;
}

export function generateChartData(
  points: number = 24,
  baseValue: number = 1000000,
  volatility: number = 0.1
): ChartDataPoint[] {
  const now = Date.now();
  const interval = 3600000; // 1 hour

  let currentValue = baseValue;
  const data: ChartDataPoint[] = [];

  for (let i = points - 1; i >= 0; i--) {
    // Random walk with trend
    const change = (Math.random() - 0.5) * 2 * volatility * currentValue;
    currentValue = Math.max(0, currentValue + change);

    data.push({
      timestamp: now - i * interval,
      value: currentValue,
    });
  }

  return data.reverse();
}

/**
 * Generate price history (OHLCV)
 */
export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function generatePriceHistory(
  candles: number = 100,
  basePrice: number = 2450
): OHLCV[] {
  const now = Date.now();
  const interval = 3600000; // 1 hour

  let currentPrice = basePrice;
  const data: OHLCV[] = [];

  for (let i = candles - 1; i >= 0; i--) {
    const open = currentPrice;
    const volatility = 0.02; // 2% volatility

    // Random price movement
    const high = open * (1 + Math.random() * volatility);
    const low = open * (1 - Math.random() * volatility);
    const close = low + Math.random() * (high - low);

    currentPrice = close;

    data.push({
      timestamp: now - i * interval,
      open,
      high,
      low,
      close,
      volume: Math.random() * 1000000,
    });
  }

  return data.reverse();
}

/**
 * Generate liquidity distribution data
 */
export interface LiquidityDistribution {
  tick: number;
  liquidityGross: string;
  liquidityNet: string;
  price: number;
}

export function generateLiquidityDistribution(
  points: number = 50,
  currentTick: number = 0
): LiquidityDistribution[] {
  const tickSpacing = 60;
  const data: LiquidityDistribution[] = [];

  for (let i = -points / 2; i < points / 2; i++) {
    const tick = currentTick + i * tickSpacing;
    const distanceFromCurrent = Math.abs(i);

    // More liquidity near current price
    const liquidityAmount =
      Math.random() * 1000000 * Math.exp(-distanceFromCurrent / 10);

    data.push({
      tick,
      liquidityGross: liquidityAmount.toFixed(0),
      liquidityNet: (liquidityAmount * (Math.random() - 0.5)).toFixed(0),
      price: Math.pow(1.0001, tick),
    });
  }

  return data;
}

/**
 * Generate analytics data
 */
export interface AnalyticsData {
  tvl: string;
  volume24h: string;
  fees24h: string;
  transactions24h: number;
  uniqueUsers24h: number;
  volumeChange24h: number;
  tvlChange24h: number;
}

export function generateAnalyticsData(): AnalyticsData {
  return {
    tvl: (Math.random() * 100000000).toFixed(2),
    volume24h: (Math.random() * 10000000).toFixed(2),
    fees24h: (Math.random() * 100000).toFixed(2),
    transactions24h: Math.floor(Math.random() * 10000),
    uniqueUsers24h: Math.floor(Math.random() * 1000),
    volumeChange24h: (Math.random() - 0.5) * 50, // -25% to +25%
    tvlChange24h: (Math.random() - 0.5) * 20, // -10% to +10%
  };
}

/**
 * Generate mock API responses
 */
export const mockApiResponses = {
  /**
   * Token list response
   */
  tokenList: (count: number = 10) => ({
    tokens: generateTokens(count),
    total: count,
  }),

  /**
   * Pool list response
   */
  poolList: (count: number = 20) => ({
    pools: generatePools(count),
    total: count,
  }),

  /**
   * Quote response
   */
  quote: (tokenIn: Token, tokenOut: Token, amountIn: string) =>
    generateQuote(tokenIn, tokenOut, amountIn),

  /**
   * Position list response
   */
  positions: (count: number = 5) => ({
    positions: generatePositions(count),
    total: count,
  }),

  /**
   * Swap history response
   */
  swapHistory: (count: number = 10) => ({
    swaps: generateSwaps(count),
    total: count,
  }),

  /**
   * Analytics response
   */
  analytics: () => generateAnalyticsData(),

  /**
   * Chart data response
   */
  chartData: (interval: string = '1h', points: number = 24) => ({
    interval,
    data: generateChartData(points),
  }),

  /**
   * Price history response
   */
  priceHistory: (candles: number = 100) => ({
    data: generatePriceHistory(candles),
  }),
};

/**
 * Test scenarios
 */
export const testScenarios = {
  /**
   * Happy path swap
   */
  happyPathSwap: {
    amountIn: '1',
    expectedOutput: '2450',
    priceImpact: '0.15',
    gasEstimate: '0.002',
  },

  /**
   * Large swap (high price impact)
   */
  largeSwap: {
    amountIn: '100',
    expectedOutput: '240000',
    priceImpact: '5.2',
    gasEstimate: '0.003',
  },

  /**
   * Small swap (dust amount)
   */
  smallSwap: {
    amountIn: '0.000001',
    expectedOutput: '0.00245',
    priceImpact: '0.01',
    gasEstimate: '0.002',
  },

  /**
   * Multi-hop swap
   */
  multiHopSwap: {
    amountIn: '1000',
    route: ['DAI', 'USDC', 'WETH', 'WBTC'],
    hops: 3,
    priceImpact: '2.5',
    gasEstimate: '0.008',
  },

  /**
   * Add liquidity - full range
   */
  addLiquidityFullRange: {
    amount0: '1',
    amount1: '2450',
    tickLower: -887220,
    tickUpper: 887220,
    estimatedApr: '15.5',
  },

  /**
   * Add liquidity - concentrated
   */
  addLiquidityConcentrated: {
    amount0: '1',
    amount1: '2450',
    tickLower: -1000,
    tickUpper: 1000,
    estimatedApr: '45.2',
  },

  /**
   * Remove liquidity - partial
   */
  removeLiquidityPartial: {
    percentage: 50,
    expectedAmount0: '0.5',
    expectedAmount1: '1225',
  },

  /**
   * Remove liquidity - full
   */
  removeLiquidityFull: {
    percentage: 100,
    expectedAmount0: '1',
    expectedAmount1: '2450',
    collectFees: true,
  },
};

/**
 * Error scenarios
 */
export const errorScenarios = {
  insufficientBalance: {
    error: 'Insufficient balance',
    code: 'INSUFFICIENT_BALANCE',
  },

  insufficientLiquidity: {
    error: 'Insufficient liquidity in pool',
    code: 'INSUFFICIENT_LIQUIDITY',
  },

  slippageExceeded: {
    error: 'Price slippage exceeded tolerance',
    code: 'SLIPPAGE_EXCEEDED',
  },

  networkError: {
    error: 'Network request failed',
    code: 'NETWORK_ERROR',
  },

  invalidInput: {
    error: 'Invalid input amount',
    code: 'INVALID_INPUT',
  },

  transactionReverted: {
    error: 'Transaction reverted',
    code: 'TRANSACTION_REVERTED',
  },

  walletRejected: {
    error: 'User rejected transaction',
    code: 'USER_REJECTED',
  },

  wrongNetwork: {
    error: 'Wrong network. Please switch to Base',
    code: 'WRONG_NETWORK',
  },
};
