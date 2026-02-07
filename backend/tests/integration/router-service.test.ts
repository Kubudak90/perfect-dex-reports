import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RouterService, RouterError } from '../../src/services/router.service.js';
import axios from 'axios';
import type { Address } from 'viem';

// Test configuration
const ROUTER_URL = process.env.ROUTER_API_URL || 'http://localhost:3001';
const TEST_TIMEOUT = 30000; // 30 seconds

// Base tokens (for testing)
const WETH_BASE: Address = '0x4200000000000000000000000000000000000006';
const USDC_BASE: Address = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const DAI_BASE: Address = '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb';

describe('RouterService Integration Tests', () => {
  let routerService: RouterService;
  let isRouterAvailable = false;

  beforeAll(async () => {
    routerService = new RouterService(ROUTER_URL);

    // Check if router is available
    try {
      const health = await routerService.health();
      isRouterAvailable = health.status === 'healthy';
      console.log(`✅ Router available at ${ROUTER_URL}`);
      console.log(`   Version: ${health.version}`);
      console.log(`   Chain ID: ${health.chain_id}`);
      console.log(`   Tokens: ${health.graph_stats.token_count}`);
      console.log(`   Pools: ${health.graph_stats.pool_count}`);
    } catch (error) {
      console.log(`⚠️  Router not available at ${ROUTER_URL}`);
      console.log(`   Tests will be skipped or use mocks`);
      isRouterAvailable = false;
    }
  }, TEST_TIMEOUT);

  describe('Health Check', () => {
    it('should get health status', async () => {
      if (!isRouterAvailable) {
        console.log('⏭️  Skipping - router not available');
        return;
      }

      const health = await routerService.health();

      expect(health).toBeDefined();
      expect(health.status).toBe('healthy');
      expect(health.version).toBeDefined();
      expect(health.chain_id).toBe(8453); // Base
      expect(health.graph_stats).toBeDefined();
      expect(health.graph_stats.token_count).toBeGreaterThanOrEqual(0);
      expect(health.graph_stats.pool_count).toBeGreaterThanOrEqual(0);
      expect(health.graph_stats.last_update).toBeGreaterThan(0);
    }, TEST_TIMEOUT);

    it('should check if router is available', async () => {
      const available = await routerService.isAvailable();
      expect(available).toBe(isRouterAvailable);
    }, TEST_TIMEOUT);

    it('should get router stats', async () => {
      if (!isRouterAvailable) {
        console.log('⏭️  Skipping - router not available');
        return;
      }

      const stats = await routerService.getStats();

      expect(stats).toBeDefined();
      expect(stats.token_count).toBeGreaterThanOrEqual(0);
      expect(stats.pool_count).toBeGreaterThanOrEqual(0);
      expect(stats.last_update).toBeGreaterThan(0);
    }, TEST_TIMEOUT);
  });

  describe('Get Quote', () => {
    it('should get quote for single-hop swap', async () => {
      if (!isRouterAvailable) {
        console.log('⏭️  Skipping - router not available');
        return;
      }

      const request = {
        token_in: WETH_BASE,
        token_out: USDC_BASE,
        amount_in: '1000000000000000000', // 1 ETH
        slippage: 0.5,
      };

      const response = await routerService.getQuote(request);

      expect(response).toBeDefined();
      expect(response.quote).toBeDefined();
      expect(response.timestamp).toBeGreaterThan(0);
      expect(response.cached).toBeDefined();

      // Check quote structure
      const { quote } = response;
      expect(quote.amount_in).toBe(request.amount_in);
      expect(BigInt(quote.amount_out)).toBeGreaterThan(0n);
      expect(BigInt(quote.amount_out_min)).toBeGreaterThan(0n);
      expect(BigInt(quote.amount_out_min)).toBeLessThanOrEqual(BigInt(quote.amount_out));

      expect(quote.price_impact).toBeGreaterThanOrEqual(0);
      expect(quote.gas_estimate).toBeGreaterThan(0);
      expect(quote.route_string).toBeDefined();
      expect(quote.route).toBeDefined();

      console.log('✅ Quote received:');
      console.log(`   Route: ${quote.route_string}`);
      console.log(`   Amount Out: ${quote.amount_out}`);
      console.log(`   Price Impact: ${quote.price_impact}%`);
      console.log(`   Gas: ${quote.gas_estimate}`);
    }, TEST_TIMEOUT);

    it('should get quote with custom slippage', async () => {
      if (!isRouterAvailable) {
        console.log('⏭️  Skipping - router not available');
        return;
      }

      const request = {
        token_in: WETH_BASE,
        token_out: USDC_BASE,
        amount_in: '1000000000000000000',
        slippage: 1.0, // 1%
      };

      const response = await routerService.getQuote(request);

      expect(response).toBeDefined();
      expect(response.quote).toBeDefined();

      // With higher slippage, amount_out_min should be proportionally lower
      const amountOut = BigInt(response.quote.amount_out);
      const amountOutMin = BigInt(response.quote.amount_out_min);
      const slippageRatio = Number(amountOutMin) / Number(amountOut);

      expect(slippageRatio).toBeGreaterThan(0.98); // At least 99% (1% slippage)
      expect(slippageRatio).toBeLessThanOrEqual(1.0);
    }, TEST_TIMEOUT);

    it('should get quote with max_hops parameter', async () => {
      if (!isRouterAvailable) {
        console.log('⏭️  Skipping - router not available');
        return;
      }

      const request = {
        token_in: WETH_BASE,
        token_out: DAI_BASE,
        amount_in: '1000000000000000000',
        slippage: 0.5,
        max_hops: 3,
      };

      const response = await routerService.getQuote(request);

      expect(response).toBeDefined();
      expect(response.quote).toBeDefined();
      expect(response.quote.route).toBeDefined();
    }, TEST_TIMEOUT);

    it('should handle invalid token address', async () => {
      if (!isRouterAvailable) {
        console.log('⏭️  Skipping - router not available');
        return;
      }

      const request = {
        token_in: '0x0000000000000000000000000000000000000999' as Address, // Non-existent
        token_out: USDC_BASE,
        amount_in: '1000000000000000000',
      };

      try {
        await routerService.getQuote(request);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(RouterError);
        const routerError = error as RouterError;
        expect(routerError.statusCode).toBe(404);
      }
    }, TEST_TIMEOUT);

    it('should handle invalid amount', async () => {
      if (!isRouterAvailable) {
        console.log('⏭️  Skipping - router not available');
        return;
      }

      const request = {
        token_in: WETH_BASE,
        token_out: USDC_BASE,
        amount_in: 'invalid',
      };

      try {
        await routerService.getQuote(request);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(RouterError);
        const routerError = error as RouterError;
        expect(routerError.statusCode).toBe(400);
      }
    }, TEST_TIMEOUT);

    it('should get cached response on second request', async () => {
      if (!isRouterAvailable) {
        console.log('⏭️  Skipping - router not available');
        return;
      }

      const request = {
        token_in: WETH_BASE,
        token_out: USDC_BASE,
        amount_in: '1000000000000000000',
      };

      // First request
      const response1 = await routerService.getQuote(request);
      expect(response1.cached).toBe(false);

      // Second request (should be cached)
      const response2 = await routerService.getQuote(request);
      expect(response2.cached).toBe(true);

      // Responses should be similar (allowing for cache timing)
      expect(response2.quote.amount_in).toBe(response1.quote.amount_in);
      expect(response2.quote.amount_out).toBe(response1.quote.amount_out);
    }, TEST_TIMEOUT);
  });

  describe('Retry Logic', () => {
    it('should retry on network errors', async () => {
      // Create service with invalid URL to simulate network error
      const failingService = new RouterService('http://localhost:9999');

      try {
        await failingService.getQuoteWithRetry(
          {
            token_in: WETH_BASE,
            token_out: USDC_BASE,
            amount_in: '1000000000000000000',
          },
          2 // Only 2 retries for faster test
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(RouterError);
      }
    }, TEST_TIMEOUT);

    it('should not retry on 4xx errors', async () => {
      if (!isRouterAvailable) {
        console.log('⏭️  Skipping - router not available');
        return;
      }

      const startTime = Date.now();

      try {
        await routerService.getQuoteWithRetry(
          {
            token_in: WETH_BASE,
            token_out: USDC_BASE,
            amount_in: 'invalid', // Will cause 400 error
          },
          3
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(RouterError);
        const routerError = error as RouterError;
        expect(routerError.statusCode).toBe(400);

        // Should fail fast without retries (< 1 second)
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(1000);
      }
    }, TEST_TIMEOUT);
  });

  describe('Error Handling', () => {
    it('should handle router service unavailable', async () => {
      const unavailableService = new RouterService('http://localhost:9999');

      try {
        await unavailableService.health();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(RouterError);
        const routerError = error as RouterError;
        expect(routerError.statusCode).toBe(503);
        expect(routerError.message).toContain('unavailable');
      }
    }, TEST_TIMEOUT);

    it('should create RouterError with correct properties', () => {
      const error = new RouterError('Test error', 404, {
        error: 'NotFound',
        message: 'Resource not found',
      });

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(404);
      expect(error.data).toBeDefined();
      expect(error.data?.error).toBe('NotFound');

      const json = error.toJSON();
      expect(json.name).toBe('RouterError');
      expect(json.statusCode).toBe(404);
    });
  });

  describe('Performance', () => {
    it('should complete quote request within 500ms', async () => {
      if (!isRouterAvailable) {
        console.log('⏭️  Skipping - router not available');
        return;
      }

      const startTime = Date.now();

      await routerService.getQuote({
        token_in: WETH_BASE,
        token_out: USDC_BASE,
        amount_in: '1000000000000000000',
      });

      const duration = Date.now() - startTime;
      console.log(`   Quote latency: ${duration}ms`);

      // Router should respond within 500ms (including network overhead)
      expect(duration).toBeLessThan(500);
    }, TEST_TIMEOUT);

    it('should handle concurrent requests', async () => {
      if (!isRouterAvailable) {
        console.log('⏭️  Skipping - router not available');
        return;
      }

      const requests = Array.from({ length: 5 }, (_, i) => ({
        token_in: WETH_BASE,
        token_out: USDC_BASE,
        amount_in: `${1000000000000000000 + i * 100000000000000000}`, // Varying amounts
      }));

      const startTime = Date.now();

      const results = await Promise.all(
        requests.map((req) => routerService.getQuote(req))
      );

      const duration = Date.now() - startTime;
      console.log(`   5 concurrent requests: ${duration}ms`);

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.quote).toBeDefined();
        expect(BigInt(result.quote.amount_out)).toBeGreaterThan(0n);
      });

      // All requests should complete in reasonable time
      expect(duration).toBeLessThan(2000); // 2 seconds for 5 requests
    }, TEST_TIMEOUT);
  });
});
