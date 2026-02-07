import type { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import type Redis from 'ioredis';

/**
 * Rate limit configurations for different tiers
 */
export const RateLimitTiers = {
  // Public endpoints (no auth)
  public: {
    max: 100, // requests
    timeWindow: '1 minute',
  },

  // Authenticated users
  authenticated: {
    max: 500,
    timeWindow: '1 minute',
  },

  // Premium users
  premium: {
    max: 2000,
    timeWindow: '1 minute',
  },

  // WebSocket connections
  websocket: {
    max: 10, // messages per second
    timeWindow: '1 second',
  },
} as const;

/**
 * Rate limit configuration per endpoint
 */
export const EndpointRateLimits = {
  // Health checks - very permissive
  '/health': {
    max: 1000,
    timeWindow: '1 minute',
  },

  // Swap quotes - moderate
  '/v1/swap/quote': {
    max: 60,
    timeWindow: '1 minute',
  },

  // Price updates - moderate
  '/v1/tokens': {
    max: 120,
    timeWindow: '1 minute',
  },

  // Pool data - moderate
  '/v1/pools': {
    max: 120,
    timeWindow: '1 minute',
  },

  // Chart data - lower (more expensive queries)
  '/v1/charts/*': {
    max: 30,
    timeWindow: '1 minute',
  },

  // Analytics - lower (expensive aggregations)
  '/v1/analytics/*': {
    max: 30,
    timeWindow: '1 minute',
  },
} as const;


/**
 * Register global rate limiting
 */
export async function registerRateLimiting(fastify: FastifyInstance, redis: Redis) {
  // Global rate limiter with Redis store
  await fastify.register(rateLimit, {
    global: true,
    max: RateLimitTiers.public.max,
    timeWindow: RateLimitTiers.public.timeWindow,
    redis,
    nameSpace: 'basebook:ratelimit:',
    // When Redis is temporarily unavailable, allow requests through rather than
    // hard-failing every incoming request. This ensures the API degrades
    // gracefully (no rate limiting) instead of returning 500 to all callers.
    skipOnError: true,

    // Key generator - use IP address or API key
    keyGenerator: (request) => {
      // Check for API key in header
      const apiKey = request.headers['x-api-key'] as string;
      if (apiKey) {
        return `apikey:${apiKey}`;
      }

      // Use request.ip which respects Fastify's trustProxy setting.
      // Never parse x-forwarded-for manually -- Fastify handles it securely
      // based on the configured number of trusted proxy hops.
      return `ip:${request.ip}`;
    },

    // Error response handler
    errorResponseBuilder: (_request, context) => {
      return {
        success: false,
        error: 'Rate limit exceeded',
        message: `Too many requests. Retry after ${Math.ceil(context.ttl / 1000)} seconds.`,
        statusCode: 429,
        retryAfter: Math.ceil(context.ttl / 1000),
      };
    },

    // Add rate limit info to response headers
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },

    // Enable on all routes by default
    enableDraftSpec: true,
  });

  fastify.log.info('Rate limiting registered with Redis backend');
}

/**
 * Create custom rate limiter for specific endpoints
 */
export function createEndpointRateLimiter(options: {
  max: number;
  timeWindow: string | number;
  keyPrefix?: string;
}) {
  return {
    config: {
      rateLimit: {
        max: options.max,
        timeWindow: options.timeWindow,
        keyGenerator: (request: any) => {
          const apiKey = request.headers['x-api-key'] as string;
          const prefix = options.keyPrefix || 'endpoint';

          if (apiKey) {
            return `${prefix}:apikey:${apiKey}`;
          }

          // Use request.ip which respects Fastify's trustProxy setting.
          return `${prefix}:ip:${request.ip}`;
        },
      },
    },
  };
}

/**
 * Whitelist certain IPs from rate limiting
 */
export const RATE_LIMIT_WHITELIST = [
  '127.0.0.1',
  '::1',
  'localhost',
  // Add your monitoring/health check IPs here
];

/**
 * Check if IP is whitelisted
 */
export function isWhitelisted(ip: string): boolean {
  return RATE_LIMIT_WHITELIST.includes(ip);
}

/**
 * Rate limit bypass hook
 */
export function rateLimitBypassHook(_request: any, _reply: any, done: () => void) {
  // Reserved for future use
  done();
}

/**
 * WebSocket rate limiter
 */
export class WebSocketRateLimiter {
  private clients: Map<string, { count: number; resetAt: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    private max: number = 10,
    private windowMs: number = 1000
  ) {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Check if client has exceeded rate limit
   */
  check(clientId: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const clientData = this.clients.get(clientId);

    if (!clientData || clientData.resetAt <= now) {
      // New window
      this.clients.set(clientId, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return { allowed: true, remaining: this.max - 1 };
    }

    if (clientData.count >= this.max) {
      return { allowed: false, remaining: 0 };
    }

    clientData.count++;
    return { allowed: true, remaining: this.max - clientData.count };
  }

  /**
   * Reset rate limit for client
   */
  reset(clientId: string): void {
    this.clients.delete(clientId);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [clientId, data] of this.clients.entries()) {
      if (data.resetAt <= now) {
        this.clients.delete(clientId);
      }
    }
  }

  /**
   * Shutdown and cleanup
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clients.clear();
  }
}
