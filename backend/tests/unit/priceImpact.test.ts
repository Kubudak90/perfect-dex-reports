import { describe, it, expect } from 'vitest';
import {
  calculatePriceImpact,
  getMidPriceFromSqrtPriceX96,
  getPriceImpactWarning,
  PRICE_IMPACT_THRESHOLDS,
} from '../../src/services/priceImpact.js';

/**
 * Unit tests for price impact calculation.
 *
 * These tests verify the correctness of the price impact computation
 * that replaces the hardcoded 0.05% value.
 */

describe('Price Impact Calculation', () => {
  describe('getMidPriceFromSqrtPriceX96', () => {
    it('should calculate correct mid price for 1:1 ratio with equal decimals', () => {
      // sqrtPriceX96 for price = 1.0: sqrt(1) * 2^96 = 2^96
      const sqrtPriceX96 = 2n ** 96n; // = 79228162514264337593543950336
      const price = getMidPriceFromSqrtPriceX96(sqrtPriceX96, 18, 18);
      expect(price).toBeCloseTo(1.0, 6);
    });

    it('should calculate correct mid price for ETH/USDC pair', () => {
      // For ETH (18 decimals) / USDC (6 decimals), price ~2500 USDC per ETH
      // rawPrice = (sqrtPriceX96 / 2^96)^2
      // decimalAdjustedPrice = rawPrice * 10^(18-6) = rawPrice * 10^12
      // We want price = 2500
      // So rawPrice = 2500 / 10^12 = 2.5e-9
      // sqrtRawPrice = sqrt(2.5e-9) = ~5e-5
      // sqrtPriceX96 = sqrtRawPrice * 2^96 = 5e-5 * 79228162514264337593543950336
      //             ≈ 3961408125713216879677

      // Use a known sqrtPriceX96 that corresponds to ~2500 USDC/ETH
      // sqrt(2500 / 10^12) * 2^96
      const targetPrice = 2500;
      const sqrtRawPrice = Math.sqrt(targetPrice / 1e12);
      const sqrtPriceX96 = BigInt(Math.round(sqrtRawPrice * 2 ** 96));

      const price = getMidPriceFromSqrtPriceX96(sqrtPriceX96, 18, 6);
      expect(price).toBeCloseTo(targetPrice, 0);
    });

    it('should calculate correct mid price for high price ratios', () => {
      // For a token pair with price = 50000 and equal decimals
      const targetPrice = 50000;
      const sqrtRawPrice = Math.sqrt(targetPrice);
      const sqrtPriceX96 = BigInt(Math.round(sqrtRawPrice * 2 ** 96));

      const price = getMidPriceFromSqrtPriceX96(sqrtPriceX96, 18, 18);
      expect(price).toBeCloseTo(targetPrice, -1); // Within 10 units
    });

    it('should calculate correct mid price for low price ratios', () => {
      // For a token pair with price = 0.0005 and equal decimals
      const targetPrice = 0.0005;
      const sqrtRawPrice = Math.sqrt(targetPrice);
      const sqrtPriceX96 = BigInt(Math.round(sqrtRawPrice * 2 ** 96));

      const price = getMidPriceFromSqrtPriceX96(sqrtPriceX96, 18, 18);
      expect(price).toBeCloseTo(targetPrice, 6);
    });

    it('should handle different decimal combinations', () => {
      // USDC (6) / DAI (18): price should be ~1
      // rawPrice in terms of DAI/USDC without decimals
      // decimalAdjustedPrice = rawPrice * 10^(6-18) = rawPrice * 10^(-12)
      const sqrtPriceX96 = 2n ** 96n * 1000000n; // sqrt(10^12) * 2^96
      const price = getMidPriceFromSqrtPriceX96(sqrtPriceX96, 6, 18);
      expect(price).toBeCloseTo(1.0, 0);
    });

    it('should return 0 for sqrtPriceX96 = 0', () => {
      const price = getMidPriceFromSqrtPriceX96(0n, 18, 18);
      expect(price).toBe(0);
    });
  });

  describe('calculatePriceImpact', () => {
    it('should return 0 impact when execution price equals mid price', () => {
      // Set up a pool where sqrtPriceX96 corresponds to a price of 1.0
      // (token0 18 decimals, token1 18 decimals)
      const sqrtPriceX96 = 2n ** 96n; // price = 1.0

      // Swap 1 token0 for 1 token1 (no impact)
      const result = calculatePriceImpact({
        sqrtPriceX96Before: sqrtPriceX96,
        amountIn: 10n ** 18n,
        amountOut: 10n ** 18n,
        tokenInDecimals: 18,
        tokenOutDecimals: 18,
        zeroForOne: true,
      });

      expect(result.priceImpact).toBeCloseTo(0, 2);
      expect(result.warning).toBe('none');
    });

    it('should calculate positive impact when execution price is worse than mid price', () => {
      // Pool price = 1.0 (token1 per token0)
      const sqrtPriceX96 = 2n ** 96n;

      // Swap 1 token0 for 0.99 token1 (1% worse than mid)
      const result = calculatePriceImpact({
        sqrtPriceX96Before: sqrtPriceX96,
        amountIn: 10n ** 18n, // 1 token0
        amountOut: 99n * 10n ** 16n, // 0.99 token1
        tokenInDecimals: 18,
        tokenOutDecimals: 18,
        zeroForOne: true,
      });

      expect(result.priceImpact).toBeCloseTo(1.0, 1); // ~1%
      expect(result.warning).toBe('medium');
    });

    it('should calculate small impact for small trades', () => {
      const sqrtPriceX96 = 2n ** 96n; // price = 1.0

      // Swap 1 token0 for 0.999 token1 (0.1% impact)
      const result = calculatePriceImpact({
        sqrtPriceX96Before: sqrtPriceX96,
        amountIn: 10n ** 18n,
        amountOut: 999n * 10n ** 15n, // 0.999
        tokenInDecimals: 18,
        tokenOutDecimals: 18,
        zeroForOne: true,
      });

      expect(result.priceImpact).toBeCloseTo(0.1, 1);
      expect(result.warning).toBe('low');
    });

    it('should calculate high impact for large trades', () => {
      const sqrtPriceX96 = 2n ** 96n; // price = 1.0

      // Swap 1 token0 for only 0.9 token1 (10% impact)
      const result = calculatePriceImpact({
        sqrtPriceX96Before: sqrtPriceX96,
        amountIn: 10n ** 18n,
        amountOut: 9n * 10n ** 17n, // 0.9
        tokenInDecimals: 18,
        tokenOutDecimals: 18,
        zeroForOne: true,
      });

      expect(result.priceImpact).toBeCloseTo(10.0, 1);
      expect(result.warning).toBe('high');
    });

    it('should handle oneForZero (reverse direction) swaps', () => {
      // Pool price = 2000 token1 per token0 (e.g. ETH/USDC)
      // For oneForZero, we sell token1 and get token0
      // midPrice in terms of tokenOut/tokenIn = token0/token1 = 1/2000 = 0.0005
      const targetPrice = 2000;
      const sqrtRawPrice = Math.sqrt(targetPrice);
      const sqrtPriceX96 = BigInt(Math.round(sqrtRawPrice * 2 ** 96));

      // Sell 2000 token1 and get 0.999 token0 (0.1% impact)
      const result = calculatePriceImpact({
        sqrtPriceX96Before: sqrtPriceX96,
        amountIn: 2000n * 10n ** 18n, // 2000 token1
        amountOut: 999n * 10n ** 15n, // 0.999 token0
        tokenInDecimals: 18,
        tokenOutDecimals: 18,
        zeroForOne: false,
      });

      expect(result.priceImpact).toBeCloseTo(0.1, 0);
      expect(result.midPrice).toBeCloseTo(0.0005, 6);
    });

    it('should handle ETH/USDC pair with different decimals', () => {
      // ETH (18 decimals) = token0, USDC (6 decimals) = token1
      // Price: 2500 USDC per ETH
      const targetPrice = 2500;
      const sqrtRawPrice = Math.sqrt(targetPrice / 1e12);
      const sqrtPriceX96 = BigInt(Math.round(sqrtRawPrice * 2 ** 96));

      // Swap 1 ETH for 2487.5 USDC (0.5% impact from 2500)
      const result = calculatePriceImpact({
        sqrtPriceX96Before: sqrtPriceX96,
        amountIn: 10n ** 18n, // 1 ETH
        amountOut: 2487500000n, // 2487.5 USDC (6 decimals)
        tokenInDecimals: 18,
        tokenOutDecimals: 6,
        zeroForOne: true,
      });

      expect(result.priceImpact).toBeCloseTo(0.5, 1);
      expect(result.executionPrice).toBeCloseTo(2487.5, 0);
      expect(result.midPrice).toBeCloseTo(2500, 0);
    });

    it('should return zero impact for zero amounts', () => {
      const sqrtPriceX96 = 2n ** 96n;

      const result = calculatePriceImpact({
        sqrtPriceX96Before: sqrtPriceX96,
        amountIn: 0n,
        amountOut: 0n,
        tokenInDecimals: 18,
        tokenOutDecimals: 18,
        zeroForOne: true,
      });

      expect(result.priceImpact).toBe(0);
      expect(result.warning).toBe('none');
    });

    it('should return zero impact for zero sqrtPriceX96', () => {
      const result = calculatePriceImpact({
        sqrtPriceX96Before: 0n,
        amountIn: 10n ** 18n,
        amountOut: 10n ** 18n,
        tokenInDecimals: 18,
        tokenOutDecimals: 18,
        zeroForOne: true,
      });

      expect(result.priceImpact).toBe(0);
      expect(result.warning).toBe('none');
    });

    it('should include midPrice and executionPrice in result', () => {
      const sqrtPriceX96 = 2n ** 96n; // price = 1.0

      const result = calculatePriceImpact({
        sqrtPriceX96Before: sqrtPriceX96,
        amountIn: 10n ** 18n,
        amountOut: 98n * 10n ** 16n, // 0.98
        tokenInDecimals: 18,
        tokenOutDecimals: 18,
        zeroForOne: true,
      });

      expect(result.midPrice).toBeCloseTo(1.0, 4);
      expect(result.executionPrice).toBeCloseTo(0.98, 4);
      expect(result.priceImpact).toBeCloseTo(2.0, 1);
    });
  });

  describe('getPriceImpactWarning', () => {
    it('should return "none" for impact below LOW threshold', () => {
      expect(getPriceImpactWarning(0)).toBe('none');
      expect(getPriceImpactWarning(0.05)).toBe('none');
      expect(getPriceImpactWarning(0.09)).toBe('none');
    });

    it('should return "low" for impact at or above LOW threshold', () => {
      expect(getPriceImpactWarning(PRICE_IMPACT_THRESHOLDS.LOW)).toBe('low');
      expect(getPriceImpactWarning(0.5)).toBe('low');
      expect(getPriceImpactWarning(0.99)).toBe('low');
    });

    it('should return "medium" for impact at or above MEDIUM threshold', () => {
      expect(getPriceImpactWarning(PRICE_IMPACT_THRESHOLDS.MEDIUM)).toBe('medium');
      expect(getPriceImpactWarning(1.0)).toBe('medium');
      expect(getPriceImpactWarning(2.5)).toBe('medium');
      expect(getPriceImpactWarning(4.99)).toBe('medium');
    });

    it('should return "high" for impact at or above HIGH threshold', () => {
      expect(getPriceImpactWarning(PRICE_IMPACT_THRESHOLDS.HIGH)).toBe('high');
      expect(getPriceImpactWarning(5.0)).toBe('high');
      expect(getPriceImpactWarning(10.0)).toBe('high');
      expect(getPriceImpactWarning(50.0)).toBe('high');
    });
  });

  describe('PRICE_IMPACT_THRESHOLDS', () => {
    it('should have correct threshold values', () => {
      expect(PRICE_IMPACT_THRESHOLDS.LOW).toBe(0.1);
      expect(PRICE_IMPACT_THRESHOLDS.MEDIUM).toBe(1.0);
      expect(PRICE_IMPACT_THRESHOLDS.HIGH).toBe(5.0);
    });

    it('should have thresholds in ascending order', () => {
      expect(PRICE_IMPACT_THRESHOLDS.LOW).toBeLessThan(PRICE_IMPACT_THRESHOLDS.MEDIUM);
      expect(PRICE_IMPACT_THRESHOLDS.MEDIUM).toBeLessThan(PRICE_IMPACT_THRESHOLDS.HIGH);
    });
  });
});
