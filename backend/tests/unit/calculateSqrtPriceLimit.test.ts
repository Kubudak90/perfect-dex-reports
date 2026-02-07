import { describe, it, expect } from 'vitest';
import {
  calculateSqrtPriceLimit,
  MIN_SQRT_PRICE,
  MAX_SQRT_PRICE,
} from '../../src/blockchain/contracts/quoter.js';

/**
 * Unit tests for calculateSqrtPriceLimit
 *
 * The function calculates a proper sqrtPriceLimitX96 from:
 *   - swap direction (zeroForOne)
 *   - current pool sqrtPriceX96
 *   - user slippage tolerance (in basis points)
 *
 * For zeroForOne: limit = currentSqrtPrice * sqrt(1 - slippage)
 * For oneForZero: limit = currentSqrtPrice * sqrt(1 + slippage)
 */

// A realistic sqrtPriceX96 (~2450 USDC/ETH in a WETH/USDC pool)
// sqrtPriceX96 = sqrt(price) * 2^96 where price = token1/token0
const TYPICAL_SQRT_PRICE = 3961408125713216879677197516800n; // approx sqrt(2500) * 2^96

// A very small sqrtPriceX96 (close to minimum)
const SMALL_SQRT_PRICE = 100000000000n; // just above MIN_SQRT_PRICE

// A very large sqrtPriceX96 (close to maximum)
const LARGE_SQRT_PRICE = 1400000000000000000000000000000000000000000000000000n;

