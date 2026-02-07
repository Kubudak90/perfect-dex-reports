import { Address } from 'viem';

/**
 * Swap quote from backend
 */
export interface SwapQuote {
  // Input
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string; // Raw amount (wei)

  // Output
  amountOut: string; // Expected output (wei)
  amountOutMin: string; // Min output with slippage (wei)

  // Pricing
  executionPrice: number; // Price per unit
  priceImpact: number; // Percentage (0.15 = 0.15%)

  // Route
  route: SwapRoute;

  // Gas
  gasEstimate: string; // Estimated gas units
  gasEstimateUsd?: number;

  // Metadata
  timestamp: number;
  validUntil: number; // Unix timestamp
}

/**
 * Swap route
 */
export interface SwapRoute {
  paths: SwapPath[];
  hops: number; // Number of hops
  splits: number; // Number of splits
}

/**
 * Single path in a route
 */
export interface SwapPath {
  pools: PoolInPath[];
  percentage: number; // Percentage of input (100 = 100%)
}

/**
 * Pool in a path
 */
export interface PoolInPath {
  poolId: string;
  tokenIn: Address;
  tokenOut: Address;
  fee: number; // Fee tier (100, 500, 3000, 10000)
}

/**
 * Swap settings
 */
export interface SwapSettings {
  slippageTolerance: number; // Percentage (0.5 = 0.5%)
  deadline: number; // Minutes
  expertMode: boolean;
  multihopEnabled: boolean;
}

/**
 * Swap state
 */
export interface SwapState {
  tokenIn: Address | null;
  tokenOut: Address | null;
  amountIn: string;
  isExactIn: boolean;
}

/**
 * Price impact severity
 */
export type PriceImpactSeverity = 'low' | 'medium' | 'high' | 'severe';

/**
 * Swap status
 */
export type SwapStatus = 'idle' | 'approving' | 'swapping' | 'success' | 'error';
