import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import { config } from './config/index.js';
import { createDBClient, createRedisClient, isMockMode } from './config/mock.js';
import { registerRoutes } from './api/routes/index.js';
import { errorHandler, notFoundHandler, setupProcessErrorHandlers, ErrorMonitor } from './api/middleware/errorHandler.js';
import { registerRateLimiting } from './api/middleware/rateLimiter.js';
import { registerAuth, isAuthEnabled } from './api/middleware/auth.js';
import { WebSocketManager } from './websocket/manager.js';
import { PriceSyncWorker } from './workers/priceSync.worker.js';

// Extend Fastify instance types
declare module 'fastify' {
  interface FastifyInstance {
    db: any;
    redis: any;
    wsManager: WebSocketManager;
    priceSyncWorker: PriceSyncWorker;
    errorMonitor: ErrorMonitor;
  }
}

export async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: config.logging.level,
      transport:
        config.env === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
    // Trust only a specific number of proxy hops to prevent x-forwarded-for spoofing.
    // A numeric value tells Fastify to use the Nth-from-right entry in x-forwarded-for,
    // so only the IP added by the trusted proxy is used, not attacker-injected values.
    // Configure via TRUSTED_PROXY_HOPS env var (default: 1 for a single reverse proxy).
    trustProxy: config.trustProxyHops,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId',
  });

  // Register plugins - security headers via helmet
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'wss:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow cross-origin requests for API
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
    frameguard: {
      action: 'deny',
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
  });

  // Additional security headers not covered by helmet
  fastify.addHook('onSend', async (_request, reply) => {
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  });

  await fastify.register(cors, {
    origin: config.cors.origin,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    credentials: true,
  });

  await fastify.register(websocket);

  // Create DB and Redis clients (mock or real)
  const db = createDBClient();
  const redis = createRedisClient();

  if (isMockMode()) {
    fastify.log.info('Running in MOCK MODE (no PostgreSQL/Redis required)');
  } else {
    // ── Redis event listeners ───────────────────────────────────────
    // Attached BEFORE connect() so that early errors are captured.
    redis.on('error', (error: Error) => {
      fastify.log.error(error, 'Redis connection error');
    });

    redis.on('connect', () => {
      fastify.log.info('Redis connected');
    });

    redis.on('reconnecting', (delay: number) => {
      fastify.log.warn(`Redis reconnecting in ${delay}ms`);
    });

    // ── Establish Redis connection ──────────────────────────────────
    // createRedisClient uses lazyConnect so we must call connect() here.
    // If Redis is unavailable the server still starts (rate limiting
    // will degrade gracefully via skipOnError) but logs the failure.
    try {
      await redis.connect();
      fastify.log.info('Redis initial connection established');
    } catch (error) {
      fastify.log.warn(
        error,
        'Redis initial connection failed -- server will start without Redis; ' +
        'rate limiting will fall back to in-memory and cache will be unavailable until Redis recovers'
      );
    }

    // ── Verify database connection ──────────────────────────────────
    // In production mode, verify the database is reachable at startup.
    // If the DB is down the server still starts (health endpoint will
    // report degraded) so that orchestrators can route traffic away.
    try {
      const { checkDatabaseConnection } = await import('./db/index.js');
      const dbOk = await checkDatabaseConnection();
      if (dbOk) {
        fastify.log.info('PostgreSQL connection verified');
      } else {
        fastify.log.warn(
          'PostgreSQL connection check failed at startup -- server will start in degraded mode; ' +
          'database-dependent endpoints will return 500 until the connection is restored'
        );
      }
    } catch (error) {
      fastify.log.warn(
        error,
        'PostgreSQL connection check threw at startup -- server will start in degraded mode'
      );
    }
  }

  // Decorate Fastify with db and redis
  fastify.decorate('db', db);
  fastify.decorate('redis', redis);

  // Register advanced rate limiting with Redis
  await registerRateLimiting(fastify, redis);

  // Register API key authentication hook
  registerAuth(fastify);
  if (isAuthEnabled()) {
    fastify.log.info('API key authentication enabled');
  } else {
    fastify.log.warn('API key authentication DISABLED (no API_KEYS configured)');
  }

  // Initialize Error Monitor
  const errorMonitor = new ErrorMonitor(fastify.log);
  fastify.decorate('errorMonitor', errorMonitor);

  // Setup process error handlers
  setupProcessErrorHandlers(fastify.log);

  // Initialize WebSocket manager
  const wsManager = new WebSocketManager(fastify, redis);
  fastify.decorate('wsManager', wsManager);
  await wsManager.register();

  // Initialize Price Sync Worker
  const priceSyncWorker = new PriceSyncWorker(fastify);
  fastify.decorate('priceSyncWorker', priceSyncWorker);

  // Start worker in production/development
  if (config.env !== 'test') {
    priceSyncWorker.start(10000); // Sync every 10 seconds
  }

  // Register routes
  await registerRoutes(fastify);

  // Register error handlers (must be after routes)
  fastify.setErrorHandler(errorHandler);
  fastify.setNotFoundHandler(notFoundHandler);

  // Graceful shutdown
  const closeGracefully = async (signal: string) => {
    fastify.log.info(`Received ${signal}, closing server gracefully...`);

    // Stop workers
    priceSyncWorker.stop();
    await wsManager.shutdown();
    errorMonitor.shutdown();

    await fastify.close();

    // Close Redis connection
    try {
      await redis.quit();
    } catch (err) {
      fastify.log.warn(err, 'Error closing Redis connection during shutdown');
    }

    // Close PostgreSQL connection pool (only in non-mock mode)
    if (!isMockMode()) {
      try {
        const { closeDatabaseConnection } = await import('./db/index.js');
        await closeDatabaseConnection();
        fastify.log.info('PostgreSQL connection pool closed');
      } catch (err) {
        fastify.log.warn(err, 'Error closing PostgreSQL connection during shutdown');
      }
    }

    process.exit(0);
  };

  process.on('SIGTERM', () => closeGracefully('SIGTERM'));
  process.on('SIGINT', () => closeGracefully('SIGINT'));

  return fastify;
}