describe('calculateSqrtPriceLimit', () => {
  describe('basic behavior', () => {
    it('should return a value lower than current price for zeroForOne', () => {
      const limit = calculateSqrtPriceLimit(true, TYPICAL_SQRT_PRICE, 50);
      expect(limit).toBeLessThan(TYPICAL_SQRT_PRICE);
      expect(limit).toBeGreaterThan(MIN_SQRT_PRICE);
    });

    it('should return a value higher than current price for oneForZero', () => {
      const limit = calculateSqrtPriceLimit(false, TYPICAL_SQRT_PRICE, 50);
      expect(limit).toBeGreaterThan(TYPICAL_SQRT_PRICE);
      expect(limit).toBeLessThan(MAX_SQRT_PRICE);
    });

    it('should use default slippage of 50 bps when not provided', () => {
      const limitDefault = calculateSqrtPriceLimit(true, TYPICAL_SQRT_PRICE);
      const limitExplicit = calculateSqrtPriceLimit(true, TYPICAL_SQRT_PRICE, 50);
      expect(limitDefault).toBe(limitExplicit);
    });
  });

  describe('slippage math accuracy', () => {
    it('should produce correct limit for 0.5% slippage zeroForOne', () => {
      // For 0.5% slippage (50 bps), zeroForOne:
      // limit = currentPrice * sqrt(1 - 0.005) = currentPrice * sqrt(0.995)
      // sqrt(0.995) ~ 0.997497...
      const limit = calculateSqrtPriceLimit(true, TYPICAL_SQRT_PRICE, 50);

      const expectedRatio = Math.sqrt(0.995);
      const expectedLimit = BigInt(
        Math.round(Number(TYPICAL_SQRT_PRICE) * expectedRatio)
      );

      // Allow tiny rounding difference (within 0.0001% of expected)
      const diff = limit > expectedLimit ? limit - expectedLimit : expectedLimit - limit;
      const tolerance = TYPICAL_SQRT_PRICE / 10000000n; // 0.00001%
      expect(diff).toBeLessThanOrEqual(tolerance);
    });

    it('should produce correct limit for 0.5% slippage oneForZero', () => {
      const limit = calculateSqrtPriceLimit(false, TYPICAL_SQRT_PRICE, 50);

      const expectedRatio = Math.sqrt(1.005);
      const expectedLimit = BigInt(
        Math.round(Number(TYPICAL_SQRT_PRICE) * expectedRatio)
      );

      const diff = limit > expectedLimit ? limit - expectedLimit : expectedLimit - limit;
      const tolerance = TYPICAL_SQRT_PRICE / 10000000n;
      expect(diff).toBeLessThanOrEqual(tolerance);
    });

    it('should produce correct limit for 1% slippage', () => {
      const limit = calculateSqrtPriceLimit(true, TYPICAL_SQRT_PRICE, 100);

      const expectedRatio = Math.sqrt(0.99);
      const expectedLimit = BigInt(
        Math.round(Number(TYPICAL_SQRT_PRICE) * expectedRatio)
      );

      const diff = limit > expectedLimit ? limit - expectedLimit : expectedLimit - limit;
      const tolerance = TYPICAL_SQRT_PRICE / 10000000n;
      expect(diff).toBeLessThanOrEqual(tolerance);
    });

    it('should produce correct limit for 5% slippage', () => {
      const limit = calculateSqrtPriceLimit(true, TYPICAL_SQRT_PRICE, 500);

      const expectedRatio = Math.sqrt(0.95);
      const expectedLimit = BigInt(
        Math.round(Number(TYPICAL_SQRT_PRICE) * expectedRatio)
      );

      const diff = limit > expectedLimit ? limit - expectedLimit : expectedLimit - limit;
      const tolerance = TYPICAL_SQRT_PRICE / 1000000n;
      expect(diff).toBeLessThanOrEqual(tolerance);
    });
  });

  describe('higher slippage should produce wider limits', () => {
    it('should produce a lower limit with higher slippage for zeroForOne', () => {
      const limit05 = calculateSqrtPriceLimit(true, TYPICAL_SQRT_PRICE, 50);  // 0.5%
      const limit10 = calculateSqrtPriceLimit(true, TYPICAL_SQRT_PRICE, 100); // 1.0%
      const limit50 = calculateSqrtPriceLimit(true, TYPICAL_SQRT_PRICE, 500); // 5.0%

      // For zeroForOne, higher slippage => lower limit (more price movement allowed)
      expect(limit10).toBeLessThan(limit05);
      expect(limit50).toBeLessThan(limit10);
    });

    it('should produce a higher limit with higher slippage for oneForZero', () => {
      const limit05 = calculateSqrtPriceLimit(false, TYPICAL_SQRT_PRICE, 50);
      const limit10 = calculateSqrtPriceLimit(false, TYPICAL_SQRT_PRICE, 100);
      const limit50 = calculateSqrtPriceLimit(false, TYPICAL_SQRT_PRICE, 500);

      // For oneForZero, higher slippage => higher limit
      expect(limit10).toBeGreaterThan(limit05);
      expect(limit50).toBeGreaterThan(limit10);
    });
  });

  describe('boundary clamping', () => {
    it('should clamp to MIN_SQRT_PRICE + 1 for zeroForOne with extreme price', () => {
      // With a very small price and large slippage, the result might go below MIN
      const limit = calculateSqrtPriceLimit(true, SMALL_SQRT_PRICE, 5000);
      expect(limit).toBe(MIN_SQRT_PRICE + 1n);
    });

    it('should clamp to MAX_SQRT_PRICE - 1 for oneForZero with extreme price', () => {
      // With a very large price and large slippage, the result might exceed MAX
      const limit = calculateSqrtPriceLimit(false, LARGE_SQRT_PRICE, 5000);
      expect(limit).toBe(MAX_SQRT_PRICE - 1n);
    });

    it('should stay within bounds for all valid inputs', () => {
      const prices = [
        MIN_SQRT_PRICE + 100n,
        TYPICAL_SQRT_PRICE,
        MAX_SQRT_PRICE - 100n,
      ];
      const slippages = [1, 10, 50, 100, 500, 1000, 5000];

      for (const price of prices) {
        for (const slippage of slippages) {
          for (const zeroForOne of [true, false]) {
            const limit = calculateSqrtPriceLimit(zeroForOne, price, slippage);
            expect(limit).toBeGreaterThanOrEqual(MIN_SQRT_PRICE + 1n);
            expect(limit).toBeLessThanOrEqual(MAX_SQRT_PRICE - 1n);
          }
        }
      }
    });
  });

  describe('does NOT return extreme min/max (old behavior)', () => {
    it('should NOT return MIN_SQRT_PRICE for zeroForOne with typical price', () => {
      const limit = calculateSqrtPriceLimit(true, TYPICAL_SQRT_PRICE, 50);
      // The old buggy behavior returned MIN_SQRT_PRICE (4295128739n)
      expect(limit).not.toBe(4295128739n);
      expect(limit).not.toBe(4295128740n); // MIN + 1
    });

    it('should NOT return MAX_SQRT_PRICE for oneForZero with typical price', () => {
      const limit = calculateSqrtPriceLimit(false, TYPICAL_SQRT_PRICE, 50);
      // The old buggy behavior returned MAX_SQRT_PRICE - 1
      expect(limit).not.toBe(1461446703485210103287273052203988822378723970342n);
      expect(limit).not.toBe(1461446703485210103287273052203988822378723970341n); // MAX - 1
    });
  });

  describe('input validation', () => {
    it('should throw for negative slippage', () => {
      expect(() => {
        calculateSqrtPriceLimit(true, TYPICAL_SQRT_PRICE, -1);
      }).toThrow('Slippage out of range');
    });

    it('should throw for slippage over 50%', () => {
      expect(() => {
        calculateSqrtPriceLimit(true, TYPICAL_SQRT_PRICE, 5001);
      }).toThrow('Slippage out of range');
    });

    it('should accept 0 bps slippage (no slippage tolerance)', () => {
      const limit = calculateSqrtPriceLimit(true, TYPICAL_SQRT_PRICE, 0);
      // With 0 slippage, sqrt(1 - 0) = 1, so limit should equal current price
      expect(limit).toBe(TYPICAL_SQRT_PRICE);
    });

    it('should accept maximum 5000 bps (50%) slippage', () => {
      const limit = calculateSqrtPriceLimit(true, TYPICAL_SQRT_PRICE, 5000);
      // sqrt(1 - 0.5) = sqrt(0.5) ~ 0.7071
      expect(limit).toBeLessThan(TYPICAL_SQRT_PRICE);
      expect(limit).toBeGreaterThan(0n);
    });
  });

  describe('symmetry and consistency', () => {
    it('should produce symmetric results for buy and sell', () => {
      // For the same slippage, the price movement allowed should be roughly symmetric
      const limitDown = calculateSqrtPriceLimit(true, TYPICAL_SQRT_PRICE, 100);
      const limitUp = calculateSqrtPriceLimit(false, TYPICAL_SQRT_PRICE, 100);

      // The distance from current price should be approximately equal
      const distDown = TYPICAL_SQRT_PRICE - limitDown;
      const distUp = limitUp - TYPICAL_SQRT_PRICE;

      // They won't be exactly equal because sqrt(1-x) != 1/sqrt(1+x),
      // but they should be in the same ballpark (within 1% of each other)
      const ratio = Number(distDown) / Number(distUp);
      expect(ratio).toBeGreaterThan(0.98);
      expect(ratio).toBeLessThan(1.02);
    });
  });
});
