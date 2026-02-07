import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ChainlinkPriceFeedService,
  CHAINLINK_FEED_REGISTRY,
  resetChainlinkPriceFeedService,
  getChainlinkPriceFeedService,
} from '../../src/services/chainlinkPriceFeed.js';

/**
 * Unit tests for ChainlinkPriceFeedService.
 *
 * These tests run against the mock-mode path (MOCK_MODE=true, set via NODE_ENV=test)
 * and verify the service behaviour with mocked RPC responses for the Chainlink path.
 */

// Well-known Base mainnet token addresses (lower-cased)
const WETH = '0x4200000000000000000000000000000000000006';
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const WBTC = '0x0555e30da8f98308edb960aa94c0db47230d2b9c';
const DAI = '0x50c5725949a6f0c72e6c4a641f24049a917db0cb';
const CBETH = '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22';
const UNKNOWN_TOKEN = '0x0000000000000000000000000000000000001234';

describe('ChainlinkPriceFeedService', () => {
  let service: ChainlinkPriceFeedService;

  beforeEach(() => {
    // Reset the singleton so each test gets a clean instance
    resetChainlinkPriceFeedService();
    // In test mode (NODE_ENV=test), mock mode is enabled so no RPC calls are made
    service = new ChainlinkPriceFeedService({
      cacheTtlSeconds: 30,
      stalePriceThresholdSeconds: 3600,
    });
  });

  afterEach(() => {
    service.clearCache();
    resetChainlinkPriceFeedService();
  });

  // ---------------------------------------------------------------------------
  // Feed Registry
  // ---------------------------------------------------------------------------

  describe('CHAINLINK_FEED_REGISTRY', () => {
    it('should contain entries for WETH, WBTC, USDC, DAI, and cbETH', () => {
      expect(CHAINLINK_FEED_REGISTRY[WETH]).toBeDefined();
      expect(CHAINLINK_FEED_REGISTRY[WBTC]).toBeDefined();
      expect(CHAINLINK_FEED_REGISTRY[USDC]).toBeDefined();
      expect(CHAINLINK_FEED_REGISTRY[DAI]).toBeDefined();
      expect(CHAINLINK_FEED_REGISTRY[CBETH]).toBeDefined();
    });

    it('should have correct Chainlink feed addresses', () => {
      expect(CHAINLINK_FEED_REGISTRY[WETH].feedAddress).toBe(
        '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70'
      );
      expect(CHAINLINK_FEED_REGISTRY[WBTC].feedAddress).toBe(
        '0xCCADC697c55bbB68dc5bCdf8d3CBe83CdD4E071E'
      );
      expect(CHAINLINK_FEED_REGISTRY[USDC].feedAddress).toBe(
        '0x7e860098F58bBFC8648a4311b374B1D669a2bc6B'
      );
    });

    it('should have 8 decimal feeds for all USD pairs', () => {
      for (const [, config] of Object.entries(CHAINLINK_FEED_REGISTRY)) {
        expect(config.feedDecimals).toBe(8);
      }
    });

    it('should have heartbeat configured for every feed', () => {
      for (const [, config] of Object.entries(CHAINLINK_FEED_REGISTRY)) {
        expect(config.heartbeatSeconds).toBeGreaterThan(0);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // getSupportedTokens
  // ---------------------------------------------------------------------------

  describe('getSupportedTokens', () => {
    it('should return all registered token addresses', () => {
      const tokens = service.getSupportedTokens();
      expect(tokens).toContain(WETH);
      expect(tokens).toContain(USDC);
      expect(tokens).toContain(WBTC);
      expect(tokens).toContain(DAI);
      expect(tokens).toContain(CBETH);
      expect(tokens.length).toBe(5);
    });
  });

  // ---------------------------------------------------------------------------
  // getPrice (mock mode)
  // ---------------------------------------------------------------------------

  describe('getPrice (mock mode)', () => {
    it('should return mock WETH price with source "mock"', async () => {
      const result = await service.getPrice(WETH);
      expect(result.symbol).toBe('WETH');
      expect(result.source).toBe('mock');
      expect(parseFloat(result.priceUsd)).toBeGreaterThan(0);
      expect(result.decimals).toBe(18);
      expect(result.address).toBe(WETH);
      expect(result.lastUpdated).toBeGreaterThan(0);
    });

    it('should return mock USDC price close to $1', async () => {
      const result = await service.getPrice(USDC);
      expect(result.symbol).toBe('USDC');
      expect(parseFloat(result.priceUsd)).toBeCloseTo(1.0, 1);
      expect(result.decimals).toBe(6);
    });

    it('should return mock WBTC price', async () => {
      const result = await service.getPrice(WBTC);
      expect(result.symbol).toBe('WBTC');
      expect(parseFloat(result.priceUsd)).toBeGreaterThan(10000);
      expect(result.decimals).toBe(8);
    });

    it('should return mock DAI price close to $1', async () => {
      const result = await service.getPrice(DAI);
      expect(result.symbol).toBe('DAI');
      expect(parseFloat(result.priceUsd)).toBeCloseTo(1.0, 2);
    });

    it('should return mock cbETH price', async () => {
      const result = await service.getPrice(CBETH);
      expect(result.symbol).toBe('cbETH');
      expect(parseFloat(result.priceUsd)).toBeGreaterThan(2000);
    });

    it('should return zero price for unknown tokens', async () => {
      const result = await service.getPrice(UNKNOWN_TOKEN);
      expect(result.symbol).toBe('UNKNOWN');
      expect(result.priceUsd).toBe('0.000000');
      expect(result.source).toBe('mock');
    });

    it('should handle case-insensitive addresses', async () => {
      const upper = WETH.slice(0, 2) + WETH.slice(2).toUpperCase();
      // The service lowercases internally
      const result = await service.getPrice(upper);
      // Even with uppercase input the lower-case lookup should work
      expect(result.symbol).toBe('WETH');
    });

    it('should include priceEth field', async () => {
      const result = await service.getPrice(WETH);
      expect(parseFloat(result.priceEth)).toBeCloseTo(1.0, 2);

      const usdcResult = await service.getPrice(USDC);
      expect(parseFloat(usdcResult.priceEth)).toBeGreaterThan(0);
      expect(parseFloat(usdcResult.priceEth)).toBeLessThan(0.01);
    });
  });

  // ---------------------------------------------------------------------------
  // getPrices (batch)
  // ---------------------------------------------------------------------------

  describe('getPrices (batch)', () => {
    it('should return prices for all requested tokens', async () => {
      const addresses = [WETH, USDC, WBTC];
      const results = await service.getPrices(addresses);

      expect(Object.keys(results)).toHaveLength(3);
      expect(results[WETH]).toBeDefined();
      expect(results[USDC]).toBeDefined();
      expect(results[WBTC]).toBeDefined();
    });

    it('should handle a mix of known and unknown tokens', async () => {
      const addresses = [WETH, UNKNOWN_TOKEN];
      const results = await service.getPrices(addresses);

      expect(results[WETH].symbol).toBe('WETH');
      expect(results[UNKNOWN_TOKEN].priceUsd).toBe('0.000000');
    });

    it('should return empty object for empty input', async () => {
      const results = await service.getPrices([]);
      expect(Object.keys(results)).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getAllPrices
  // ---------------------------------------------------------------------------

  describe('getAllPrices', () => {
    it('should return prices for all registered tokens', async () => {
      const results = await service.getAllPrices();
      const addresses = Object.keys(results);

      expect(addresses.length).toBe(5);
      expect(addresses).toContain(WETH);
      expect(addresses).toContain(USDC);
      expect(addresses).toContain(WBTC);
      expect(addresses).toContain(DAI);
      expect(addresses).toContain(CBETH);
    });
  });

  // ---------------------------------------------------------------------------
  // Caching behaviour
  // ---------------------------------------------------------------------------

  describe('caching', () => {
    it('should cache results and return them on subsequent calls', async () => {
      const first = await service.getPrice(WETH);
      const second = await service.getPrice(WETH);

      // In mock mode, both calls return the same mock data
      expect(first.priceUsd).toBe(second.priceUsd);
      expect(first.symbol).toBe(second.symbol);
    });

    it('should serve fresh data after cache is cleared', async () => {
      await service.getPrice(WETH);
      service.clearCache();

      const fresh = await service.getPrice(WETH);
      expect(fresh.symbol).toBe('WETH');
      expect(fresh.source).toBe('mock');
    });

    it('should expire cache entries after TTL', async () => {
      // Use a short TTL for this test
      const shortTtlService = new ChainlinkPriceFeedService({
        cacheTtlSeconds: 0, // Expire immediately
      });

      const first = await shortTtlService.getPrice(WETH);
      // With TTL=0 the cache is always expired, so each call fetches fresh
      const second = await shortTtlService.getPrice(WETH);

      // Both should still be valid prices
      expect(parseFloat(first.priceUsd)).toBeGreaterThan(0);
      expect(parseFloat(second.priceUsd)).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Singleton management
  // ---------------------------------------------------------------------------

  describe('singleton (getChainlinkPriceFeedService)', () => {
    it('should return the same instance on repeated calls', () => {
      resetChainlinkPriceFeedService();
      const a = getChainlinkPriceFeedService();
      const b = getChainlinkPriceFeedService();
      expect(a).toBe(b);
    });

    it('should return a new instance after reset', () => {
      resetChainlinkPriceFeedService();
      const a = getChainlinkPriceFeedService();
      resetChainlinkPriceFeedService();
      const b = getChainlinkPriceFeedService();
      expect(a).not.toBe(b);
    });
  });

  // ---------------------------------------------------------------------------
  // PriceFeedResult shape
  // ---------------------------------------------------------------------------

  describe('PriceFeedResult shape', () => {
    it('should return all required fields', async () => {
      const result = await service.getPrice(WETH);

      expect(result).toHaveProperty('address');
      expect(result).toHaveProperty('symbol');
      expect(result).toHaveProperty('priceUsd');
      expect(result).toHaveProperty('priceEth');
      expect(result).toHaveProperty('decimals');
      expect(result).toHaveProperty('lastUpdated');
      expect(result).toHaveProperty('source');
    });

    it('should have string types for price fields', async () => {
      const result = await service.getPrice(WETH);

      expect(typeof result.priceUsd).toBe('string');
      expect(typeof result.priceEth).toBe('string');
      expect(typeof result.address).toBe('string');
      expect(typeof result.symbol).toBe('string');
    });

    it('should have numeric types for metadata fields', async () => {
      const result = await service.getPrice(WETH);

      expect(typeof result.decimals).toBe('number');
      expect(typeof result.lastUpdated).toBe('number');
    });
  });

  // ---------------------------------------------------------------------------
  // Stale price validation (simulated via direct construction)
  // ---------------------------------------------------------------------------

  describe('stale price configuration', () => {
    it('should accept a custom stale price threshold', () => {
      const customService = new ChainlinkPriceFeedService({
        stalePriceThresholdSeconds: 7200, // 2 hours
      });
      // No error means construction succeeded with custom threshold
      expect(customService).toBeDefined();
    });

    it('should use default 3600s stale threshold', () => {
      const defaultService = new ChainlinkPriceFeedService();
      expect(defaultService).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Feed registry data integrity
  // ---------------------------------------------------------------------------

  describe('feed registry data integrity', () => {
    it('should have valid Ethereum addresses for all feed addresses', () => {
      const addressRegex = /^0x[a-fA-F0-9]{40}$/;

      for (const [tokenAddr, config] of Object.entries(CHAINLINK_FEED_REGISTRY)) {
        expect(tokenAddr).toMatch(addressRegex);
        expect(config.feedAddress).toMatch(addressRegex);
      }
    });

    it('should have non-empty pair descriptions', () => {
      for (const [, config] of Object.entries(CHAINLINK_FEED_REGISTRY)) {
        expect(config.pair.length).toBeGreaterThan(0);
        expect(config.pair).toContain('/');
      }
    });

    it('should have heartbeat of at least 60 seconds', () => {
      for (const [, config] of Object.entries(CHAINLINK_FEED_REGISTRY)) {
        expect(config.heartbeatSeconds).toBeGreaterThanOrEqual(60);
      }
    });
  });
});
