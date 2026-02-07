/**
 * Price Impact Calculation Service
 *
 * Computes real price impact from pool state and swap execution results.
 *
 * Price impact = |1 - (executionPrice / midPrice)| * 100
 *
 * Where:
 *   - midPrice is derived from the pool's sqrtPriceX96 before the swap
 *   - executionPrice = amountOut / amountIn (adjusted for decimals)
 */

/** Warning thresholds for price impact (percentage) */
export const PRICE_IMPACT_THRESHOLDS = {
  /** Low impact - no warning needed */
  LOW: 0.1,
  /** Medium impact - informational */
  MEDIUM: 1.0,
  /** High impact - user should be warned */
  HIGH: 5.0,
} as const;

export type PriceImpactWarning = 'none' | 'low' | 'medium' | 'high';

export interface PriceImpactResult {
  /** Price impact as a percentage (e.g. 0.35 means 0.35%) */
  priceImpact: number;
  /** Warning level based on impact magnitude */
  warning: PriceImpactWarning;
  /** Mid-market price from pool state (token1 per token0) */
  midPrice: number;
  /** Execution price from swap amounts (tokenOut per tokenIn) */
  executionPrice: number;
}

/**
 * Derive the mid-market price from sqrtPriceX96.
 *
 * In Uniswap v4 (and v3), sqrtPriceX96 encodes:
 *   sqrt(price) * 2^96
 *
 * Where price = token1 / token0 in raw (non-decimal-adjusted) terms.
 *
 * To get the decimal-adjusted price of token0 in terms of token1:
 *   price = (sqrtPriceX96 / 2^96)^2 * 10^(decimals0 - decimals1)
 *
 * @param sqrtPriceX96 - The pool's sqrtPriceX96 value
 * @param decimals0 - Decimals of token0
 * @param decimals1 - Decimals of token1
 * @returns Decimal-adjusted mid-market price (token1 per token0)
 */
export function getMidPriceFromSqrtPriceX96(
  sqrtPriceX96: bigint,
  decimals0: number,
  decimals1: number
): number {
  // Use floating point for the calculation to avoid overflow
  // sqrtPrice = sqrtPriceX96 / 2^96
  const sqrtPrice = Number(sqrtPriceX96) / 2 ** 96;

  // price (raw) = sqrtPrice^2 = token1 / token0 (in raw units)
  const rawPrice = sqrtPrice * sqrtPrice;

  // Adjust for decimal differences
  const decimalAdjustment = 10 ** (decimals0 - decimals1);
  return rawPrice * decimalAdjustment;
}

/**
 * Calculate price impact from a swap.
 *
 * Price impact measures how much the execution price deviates from the
 * mid-market price. A larger swap relative to pool liquidity causes
 * a higher price impact.
 *
 * @param params - Calculation parameters
 * @param params.sqrtPriceX96Before - Pool sqrtPriceX96 before swap
 * @param params.amountIn - Amount of tokenIn (raw BigInt)
 * @param params.amountOut - Amount of tokenOut (raw BigInt)
 * @param params.tokenInDecimals - Decimals of tokenIn
 * @param params.tokenOutDecimals - Decimals of tokenOut
 * @param params.zeroForOne - Whether swapping token0 for token1
 * @returns PriceImpactResult with impact percentage and warning level
 */
export function calculatePriceImpact(params: {
  sqrtPriceX96Before: bigint;
  amountIn: bigint;
  amountOut: bigint;
  tokenInDecimals: number;
  tokenOutDecimals: number;
  zeroForOne: boolean;
}): PriceImpactResult {
  const {
    sqrtPriceX96Before,
    amountIn,
    amountOut,
    tokenInDecimals,
    tokenOutDecimals,
    zeroForOne,
  } = params;

  // Prevent division by zero
  if (amountIn === 0n || amountOut === 0n || sqrtPriceX96Before === 0n) {
    return {
      priceImpact: 0,
      warning: 'none',
      midPrice: 0,
      executionPrice: 0,
    };
  }

  // Calculate the decimal-adjusted execution price (tokenOut per tokenIn)
  const amountInDecimal = Number(amountIn) / 10 ** tokenInDecimals;
  const amountOutDecimal = Number(amountOut) / 10 ** tokenOutDecimals;
  const executionPrice = amountOutDecimal / amountInDecimal;

  // Get mid-market price from sqrtPriceX96
  // sqrtPriceX96 encodes price as token1/token0
  // If zeroForOne (selling token0 for token1): midPrice = token1/token0 (same direction)
  // If oneForZero (selling token1 for token0): midPrice = token0/token1 (inverse)
  let midPrice: number;
  if (zeroForOne) {
    // tokenIn = token0, tokenOut = token1
    // midPrice in terms of tokenOut per tokenIn = token1 per token0
    midPrice = getMidPriceFromSqrtPriceX96(
      sqrtPriceX96Before,
      tokenInDecimals,
      tokenOutDecimals
    );
  } else {
    // tokenIn = token1, tokenOut = token0
    // midPrice in terms of tokenOut per tokenIn = token0 per token1
    const token1PerToken0 = getMidPriceFromSqrtPriceX96(
      sqrtPriceX96Before,
      tokenOutDecimals,
      tokenInDecimals
    );
    midPrice = token1PerToken0 > 0 ? 1 / token1PerToken0 : 0;
  }

  // Price impact = |1 - executionPrice / midPrice| * 100
  let priceImpact: number;
  if (midPrice > 0) {
    priceImpact = Math.abs(1 - executionPrice / midPrice) * 100;
  } else {
    priceImpact = 0;
  }

  // Round to 4 decimal places for cleaner output
  priceImpact = Math.round(priceImpact * 10000) / 10000;

  return {
    priceImpact,
    warning: getPriceImpactWarning(priceImpact),
    midPrice,
    executionPrice,
  };
}

/**
 * Determine warning level from price impact percentage.
 *
 * @param priceImpact - Price impact as percentage (e.g. 0.35 means 0.35%)
 * @returns Warning level string
 */
export function getPriceImpactWarning(priceImpact: number): PriceImpactWarning {
  if (priceImpact >= PRICE_IMPACT_THRESHOLDS.HIGH) {
    return 'high';
  }
  if (priceImpact >= PRICE_IMPACT_THRESHOLDS.MEDIUM) {
    return 'medium';
  }
  if (priceImpact >= PRICE_IMPACT_THRESHOLDS.LOW) {
    return 'low';
  }
  return 'none';
}
