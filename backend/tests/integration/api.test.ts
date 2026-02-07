import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';

/**
 * API Integration Tests
 * Tests the backend API endpoints
 */
describe('API Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Build the Fastify app
    app = await buildApp({
      logger: false,
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('should return 200 on /health', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        status: 'ok',
        timestamp: expect.any(Number),
      });
    });
  });

  describe('Token API', () => {
    it('should get token list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/tokens',
        query: { chainId: '8453' },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(Array.isArray(data.tokens)).toBe(true);
      expect(data.tokens.length).toBeGreaterThan(0);
    });

    it('should get token by address', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/tokens/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
        query: { chainId: '8453' },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.symbol).toBe('USDC');
      expect(data.decimals).toBe(6);
    });

    it('should return 404 for non-existent token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/tokens/0x0000000000000000000000000000000000000000',
        query: { chainId: '8453' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should search tokens', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/tokens/search',
        query: {
          chainId: '8453',
          query: 'USD',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(Array.isArray(data.tokens)).toBe(true);
    });

    it('should get token price', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/tokens/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/price',
        query: { chainId: '8453' },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.usd).toBeDefined();
      expect(typeof data.usd).toBe('number');
    });
  });

  describe('Pool API', () => {
    it('should get pool list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/pools',
        query: { chainId: '8453' },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(Array.isArray(data.pools)).toBe(true);
    });

    it('should get pool by ID', async () => {
      // First get list to get a valid pool ID
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/pools',
        query: { chainId: '8453', limit: '1' },
      });

      const pools = listResponse.json().pools;

      if (pools.length > 0) {
        const poolId = pools[0].id;

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/pools/${poolId}`,
          query: { chainId: '8453' },
        });

        expect(response.statusCode).toBe(200);
        const data = response.json();
        expect(data.id).toBe(poolId);
        expect(data.token0).toBeDefined();
        expect(data.token1).toBeDefined();
      }
    });

    it('should get pool stats', async () => {
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/pools',
        query: { chainId: '8453', limit: '1' },
      });

      const pools = listResponse.json().pools;

      if (pools.length > 0) {
        const poolId = pools[0].id;

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/pools/${poolId}/stats`,
          query: { chainId: '8453' },
        });

        expect(response.statusCode).toBe(200);
        const data = response.json();
        expect(data.tvl).toBeDefined();
        expect(data.volume24h).toBeDefined();
      }
    });

    it('should get pool chart data', async () => {
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/pools',
        query: { chainId: '8453', limit: '1' },
      });

      const pools = listResponse.json().pools;

      if (pools.length > 0) {
        const poolId = pools[0].id;

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/pools/${poolId}/chart`,
          query: {
            chainId: '8453',
            interval: 'hour',
            from: Math.floor(Date.now() / 1000) - 86400, // 24h ago
            to: Math.floor(Date.now() / 1000),
          },
        });

        expect(response.statusCode).toBe(200);
        const data = response.json();
        expect(Array.isArray(data.data)).toBe(true);
      }
    });

    it('should sort pools by TVL', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/pools',
        query: {
          chainId: '8453',
          sortBy: 'tvl',
          sortOrder: 'desc',
          limit: '10',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      const pools = data.pools;

      // Verify descending order
      for (let i = 0; i < pools.length - 1; i++) {
        expect(pools[i].tvl).toBeGreaterThanOrEqual(pools[i + 1].tvl);
      }
    });
  });

  describe('Swap API', () => {
    it('should get swap quote', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/swap/quote',
        query: {
          chainId: '8453',
          tokenIn: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
          tokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
          amountIn: '1000000000000000000', // 1 ETH
          slippage: '0.5',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.amountOut).toBeDefined();
      expect(data.route).toBeDefined();
      expect(data.priceImpact).toBeDefined();
      expect(data.gasEstimate).toBeDefined();
    });

    it('should return error for invalid token address', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/swap/quote',
        query: {
          chainId: '8453',
          tokenIn: 'invalid',
          tokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          amountIn: '1000000000000000000',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return error for insufficient liquidity', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/swap/quote',
        query: {
          chainId: '8453',
          tokenIn: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          tokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          amountIn: '999999999999999999999999', // Very large amount
        },
      });

      expect(response.statusCode).toBe(400);
      const data = response.json();
      expect(data.error).toContain('liquidity');
    });

    it('should build swap transaction', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/swap/build',
        payload: {
          chainId: 8453,
          tokenIn: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          tokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          amountIn: '1000000000000000000',
          slippage: 0.5,
          recipient: '0x1234567890123456789012345678901234567890',
          deadline: Math.floor(Date.now() / 1000) + 1200,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.to).toBeDefined();
      expect(data.data).toBeDefined();
      expect(data.value).toBeDefined();
      expect(data.gasLimit).toBeDefined();
    });
  });

  describe('Position API', () => {
    it('should get user positions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/positions',
        query: {
          chainId: '8453',
          owner: '0x1234567890123456789012345678901234567890',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(Array.isArray(data.positions)).toBe(true);
    });

    it('should get position by token ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/positions/123',
        query: { chainId: '8453' },
      });

      // Position might not exist, so either 200 or 404 is valid
      expect([200, 404]).toContain(response.statusCode);
    });
  });

  describe('Analytics API', () => {
    it('should get protocol overview', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/overview',
        query: { chainId: '8453' },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.tvl).toBeDefined();
      expect(data.volume24h).toBeDefined();
      expect(data.fees24h).toBeDefined();
    });

    it('should get volume chart data', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/volume',
        query: {
          chainId: '8453',
          interval: 'day',
          from: Math.floor(Date.now() / 1000) - 86400 * 7, // 7 days ago
          to: Math.floor(Date.now() / 1000),
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should get top pools', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/top-pools',
        query: {
          chainId: '8453',
          limit: '10',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(Array.isArray(data.pools)).toBe(true);
      expect(data.pools.length).toBeLessThanOrEqual(10);
    });

    it('should get trending tokens', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/trending-tokens',
        query: {
          chainId: '8453',
          limit: '10',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(Array.isArray(data.tokens)).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit excessive requests', async () => {
      const requests = Array.from({ length: 110 }, () =>
        app.inject({
          method: 'GET',
          url: '/api/v1/tokens',
          query: { chainId: '8453' },
        })
      );

      const responses = await Promise.all(requests);

      // At least one should be rate limited
      const rateLimited = responses.some(
        (response) => response.statusCode === 429
      );

      expect(rateLimited).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for missing required parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/swap/quote',
        query: {
          // Missing required parameters
          chainId: '8453',
        },
      });

      expect(response.statusCode).toBe(400);
      const data = response.json();
      expect(data.error).toBeDefined();
    });

    it('should return 400 for invalid parameter types', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/swap/quote',
        query: {
          chainId: 'invalid', // Should be number
          tokenIn: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          tokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          amountIn: '1000000000000000000',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 for non-existent routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/non-existent-route',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should handle CORS preflight requests', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/v1/tokens',
        headers: {
          origin: 'http://localhost:3000',
          'access-control-request-method': 'GET',
        },
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });
});
