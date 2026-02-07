import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../config/index.js';
import { isMockMode } from '../config/mock.js';
import * as schema from './schema/index.js';

const { Pool } = pg;

// ── Health state ────────────────────────────────────────────────────
let _dbHealthy = true;
let _reconnecting = false;

const MAX_RECONNECT_RETRIES = 3;
const BASE_BACKOFF_MS = 1000; // 1s, 2s, 4s

// ---------------------------------------------------------------------------
// PRODUCTION MODE: PostgreSQL pool is only created when MOCK_MODE is false.
// In mock mode the pool and drizzle instance are set to null; callers should
// use the mock DB client provided by config/mock.ts via app.ts instead.
// ---------------------------------------------------------------------------

// Create PostgreSQL connection pool (only in non-mock mode)
const pool = isMockMode()
  ? null
  : new Pool({
      connectionString: config.database.url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

/**
 * Attempt to verify the pool can still reach the database.
 * Retries up to MAX_RECONNECT_RETRIES times with exponential backoff.
 * Returns true if any attempt succeeds.
 */
async function attemptReconnect(): Promise<boolean> {
  if (!pool) return false;

  for (let attempt = 1; attempt <= MAX_RECONNECT_RETRIES; attempt++) {
    const delay = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
    console.error(
      `[db] Reconnection attempt ${attempt}/${MAX_RECONNECT_RETRIES} in ${delay}ms...`
    );
    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log(`[db] Reconnection attempt ${attempt} succeeded`);
      return true;
    } catch (err) {
      console.error(
        `[db] Reconnection attempt ${attempt} failed:`,
        err instanceof Error ? err.message : err
      );
    }
  }
  return false;
}

// Handle pool errors — replaces the previous process.exit(-1)
// Only attach listener when pool exists (non-mock mode).
if (pool) {
  pool.on('error', async (err) => {
    console.error('[db] CRITICAL: Unexpected error on idle PostgreSQL client', err);

    // Mark health as degraded immediately
    _dbHealthy = false;

    // Avoid overlapping reconnection loops
    if (_reconnecting) {
      console.error('[db] Reconnection already in progress, skipping duplicate attempt');
      return;
    }

    _reconnecting = true;
    try {
      const recovered = await attemptReconnect();
      if (recovered) {
        _dbHealthy = true;
        console.log('[db] Pool connection restored');
      } else {
        console.error(
          `[db] All ${MAX_RECONNECT_RETRIES} reconnection attempts failed. ` +
            'Database marked unhealthy. Initiating graceful shutdown...'
        );
        // Graceful shutdown: give in-flight requests a chance to finish,
        // then exit with a non-zero code so the orchestrator can restart us.
        try {
          await pool.end();
        } catch (_endErr) {
          // Pool may already be broken — ignore
        }
        // Use setTimeout so the current event-loop tick can finish logging
        setTimeout(() => process.exit(1), 500);
      }
    } finally {
      _reconnecting = false;
    }
  });
}

// Create Drizzle instance (null in mock mode — callers use the mock DB via app.ts)
export const db = pool ? drizzle(pool, { schema }) : (null as any);

// ── Public health API ──────────────────────────────────────────────

/**
 * Returns `false` when the database connection is known to be broken.
 * In mock mode, always returns true since no real DB is used.
 * This is a synchronous, zero-cost check suitable for liveness probes.
 */
export function isHealthy(): boolean {
  if (isMockMode()) return true;
  return _dbHealthy;
}

/**
 * Active health check — actually pings the database.
 * In mock mode, always returns true.
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  if (isMockMode() || !pool) return true;

  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    _dbHealthy = true;
    return true;
  } catch (error) {
    console.error('[db] Database connection check failed:', error);
    _dbHealthy = false;
    return false;
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  if (pool) {
    await pool.end();
  }
}

// Export schema types
export * from './schema/index.js';
