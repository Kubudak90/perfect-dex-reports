import { getContract, type Address } from 'viem';
import { getBlockchainClient } from '../client.js';
import { QUOTER_ABI } from '../abis/quoter.js';
import { getContractAddresses } from '../../config/index.js';

/**
 * Pool key structure
 */
export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

/**
 * Quote params for single-hop swap
 */
export interface QuoteExactInputSingleParams {
  poolKey: PoolKey;
  zeroForOne: boolean;
  exactAmount: bigint;
  sqrtPriceLimitX96: bigint;
  hookData: `0x${string}`;
}

/**
 * Quote result
 */
export interface QuoteResult {
  amountOut: bigint;
  gasEstimate: bigint;
}

/**
 * Get Quoter contract instance
 */
export function getQuoterContract(chainId: number) {
  const client = getBlockchainClient(chainId);
  const addresses = getContractAddresses(chainId);

  return getContract({
    address: addresses.quoter,
    abi: QUOTER_ABI,
    client,
  });
}

/**
 * Get quote for exact input single-hop swap
 */
export async function quoteExactInputSingle(
  chainId: number,
  params: QuoteExactInputSingleParams
): Promise<QuoteResult> {
  const contract = getQuoterContract(chainId);

  const result = await contract.read.quoteExactInputSingle([params]);

  return {
    amountOut: result[0],
    gasEstimate: result[1],
  };
}

/**
 * Get quote for exact output single-hop swap
 */
export async function quoteExactOutputSingle(
  chainId: number,
  params: QuoteExactInputSingleParams
): Promise<{ amountIn: bigint; gasEstimate: bigint }> {
  const contract = getQuoterContract(chainId);

  const result = await contract.read.quoteExactOutputSingle([params]);

  return {
    amountIn: result[0],
    gasEstimate: result[1],
  };
}

/**
 * Helper: Create pool key from pool data
 */
export function createPoolKey(
  token0: Address,
  token1: Address,
  fee: number,
  tickSpacing: number,
  hooks?: Address
): PoolKey {
  return {
    currency0: token0,
    currency1: token1,
    fee,
    tickSpacing,
    hooks: hooks ?? '0x0000000000000000000000000000000000000000',
  };
}

// Uniswap V4 sqrt price bounds (uint160)
export const MIN_SQRT_PRICE = 4295128739n;
export const MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342n;

/**
 * Helper: Calculate sqrt price limit based on slippage tolerance.
 *
 * The sqrtPriceLimitX96 tells the pool the worst acceptable price after the swap.
 * - For zeroForOne (token0 -> token1): price decreases, so limit = currentPrice * sqrt(1 - slippage)
 * - For oneForZero (token1 -> token0): price increases, so limit = currentPrice * sqrt(1 + slippage)
 *
 * We use integer arithmetic with 1e18 precision to avoid floating-point errors on BigInts.
 *
 * @param zeroForOne  - Swap direction (true = token0 -> token1, price decreases)
 * @param currentSqrtPriceX96 - Current pool sqrtPriceX96 from slot0
 * @param slippageBps - Slippage tolerance in basis points (50 = 0.5%, 100 = 1%)
 * @returns sqrtPriceLimitX96 clamped within [MIN_SQRT_PRICE + 1, MAX_SQRT_PRICE - 1]
 */
export function calculateSqrtPriceLimit(
  zeroForOne: boolean,
  currentSqrtPriceX96: bigint,
  slippageBps: number = 50 // 0.5% default
): bigint {
  if (slippageBps < 0 || slippageBps > 5000) {
    throw new Error(`Slippage out of range: ${slippageBps} bps (must be 0-5000)`);
  }

  // Calculate sqrt(1 - slippage) or sqrt(1 + slippage) with 1e18 precision.
  // slippageBps is in basis points (1 bps = 0.01%), so slippage fraction = slippageBps / 10000.
  // We compute: scaledFactor = sqrt((10000 +/- slippageBps) / 10000) * 1e18
  // Using Number for the sqrt since slippageBps is a small integer and precision is sufficient.
  const BPS_BASE = 10000;
  const PRECISION = 1000000000000000000n; // 1e18

  let ratio: number;
  if (zeroForOne) {
    // Price decreases: sqrt(1 - slippage)
    ratio = Math.sqrt((BPS_BASE - slippageBps) / BPS_BASE);
  } else {
    // Price increases: sqrt(1 + slippage)
    ratio = Math.sqrt((BPS_BASE + slippageBps) / BPS_BASE);
  }

  // Convert the ratio to a BigInt scaled by 1e18
  // Use Math.round to avoid truncation issues
  const scaledFactor = BigInt(Math.round(ratio * Number(PRECISION)));

  // Apply factor: limit = currentSqrtPriceX96 * scaledFactor / PRECISION
  let limit = (currentSqrtPriceX96 * scaledFactor) / PRECISION;

  // Clamp to valid bounds
  const MIN_BOUND = MIN_SQRT_PRICE + 1n;
  const MAX_BOUND = MAX_SQRT_PRICE - 1n;

  if (limit < MIN_BOUND) {
    limit = MIN_BOUND;
  } else if (limit > MAX_BOUND) {
    limit = MAX_BOUND;
  }

  return limit;
}
