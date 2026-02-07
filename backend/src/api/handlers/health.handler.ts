import type { FastifyRequest, FastifyReply } from 'fastify';
import { isMockMode } from '../../config/mock.js';
import { isHealthy as isDbHealthy } from '../../db/index.js';

/**
 * Basic health check
 * Returns 503 when the database pool has been flagged unhealthy.
 */
export async function healthCheckHandler(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  const dbOk = isMockMode() || isDbHealthy();
  return reply.code(dbOk ? 200 : 503).send({
    status: dbOk ? 'healthy' : 'degraded',
    timestamp: Math.floor(Date.now() / 1000),
    mode: isMockMode() ? 'mock' : 'production',
    ...(dbOk ? {} : { reason: 'database connection lost' }),
  });
}

/**
 * Detailed health check with dependency status
 */
export async function detailedHealthCheckHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const startTime = Date.now();

  // Check database connection
  let dbStatus = 'unknown';
  let dbError = null;

  if (isMockMode()) {
    dbStatus = 'mock';
  } else {
    try {
      await request.server.db.execute('SELECT 1');
      dbStatus = 'connected';
    } catch (error) {
      dbStatus = 'disconnected';
      dbError = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  // Check Redis connection
  let redisStatus = 'unknown';
  let redisError = null;

  if (isMockMode()) {
    redisStatus = 'mock';
  } else {
    try {
      await request.server.redis.ping();
      redisStatus = 'connected';
    } catch (error) {
      redisStatus = 'disconnected';
      redisError = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  const responseTime = Date.now() - startTime;

  // Combine the live query result with the pool-level health flag
  const dbPoolOk = isDbHealthy();
  const isHealthy = isMockMode() || (dbStatus === 'connected' && dbPoolOk && redisStatus === 'connected');

  return reply.code(isHealthy ? 200 : 503).send({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: Math.floor(Date.now() / 1000),
    mode: isMockMode() ? 'mock' : 'production',
    uptime: process.uptime(),
    responseTime: `${responseTime}ms`,
    dependencies: {
      database: {
        status: dbStatus,
        poolHealthy: dbPoolOk,
        ...(dbError && { error: dbError }),
      },
      redis: {
        status: redisStatus,
        ...(redisError && { error: redisError }),
      },
    },
    version: '1.0.0',
  });
}
