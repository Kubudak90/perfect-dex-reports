import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

describe('Security Headers', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should include Content-Security-Policy header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    const csp = response.headers['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("img-src 'self' data: https:");
    expect(csp).toContain("connect-src 'self' wss: https:");
  });

  it('should include X-Frame-Options: DENY', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.headers['x-frame-options']).toBe('DENY');
  });

  it('should include X-Content-Type-Options: nosniff', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('should include X-XSS-Protection header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.headers['x-xss-protection']).toBeDefined();
  });

  it('should include Strict-Transport-Security header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    const hsts = response.headers['strict-transport-security'];
    expect(hsts).toBeDefined();
    expect(hsts).toContain('max-age=31536000');
    expect(hsts).toContain('includeSubDomains');
  });

  it('should include Referrer-Policy header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  it('should include Permissions-Policy header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    const permPolicy = response.headers['permissions-policy'];
    expect(permPolicy).toBeDefined();
    expect(permPolicy).toContain('camera=()');
    expect(permPolicy).toContain('microphone=()');
    expect(permPolicy).toContain('geolocation=()');
  });

  it('should not expose X-Powered-By header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});

describe('CORS Configuration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should allow configured origin', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin: 'http://localhost:3001',
        'access-control-request-method': 'GET',
      },
    });

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3001');
  });

  it('should reject unauthorized origins', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin: 'https://evil-site.com',
        'access-control-request-method': 'GET',
      },
    });

    // Fastify CORS plugin returns false for the origin header when not allowed
    const allowOrigin = response.headers['access-control-allow-origin'];
    expect(allowOrigin).not.toBe('https://evil-site.com');
    expect(allowOrigin).not.toBe('*');
  });

  it('should only allow GET, POST, OPTIONS methods', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin: 'http://localhost:3001',
        'access-control-request-method': 'GET',
      },
    });

    const allowMethods = response.headers['access-control-allow-methods'] as string;
    expect(allowMethods).toBeDefined();
    expect(allowMethods).toContain('GET');
    expect(allowMethods).toContain('POST');
    expect(allowMethods).toContain('OPTIONS');
    expect(allowMethods).not.toContain('DELETE');
    expect(allowMethods).not.toContain('PUT');
    expect(allowMethods).not.toContain('PATCH');
  });

  it('should only allow Content-Type and Authorization headers', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin: 'http://localhost:3001',
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'Content-Type',
      },
    });

    const allowHeaders = response.headers['access-control-allow-headers'] as string;
    expect(allowHeaders).toBeDefined();
    expect(allowHeaders).toContain('Content-Type');
    expect(allowHeaders).toContain('Authorization');
  });

  it('should include Access-Control-Allow-Credentials', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        origin: 'http://localhost:3001',
      },
    });

    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });
});

describe('Rate Limiting', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should include rate limit headers in responses', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    // @fastify/rate-limit with enableDraftSpec uses draft-7 headers (without x- prefix)
    const hasStandardHeaders =
      response.headers['x-ratelimit-limit'] !== undefined &&
      response.headers['x-ratelimit-remaining'] !== undefined &&
      response.headers['x-ratelimit-reset'] !== undefined;

    const hasDraftHeaders =
      response.headers['ratelimit-limit'] !== undefined &&
      response.headers['ratelimit-remaining'] !== undefined &&
      response.headers['ratelimit-reset'] !== undefined;

    expect(hasStandardHeaders || hasDraftHeaders).toBe(true);
  });

  it('should enforce rate limits after exceeding max requests', async () => {
    // Create a separate app for this test to avoid interference
    const rateLimitApp = await buildApp();

    try {
      // Send requests up to the global limit (100 per minute)
      // We use a unique IP via x-forwarded-for to isolate this test
      const testIp = '10.99.99.99';
      let lastResponse;

      // Send 101 requests rapidly to trigger rate limit
      for (let i = 0; i <= 100; i++) {
        lastResponse = await rateLimitApp.inject({
          method: 'GET',
          url: '/health',
          headers: {
            'x-forwarded-for': testIp,
          },
        });

        if (lastResponse.statusCode === 429) {
          break;
        }
      }

      expect(lastResponse!.statusCode).toBe(429);
      const body = JSON.parse(lastResponse!.body);
      expect(body.error).toBe('Rate limit exceeded');
    } finally {
      await rateLimitApp.close();
    }
  });
});
