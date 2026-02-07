import type { FastifyPluginAsync } from 'fastify';
import { TokensHandler } from '../handlers/tokens.handler.js';
import { GetTokensSchema, GetTokenSchema } from '../schemas/tokens.schema.js';

export const tokensRoutes: FastifyPluginAsync = async (fastify) => {
  const handler = new TokensHandler(fastify);

  // GET /tokens (public - no auth required)
  fastify.get('/', {
    schema: GetTokensSchema,
    config: { public: true },
    handler: handler.getTokens,
  });

  // GET /tokens/:address (public - no auth required)
  fastify.get('/:address', {
    schema: GetTokenSchema,
    config: { public: true },
    handler: handler.getToken,
  });
};
