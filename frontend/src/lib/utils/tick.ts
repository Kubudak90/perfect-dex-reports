/**
 * Tick and price conversion utilities for Uniswap v3 style AMM
 * Based on: tick = log(price) / log(1.0001)
 */

const MIN_TICK = -887272;
const MAX_TICK = 887272;

/**
 * Convert price to tick
 * price = token1/token0 (how many token1 per token0)
 */
export function priceToTick(price: number): number {
  if (price <= 0) {
    throw new Error('Price must be positive');
  }

  const tick = Math.log(price) / Math.log(1.0001);
  return Math.round(tick);
}

/**
 * Convert tick to price
 * price = 1.0001^tick
 */
export function tickToPrice(tick: number): number {
  return Math.pow(1.0001, tick);
}

/**
 * Round tick to nearest valid tick for given spacing
 */
export function nearestUsableTick(tick: number, tickSpacing: number): number {
  const rounded = Math.round(tick / tickSpacing) * tickSpacing;

  // Ensure within bounds
  if (rounded < MIN_TICK) {
    return MIN_TICK;
  }
  if (rounded > MAX_TICK) {
    return MAX_TICK;
  }

  return rounded;
}

/**
 * Get price range from ticks
 */
export function getPriceRangeFromTicks(
  tickLower: number,
  tickUpper: number
): { priceLower: number; priceUpper: number } {
  return {
    priceLower: tickToPrice(tickLower),
    priceUpper: tickToPrice(tickUpper),
  };
}

/**
 * Get ticks from price range
 */
export function getTicksFromPriceRange(
  priceLower: number,
  priceUpper: number,
  tickSpacing: number
): { tickLower: number; tickUpper: number } {
  const tickLower = nearestUsableTick(priceToTick(priceLower), tickSpacing);
  const tickUpper = nearestUsableTick(priceToTick(priceUpper), tickSpacing);

  return { tickLower, tickUpper };
}

/**
 * Check if current price is in range
 */
export function isInRange(tick: number, tickLower: number, tickUpper: number): boolean {
  return tick >= tickLower && tick <= tickUpper;
}

/**
 * Get price range width as percentage
 */
export function getRangeWidth(priceLower: number, priceUpper: number): number {
  return ((priceUpper - priceLower) / priceLower) * 100;
}

/**
 * Calculate liquidity for amount0 using Uniswap v3 formula:
 *   L = amount0 * sqrtPriceA * sqrtPriceB / (sqrtPriceB - sqrtPriceA)
 *
 * Since sqrtPrice values are Q96 fixed-point (scaled by 2^96), the product
 * sqrtPriceA * sqrtPriceB is scaled by 2^192. We divide by Q96 (2^96) once
 * to keep the intermediate numerator at the correct Q96 scale before the
 * final division by the price difference.
 */
function getLiquidityForAmount0(
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  amount0: bigint
): bigint {
  if (sqrtPriceAX96 > sqrtPriceBX96) {
    [sqrtPriceAX96, sqrtPriceBX96] = [sqrtPriceBX96, sqrtPriceAX96];
  }
  const Q96 = 1n << 96n;
  const intermediate = (sqrtPriceAX96 * sqrtPriceBX96) / Q96;
  return (amount0 * intermediate) / (sqrtPriceBX96 - sqrtPriceAX96);
}

/**
 * Calculate liquidity for amount1 using Uniswap v3 formula:
 *   L = amount1 / (sqrtPriceB - sqrtPriceA)
 *
 * Since sqrtPrice values are Q96 fixed-point, the difference is also Q96-scaled.
 * We multiply amount1 by Q96 before dividing so the result is in the correct
 * (unscaled) liquidity units matching getLiquidityForAmount0.
 */
function getLiquidityForAmount1(
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  amount1: bigint
): bigint {
  if (sqrtPriceAX96 > sqrtPriceBX96) {
    [sqrtPriceAX96, sqrtPriceBX96] = [sqrtPriceBX96, sqrtPriceAX96];
  }
  const Q96 = 1n << 96n;
  return (amount1 * Q96) / (sqrtPriceBX96 - sqrtPriceAX96);
}

