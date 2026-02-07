import { Pool } from '@/types/pool';
import { getDefaultTokens } from './tokens';

/**
 * Mock pool data for development
 * In production, this will be fetched from the backend API
 */
export function getMockPools(): Pool[] {
  const tokens = getDefaultTokens(8453); // Base chain
  const eth = tokens.find((t) => t.symbol === 'ETH')!;
  const usdc = tokens.find((t) => t.symbol === 'USDC')!;
  const dai = tokens.find((t) => t.symbol === 'DAI')!;
  const weth = tokens.find((t) => t.symbol === 'WETH')!;
  const usdbc = tokens.find((t) => t.symbol === 'USDbC')!;
  const cbeth = tokens.find((t) => t.symbol === 'cbETH')!;

  return [
    // ETH/USDC - 0.05%
    {
      id: '0x1111111111111111111111111111111111111111111111111111111111111111',
      chainId: 8453,
      token0: eth.address,
      token1: usdc.address,
      token0Symbol: eth.symbol,
      token1Symbol: usdc.symbol,
      token0Decimals: eth.decimals,
      token1Decimals: usdc.decimals,
      token0LogoURI: eth.logoURI,
      token1LogoURI: usdc.logoURI,
      feeTier: 500,
      tickSpacing: 10,
      sqrtPriceX96: '1976270172732118080506486064',
      tick: 80261,
      liquidity: '12345678901234567890',
      token0Price: 2450.5,
      token1Price: 0.000408,
      tvlUsd: 12500000,
      volume24hUsd: 8500000,
      fees24hUsd: 4250,
      apr24h: 24.5,
    },

    // ETH/USDC - 0.3%
    {
      id: '0x2222222222222222222222222222222222222222222222222222222222222222',
      chainId: 8453,
      token0: eth.address,
      token1: usdc.address,
      token0Symbol: eth.symbol,
      token1Symbol: usdc.symbol,
      token0Decimals: eth.decimals,
      token1Decimals: usdc.decimals,
      token0LogoURI: eth.logoURI,
      token1LogoURI: usdc.logoURI,
      feeTier: 3000,
      tickSpacing: 60,
      sqrtPriceX96: '1976270172732118080506486064',
      tick: 80261,
      liquidity: '23456789012345678901',
      token0Price: 2450.5,
      token1Price: 0.000408,
      tvlUsd: 45000000,
      volume24hUsd: 25000000,
      fees24hUsd: 75000,
      apr24h: 45.2,
    },

    // USDC/DAI - 0.01%
    {
      id: '0x3333333333333333333333333333333333333333333333333333333333333333',
      chainId: 8453,
      token0: usdc.address,
      token1: dai.address,
      token0Symbol: usdc.symbol,
      token1Symbol: dai.symbol,
      token0Decimals: usdc.decimals,
      token1Decimals: dai.decimals,
      token0LogoURI: usdc.logoURI,
      token1LogoURI: dai.logoURI,
      feeTier: 100,
      tickSpacing: 1,
      sqrtPriceX96: '79228162514264337593543950336',
      tick: 0,
      liquidity: '34567890123456789012',
      token0Price: 1.0001,
      token1Price: 0.9999,
      tvlUsd: 8200000,
      volume24hUsd: 12000000,
      fees24hUsd: 1200,
      apr24h: 3.8,
    },

    // WETH/cbETH - 0.05%
    {
      id: '0x4444444444444444444444444444444444444444444444444444444444444444',
      chainId: 8453,
      token0: weth.address,
      token1: cbeth.address,
      token0Symbol: weth.symbol,
      token1Symbol: cbeth.symbol,
      token0Decimals: weth.decimals,
      token1Decimals: cbeth.decimals,
      token0LogoURI: weth.logoURI,
      token1LogoURI: cbeth.logoURI,
      feeTier: 500,
      tickSpacing: 10,
      sqrtPriceX96: '79228162514264337593543950336',
      tick: 0,
      liquidity: '45678901234567890123',
      token0Price: 1.02,
      token1Price: 0.98,
      tvlUsd: 6500000,
      volume24hUsd: 3200000,
      fees24hUsd: 1600,
      apr24h: 18.5,
    },

    // ETH/DAI - 0.3%
    {
      id: '0x5555555555555555555555555555555555555555555555555555555555555555',
      chainId: 8453,
      token0: eth.address,
      token1: dai.address,
      token0Symbol: eth.symbol,
      token1Symbol: dai.symbol,
      token0Decimals: eth.decimals,
      token1Decimals: dai.decimals,
      token0LogoURI: eth.logoURI,
      token1LogoURI: dai.logoURI,
      feeTier: 3000,
      tickSpacing: 60,
      sqrtPriceX96: '1976270172732118080506486064',
      tick: 80261,
      liquidity: '56789012345678901234',
      token0Price: 2450.5,
      token1Price: 0.000408,
      tvlUsd: 18000000,
      volume24hUsd: 9500000,
      fees24hUsd: 28500,
      apr24h: 38.7,
    },

    // USDC/USDbC - 0.01%
    {
      id: '0x6666666666666666666666666666666666666666666666666666666666666666',
      chainId: 8453,
      token0: usdc.address,
      token1: usdbc.address,
      token0Symbol: usdc.symbol,
      token1Symbol: usdbc.symbol,
      token0Decimals: usdc.decimals,
      token1Decimals: usdbc.decimals,
      token0LogoURI: usdc.logoURI,
      token1LogoURI: usdbc.logoURI,
      feeTier: 100,
      tickSpacing: 1,
      sqrtPriceX96: '79228162514264337593543950336',
      tick: 0,
      liquidity: '67890123456789012345',
      token0Price: 1.0,
      token1Price: 1.0,
      tvlUsd: 5500000,
      volume24hUsd: 8000000,
      fees24hUsd: 800,
      apr24h: 4.2,
    },

    // ETH/cbETH - 0.05%
    {
      id: '0x7777777777777777777777777777777777777777777777777777777777777777',
      chainId: 8453,
      token0: eth.address,
      token1: cbeth.address,
      token0Symbol: eth.symbol,
      token1Symbol: cbeth.symbol,
      token0Decimals: eth.decimals,
      token1Decimals: cbeth.decimals,
      token0LogoURI: eth.logoURI,
      token1LogoURI: cbeth.logoURI,
      feeTier: 500,
      tickSpacing: 10,
      sqrtPriceX96: '79228162514264337593543950336',
      tick: 0,
      liquidity: '78901234567890123456',
      token0Price: 1.02,
      token1Price: 0.98,
      tvlUsd: 9200000,
      volume24hUsd: 4800000,
      fees24hUsd: 2400,
      apr24h: 22.3,
    },

    // DAI/USDbC - 0.05%
    {
      id: '0x8888888888888888888888888888888888888888888888888888888888888888',
      chainId: 8453,
      token0: dai.address,
      token1: usdbc.address,
      token0Symbol: dai.symbol,
      token1Symbol: usdbc.symbol,
      token0Decimals: dai.decimals,
      token1Decimals: usdbc.decimals,
      token0LogoURI: dai.logoURI,
      token1LogoURI: usdbc.logoURI,
      feeTier: 500,
      tickSpacing: 10,
      sqrtPriceX96: '79228162514264337593543950336',
      tick: 0,
      liquidity: '89012345678901234567',
      token0Price: 1.0001,
      token1Price: 0.9999,
      tvlUsd: 3800000,
      volume24hUsd: 2100000,
      fees24hUsd: 1050,
      apr24h: 8.5,
    },
  ];
}

