import { Address } from 'viem';

/**
 * Pool information
 */
export interface Pool {
  id: string; // Pool ID (keccak256 of PoolKey)
  chainId: number;

  // Tokens
  token0: Address;
  token1: Address;
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
  token0LogoURI?: string;
  token1LogoURI?: string;

  // Pool params
  feeTier: number; // 100, 500, 3000, 10000 (basis points)
  tickSpacing: number;
  hookAddress?: Address;

  // Current state
  sqrtPriceX96: string;
  tick: number;
  liquidity: string;

  // Pricing
  token0Price: number; // Price of token0 in terms of token1
  token1Price: number; // Price of token1 in terms of token0

  // Stats
  tvlUsd: number;
  volume24hUsd: number;
  fees24hUsd: number;
  apr24h: number;
}

/**
 * Position (LP NFT)
 */
export interface Position {
  tokenId: number;
  owner: Address;
  chainId: number;

  // Pool reference
  poolId: string;

  // Range
  tickLower: number;
  tickUpper: number;

  // Liquidity
  liquidity: string;

  // Token amounts
  amount0: string;
  amount1: string;

  // Fees
  unclaimedFees0: string;
  unclaimedFees1: string;

  // Status
  inRange: boolean;
}

/**
 * Tick data
 */
export interface Tick {
  tickIdx: number;
  liquidityGross: string;
  liquidityNet: string;
  feeGrowthOutside0X128: string;
  feeGrowthOutside1X128: string;
}

/**
 * Fee tier options
 */
export const FEE_TIERS = [
  { fee: 100, label: '0.01%', description: 'Best for stablecoin pairs' },
  { fee: 500, label: '0.05%', description: 'Best for stable pairs' },
  { fee: 3000, label: '0.3%', description: 'Best for most pairs' },
  { fee: 10000, label: '1%', description: 'Best for exotic pairs' },
] as const;

/**
 * Tick spacing for each fee tier
 */
export const TICK_SPACINGS: Record<number, number> = {
  100: 1,
  500: 10,
  3000: 60,
  10000: 200,
};