/**
 * Calculate liquidity from token amounts and price range using Uniswap v3
 * concentrated liquidity math (LiquidityAmounts library).
 *
 * Depending on where the current price sits relative to the range:
 *  - Below range: only token0 is active  -> use getLiquidityForAmount0
 *  - Above range: only token1 is active  -> use getLiquidityForAmount1
 *  - In range:    both tokens are active  -> use min of the two
 *
 * @param sqrtPriceX96   Current pool sqrt price in Q96 format
 * @param sqrtPriceAX96  Lower bound sqrt price in Q96 format
 * @param sqrtPriceBX96  Upper bound sqrt price in Q96 format
 * @param amount0        Amount of token0
 * @param amount1        Amount of token1
 * @returns The maximum liquidity that can be minted with the given amounts
 */
export function getLiquidityForAmounts(
  sqrtPriceX96: bigint,
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  amount0: bigint,
  amount1: bigint
): bigint {
  // Ensure sqrtPriceA <= sqrtPriceB
  if (sqrtPriceAX96 > sqrtPriceBX96) {
    [sqrtPriceAX96, sqrtPriceBX96] = [sqrtPriceBX96, sqrtPriceAX96];
  }

  if (sqrtPriceX96 <= sqrtPriceAX96) {
    // Current price is below the range — position is entirely in token0
    return getLiquidityForAmount0(sqrtPriceAX96, sqrtPriceBX96, amount0);
  } else if (sqrtPriceX96 >= sqrtPriceBX96) {
    // Current price is above the range — position is entirely in token1
    return getLiquidityForAmount1(sqrtPriceAX96, sqrtPriceBX96, amount1);
  } else {
    // Current price is within the range — both tokens contribute
    const liquidity0 = getLiquidityForAmount0(sqrtPriceX96, sqrtPriceBX96, amount0);
    const liquidity1 = getLiquidityForAmount1(sqrtPriceAX96, sqrtPriceX96, amount1);
    return liquidity0 < liquidity1 ? liquidity0 : liquidity1;
  }
}

/**
 * Get suggested price ranges based on current price
 */
export function getSuggestedRanges(
  currentPrice: number,
  tickSpacing: number
): Array<{
  label: string;
  priceLower: number;
  priceUpper: number;
  tickLower: number;
  tickUpper: number;
  width: number;
}> {
  const ranges = [
    { label: 'Narrow', multiplier: 0.9, width: 0.2 }, // ±10%
    { label: 'Normal', multiplier: 0.8, width: 0.4 }, // ±20%
    { label: 'Wide', multiplier: 0.5, width: 1.0 }, // ±50%
    { label: 'Full Range', multiplier: 0, width: Infinity },
  ];

  return ranges.map((range) => {
    if (range.label === 'Full Range') {
      return {
        label: range.label,
        priceLower: tickToPrice(MIN_TICK),
        priceUpper: tickToPrice(MAX_TICK),
        tickLower: MIN_TICK,
        tickUpper: MAX_TICK,
        width: Infinity,
      };
    }

    const priceLower = currentPrice * range.multiplier;
    const priceUpper = currentPrice * (2 - range.multiplier);
    const { tickLower, tickUpper } = getTicksFromPriceRange(
      priceLower,
      priceUpper,
      tickSpacing
    );

    return {
      label: range.label,
      priceLower: tickToPrice(tickLower),
      priceUpper: tickToPrice(tickUpper),
      tickLower,
      tickUpper,
      width: range.width * 100,
    };
  });
}

/**
 * Format price for display
 */
export function formatPrice(price: number, decimals: number = 6): string {
  if (price === 0) return '0';
  if (price === Infinity) return '∞';

  // For very small numbers, use scientific notation
  if (price < 0.000001) {
    return price.toExponential(2);
  }

  // For large numbers, use compact format
  if (price > 1000000) {
    return price.toExponential(2);
  }

  return price.toFixed(decimals);
}