/**
 * Get a pool by ID
 */
export function getMockPoolById(poolId: string): Pool | undefined {
  return getMockPools().find((p) => p.id === poolId);
}

/**
 * Mock pool transactions
 */
export interface PoolTransaction {
  id: string;
  type: 'swap' | 'mint' | 'burn';
  timestamp: number;
  account: string;
  token0Amount: string;
  token1Amount: string;
  amountUsd: number;
  txHash: string;
}

export function getMockPoolTransactions(poolId: string): PoolTransaction[] {
  // Generate some mock transactions
  const now = Date.now();
  const transactions: PoolTransaction[] = [];

  for (let i = 0; i < 20; i++) {
    const type = ['swap', 'mint', 'burn'][Math.floor(Math.random() * 3)] as PoolTransaction['type'];
    transactions.push({
      id: `tx-${i}`,
      type,
      timestamp: now - i * 5 * 60 * 1000, // Every 5 minutes
      account: `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`,
      token0Amount: type === 'swap' ? (Math.random() * 10).toFixed(6) : (Math.random() * 100).toFixed(6),
      token1Amount: type === 'swap' ? (Math.random() * 20000).toFixed(2) : (Math.random() * 200000).toFixed(2),
      amountUsd: Math.random() * 50000,
      txHash: `0x${Math.random().toString(16).slice(2)}`,
    });
  }

  return transactions;
}

/**
 * Mock tick data for liquidity distribution
 */
export interface TickData {
  tickIdx: number;
  liquidityGross: bigint;
  liquidityNet: bigint;
  price: number;
}

export function getMockTickData(poolId: string): TickData[] {
  const pool = getMockPoolById(poolId);
  if (!pool) return [];

  const currentTick = pool.tick;
  const tickSpacing = pool.tickSpacing;
  const ticks: TickData[] = [];

  // Generate ticks around current price
  for (let i = -50; i <= 50; i++) {
    const tickIdx = currentTick + i * tickSpacing;
    const distance = Math.abs(i);

    // More liquidity near current price
    const liquidityAmount = BigInt(
      Math.floor((100000000 / (1 + distance * 0.5)) * 1e18)
    );

    ticks.push({
      tickIdx,
      liquidityGross: liquidityAmount,
      liquidityNet: i % 2 === 0 ? liquidityAmount : -liquidityAmount,
      price: 1.0001 ** tickIdx,
    });
  }

  return ticks;
}
