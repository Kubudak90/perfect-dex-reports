import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Parse the API_KEYS environment variable into a Set for O(1) lookups.
 * Keys are trimmed and empty strings are filtered out.
 */
function loadApiKeys(): Set<string> {
  const raw = process.env.API_KEYS || '';
  const keys = raw
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  return new Set(keys);
}

// Module-level cache so keys are parsed once at startup
const validApiKeys = loadApiKeys();

/**
 * Check whether authentication is enforced.
 * Auth is disabled when no API_KEYS are configured (e.g. local dev).
 */
export function isAuthEnabled(): boolean {
  return validApiKeys.size > 0;
}

/**
 * Validate an API key against the allowed set.
 */
export function isValidApiKey(key: string): boolean {
  return validApiKeys.has(key);
}

// ─── Fastify route-level config typing ──────────────────────────
declare module 'fastify' {
  interface FastifyContextConfig {
    /** When true, the route skips API key authentication */
    public?: boolean;
  }
}

/**
 * Register API key authentication on a Fastify instance.
 *
 * Call this directly (NOT via fastify.register) so the hook is attached
 * to the root instance without encapsulation — no fastify-plugin needed.
 *
 * Behaviour:
 *  - If no API_KEYS are configured the hook is a pass-through (dev mode).
 *  - Routes marked with `config: { public: true }` skip auth.
 *  - All other routes require a valid `x-api-key` header.
 */
export function registerAuth(fastify: FastifyInstance): void {
  fastify.addHook(
    'onRequest',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // If no keys are configured, auth is effectively disabled (local dev)
      if (!isAuthEnabled()) {
        return;
      }

      // Allow routes explicitly marked as public
      if (request.routeOptions.config?.public === true) {
        return;
      }

      const apiKey = request.headers['x-api-key'] as string | undefined;

      if (!apiKey) {
        reply.code(401).send({
          success: false,
          error: 'Unauthorized',
          message: 'Missing x-api-key header',
          statusCode: 401,
        });
        return;
      }

      if (!isValidApiKey(apiKey)) {
        reply.code(401).send({
          success: false,
          error: 'Unauthorized',
          message: 'Invalid API key',
          statusCode: 401,
        });
        return;
      }
    },
  );
}
