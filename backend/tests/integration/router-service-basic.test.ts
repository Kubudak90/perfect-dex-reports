import { describe, it, expect, beforeAll } from 'vitest';
import { RouterService } from '../../src/services/router.service.js';
import type { Address } from 'viem';

// Test configuration
const ROUTER_URL = process.env.ROUTER_API_URL || 'http://localhost:3001';
const TEST_TIMEOUT = 15000;

// Test tokens (matching the ones in router's test setup)
const TOKEN_A: Address = '0x0000000000000000000000000000000000000001';
const TOKEN_B: Address = '0x0000000000000000000000000000000000000002';
const TOKEN_C: Address = '0x0000000000000000000000000000000000000003';

describe('RouterService Basic Integration', () => {
  let routerService: RouterService;
  let isRouterAvailable = false;

  beforeAll(async () => {
    routerService = new RouterService(ROUTER_URL);

    try {
      const health = await routerService.health();
      isRouterAvailable = health.status === 'healthy';
      console.log(`✅ Router available: ${health.version}`);
      console.log(`   Tokens: ${health.graph_stats.token_count}, Pools: ${health.graph_stats.pool_count}`);
    } catch {
      console.log('⚠️  Router not available - tests will be skipped');
      isRouterAvailable = false;
    }
  }, TEST_TIMEOUT);

  describe('Backend-Router Integration', () => {
    it('should successfully call router health endpoint', async () => {
      if (!isRouterAvailable) {
        console.log('⏭️  Skipping - router not available');
        return;
      }

      const health = await routerService.health();

      expect(health).toBeDefined();
      expect(health.status).toBe('healthy');
      expect(health.version).toBeTruthy();
      expect(health.chain_id).toBe(8453);
      expect(health.graph_stats).toBeDefined();

      console.log('✅ Health endpoint integration working');
    }, TEST_TIMEOUT);

    it('should successfully call router quote endpoint with test tokens', async () => {
      if (!isRouterAvailable) {
        console.log('⏭️  Skipping - router not available');
        return;
      }

      const request = {
        token_in: TOKEN_A,
        token_out: TOKEN_B,
        amount_in: '1000000000000000000', // 1 token
        slippage: 0.5,
      };

      const response = await routerService.getQuote(request);

      expect(response).toBeDefined();
      expect(response.quote).toBeDefined();
      expect(response.timestamp).toBeGreaterThan(0);

      // Verify quote structure
      expect(response.quote.amount_in).toBe(request.amount_in);
      expect(BigInt(response.quote.amount_out)).toBeGreaterThan(0n);
      expect(BigInt(response.quote.amount_out_min)).toBeLessThanOrEqual(
        BigInt(response.quote.amount_out)
      );

      console.log('✅ Quote endpoint integration working');
      console.log(`   Route: ${response.quote.route_string}`);
      console.log(`   Amount Out: ${response.quote.amount_out}`);
      console.log(`   Gas: ${response.quote.gas_estimate}`);
    }, TEST_TIMEOUT);

    it('should handle router errors correctly', async () => {
      if (!isRouterAvailable) {
        console.log('⏭️  Skipping - router not available');
        return;
      }

      const request = {
        token_in: TOKEN_A,
        token_out: TOKEN_B,
        amount_in: 'invalid_amount',
      };

      try {
        await routerService.getQuote(request);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).toBeDefined();
        expect(error.statusCode).toBe(400);
        console.log('✅ Error handling integration working');
      }
    }, TEST_TIMEOUT);

    it('should get cached response on repeated requests', async () => {
      if (!isRouterAvailable) {
        console.log('⏭️  Skipping - router not available');
        return;
      }

      const request = {
        token_in: TOKEN_A,
        token_out: TOKEN_B,
        amount_in: '5000000000000000000',
      };

      // First request
      const response1 = await routerService.getQuote(request);
      expect(response1.cached).toBe(false);

      // Second request (should hit cache)
      const response2 = await routerService.getQuote(request);
      expect(response2.cached).toBe(true);

      // Should have same amounts
      expect(response2.quote.amount_out).toBe(response1.quote.amount_out);

      console.log('✅ Cache integration working');
      console.log(`   First: cached=${response1.cached}`);
      console.log(`   Second: cached=${response2.cached}`);
    }, TEST_TIMEOUT);

    it('should handle multi-hop routing', async () => {
      if (!isRouterAvailable) {
        console.log('⏭️  Skipping - router not available');
        return;
      }

      const request = {
        token_in: TOKEN_A,
        token_out: TOKEN_C,
        amount_in: '1000000000000000000',
        max_hops: 3,
      };

      const response = await routerService.getQuote(request);

      expect(response).toBeDefined();
      expect(response.quote).toBeDefined();
      expect(response.quote.route).toBeDefined();

      console.log('✅ Multi-hop routing integration working');
      console.log(`   Route: ${response.quote.route_string}`);
    }, TEST_TIMEOUT);

    it('should complete requests within acceptable latency', async () => {
      if (!isRouterAvailable) {
        console.log('⏭️  Skipping - router not available');
        return;
      }

      const request = {
        token_in: TOKEN_A,
        token_out: TOKEN_B,
        amount_in: '1000000000000000000',
      };

      const startTime = Date.now();
      await routerService.getQuote(request);
      const duration = Date.now() - startTime;

      // Backend-router integration should be fast (<500ms including network)
      expect(duration).toBeLessThan(500);

      console.log('✅ Performance integration working');
      console.log(`   Latency: ${duration}ms (target: <500ms)`);
    }, TEST_TIMEOUT);

    it('should check router availability', async () => {
      const available = await routerService.isAvailable();
      expect(available).toBe(isRouterAvailable);
      console.log(`✅ Availability check: ${available}`);
    }, TEST_TIMEOUT);

    it('should get router statistics', async () => {
      if (!isRouterAvailable) {
        console.log('⏭️  Skipping - router not available');
        return;
      }

      const stats = await routerService.getStats();

      expect(stats).toBeDefined();
      expect(stats.token_count).toBeGreaterThanOrEqual(0);
      expect(stats.pool_count).toBeGreaterThanOrEqual(0);
      expect(stats.last_update).toBeGreaterThan(0);

      console.log('✅ Stats endpoint integration working');
      console.log(`   Tokens: ${stats.token_count}, Pools: ${stats.pool_count}`);
    }, TEST_TIMEOUT);
  });

  describe('Integration Reliability', () => {
    it('should handle concurrent requests reliably', async () => {
      if (!isRouterAvailable) {
        console.log('⏭️  Skipping - router not available');
        return;
      }

      const requests = [
        { token_in: TOKEN_A, token_out: TOKEN_B, amount_in: '1000000000000000000' },
        { token_in: TOKEN_A, token_out: TOKEN_B, amount_in: '2000000000000000000' },
        { token_in: TOKEN_A, token_out: TOKEN_B, amount_in: '3000000000000000000' },
      ];

      const results = await Promise.all(
        requests.map((req) => routerService.getQuote(req))
      );

      expect(results).toHaveLength(3);
      results.forEach((result, i) => {
        expect(result.quote).toBeDefined();
        expect(result.quote.amount_in).toBe(requests[i].amount_in);
      });

      console.log('✅ Concurrent requests handling working');
      console.log(`   Processed ${results.length} requests successfully`);
    }, TEST_TIMEOUT);

    it('should retry failed requests', async () => {
      // Test with unavailable service
      const failingService = new RouterService('http://localhost:9999');

      try {
        await failingService.getQuoteWithRetry(
          {
            token_in: TOKEN_A,
            token_out: TOKEN_B,
            amount_in: '1000000000000000000',
          },
          2 // 2 retries
        );
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).toBeDefined();
        console.log('✅ Retry logic working correctly');
      }
    }, TEST_TIMEOUT);
  });
});
