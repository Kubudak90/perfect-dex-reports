/**
 * Mock Mode Configuration
 * Allows API to run without PostgreSQL and Redis
 */

export const MOCK_MODE = process.env.MOCK_MODE === 'true' || process.env.NODE_ENV === 'test';

/**
 * Check if running in mock mode
 */
export function isMockMode(): boolean {
  return MOCK_MODE;
}

/**
 * Mock Database Client
 * Simulates Drizzle ORM interface for use when MOCK_MODE=true.
 *
 * When MOCK_MODE=false the real Drizzle/PG client is used instead (see db/index.ts).
 * This mock exists so that the API can start and serve stub responses without
 * requiring a running PostgreSQL instance.
 */
export class MockDB {
  async query() {
    return { rows: [] };
  }

  /**
   * Simulates drizzle's `db.execute()` method used by health checks.
   */
  async execute() {
    return { rows: [] };
  }

  select() {
    return {
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
        limit: () => Promise.resolve([]),
      }),
    };
  }

  insert() {
    return {
      values: () => ({
        onConflictDoNothing: () => ({
          returning: () => Promise.resolve([]),
        }),
        returning: () => Promise.resolve([]),
      }),
    };
  }

  update() {
    return {
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([]),
        }),
      }),
    };
  }

  delete() {
    return {
      where: () => Promise.resolve([]),
    };
  }
}

/**
 * Mock Redis Client
 * Simulates ioredis interface
 */
export class MockRedis {
  private storage = new Map<string, { value: string; expires?: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.storage.get(key);
    if (!item) return null;

    if (item.expires && item.expires < Date.now()) {
      this.storage.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key: string, value: string, ...args: any[]): Promise<'OK'> {
    const item: { value: string; expires?: number } = { value };

    // Parse EX argument (seconds)
    if (args[0] === 'EX' && typeof args[1] === 'number') {
      item.expires = Date.now() + args[1] * 1000;
    }

    this.storage.set(key, item);
    return 'OK';
  }

  async setex(key: string, seconds: number, value: string): Promise<'OK'> {
    return this.set(key, value, 'EX', seconds);
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.storage.delete(key)) deleted++;
    }
    return deleted;
  }

  async exists(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.storage.has(key)) count++;
    }
    return count;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const item = this.storage.get(key);
    if (!item) return 0;

    item.expires = Date.now() + seconds * 1000;
    this.storage.set(key, item);
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const item = this.storage.get(key);
    if (!item) return -2;
    if (!item.expires) return -1;

    const ttl = Math.ceil((item.expires - Date.now()) / 1000);
    return ttl > 0 ? ttl : -2;
  }

  async incr(key: string): Promise<number> {
    const current = parseInt((await this.get(key)) || '0', 10);
    const newValue = current + 1;
    await this.set(key, newValue.toString());
    return newValue;
  }

  /**
   * Simulates ioredis `keys(pattern)` used by CacheService.deletePattern().
   * Supports simple glob patterns with '*' wildcards.
   */
  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(
      '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'
    );
    const matching: string[] = [];
    for (const key of this.storage.keys()) {
      if (regex.test(key)) {
        matching.push(key);
      }
    }
    return matching;
  }

  async publish(_channel: string, _message: string): Promise<number> {
    // Mock: just return success
    return 1;
  }

  async subscribe(..._channels: string[]): Promise<void> {
    // Mock: no-op
  }

  async psubscribe(..._patterns: string[]): Promise<void> {
    // Mock: no-op
  }

  async unsubscribe(..._channels: string[]): Promise<void> {
    // Mock: no-op
  }

  async punsubscribe(..._patterns: string[]): Promise<void> {
    // Mock: no-op
  }

  on(_event: string, _listener: Function): this {
    return this;
  }

  async ping(): Promise<'PONG'> {
    return 'PONG';
  }

  async quit(): Promise<'OK'> {
    this.storage.clear();
    return 'OK';
  }

  /**
   * Mock duplicate for ioredis compatibility (used by WebSocketManager pub/sub)
   */
  duplicate(): MockRedis {
    return new MockRedis();
  }

  /**
   * Mock defineCommand for ioredis compatibility (used by @fastify/rate-limit)
   */
  defineCommand(name: string, _definition: { numberOfKeys: number; lua: string }): void {
    // Create a mock implementation of the Lua command
    (this as any)[name] = (key: string, timeWindow: number, max: number, _ban: number, _continueExceeding: boolean, cb: Function) => {
      const now = Date.now();
      const item = this.storage.get(key);
      let current: number;
      let ttl: number;

      if (!item || (item.expires && item.expires < now)) {
        // New window
        current = 1;
        ttl = timeWindow;
        this.storage.set(key, {
          value: '1',
          expires: now + timeWindow,
        });
      } else {
        current = parseInt(item.value, 10) + 1;
        ttl = item.expires ? item.expires - now : timeWindow;
        this.storage.set(key, {
          value: current.toString(),
          expires: item.expires || now + timeWindow,
        });
      }

      const banned = current > max;
      cb(null, [current, ttl, banned ? 1 : 0]);
    };
  }
}

/**
 * Create mock or real DB client
 */
export function createDBClient() {
  if (MOCK_MODE) {
    return new MockDB() as any;
  }

  // Import real DB only in non-mock mode
  const { db } = require('../db/index.js');
  return db;
}

/**
 * Create mock or real Redis client.
 *
 * PRODUCTION MODE (MOCK_MODE=false):
 *   - Connects to Redis at the URL specified by REDIS_URL env var.
 *   - Retries up to 10 times with exponential back-off before giving up.
 *   - lazyConnect is used so the caller can attach error listeners before
 *     the connection is actually attempted (see app.ts).
 *   - If Redis becomes unreachable after initial connection, ioredis will
 *     continue retrying transparently; the rate-limiter plugin is configured
 *     with skipOnError so requests are not hard-failed during Redis outages.
 */
export function createRedisClient() {
  if (MOCK_MODE) {
    return new MockRedis() as any;
  }

  // Import real Redis only in non-mock mode
  const Redis = require('ioredis').default;
  const { config } = require('./index.js');
  return new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      // Exponential back-off: 200ms, 400ms, 800ms, ... up to 5s
      // Give up after 10 retries so the process can surface the error
      // rather than blocking indefinitely.
      if (times > 10) return null;
      return Math.min(times * 200, 5000);
    },
    // lazyConnect lets app.ts attach event listeners before the first
    // connection attempt is made. Call redis.connect() explicitly after
    // listeners are wired up (see app.ts changes).
    lazyConnect: true,
    // Reconnect on READONLY errors (e.g. Redis failover)
    reconnectOnError: (err: Error) => {
      return err.message.includes('READONLY');
    },
    // Connection timeout: fail fast rather than hanging
    connectTimeout: 10000, // 10 seconds
  });
}

console.log(`[Mock Mode] ${MOCK_MODE ? 'ENABLED' : 'DISABLED'}`);
