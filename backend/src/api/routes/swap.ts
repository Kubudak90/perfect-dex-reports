import type { FastifyPluginAsync } from 'fastify';
import { SwapHandler } from '../handlers/swap.handler.js';
import { GetQuoteSchema } from '../schemas/swap.schema.js';

export const swapRoutes: FastifyPluginAsync = async (fastify) => {
  const handler = new SwapHandler(fastify);

  // GET /swap/quote - stricter rate limit (10 requests/minute per IP)
  fastify.get('/quote', {
    schema: GetQuoteSchema,
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
    handler: handler.getQuote,
  });

  // Future endpoints:
  // POST /swap/route - Multi-hop routing (Rust router integration)
  // POST /swap/build - Build swap transaction
};
