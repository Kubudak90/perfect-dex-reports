import type { FastifyReply, FastifyRequest, FastifyInstance } from 'fastify';
import { eq, and, sql, ilike, or } from 'drizzle-orm';
import { tokens } from '../../db/schema/index.js';
import type { GetTokensRequest, GetTokenResponse } from '../schemas/tokens.schema.js';

export class TokensHandler {
  constructor(private fastify: FastifyInstance) {}

  getTokens = async (
    request: FastifyRequest<{ Querystring: GetTokensRequest }>,
    reply: FastifyReply
  ) => {
    const { chainId, limit, offset, verified, search } = request.query;

    try {
      // Build query conditions
      const conditions = [eq(tokens.chainId, chainId)];

      if (verified !== undefined) {
        conditions.push(eq(tokens.isVerified, verified));
      }

      if (search) {
        conditions.push(
          or(
            ilike(tokens.symbol, `%${search}%`),
            ilike(tokens.name, `%${search}%`),
            ilike(tokens.address, `%${search}%`)
          )!
        );
      }

      // Get tokens with pagination
      const [tokensList, [{ count }]] = await Promise.all([
        this.fastify.db
          .select()
          .from(tokens)
          .where(and(...conditions))
          .limit(limit)
          .offset(offset)
          .orderBy(sql`${tokens.volume24hUsd} DESC`),

        this.fastify.db
          .select({ count: sql<number>`count(*)` })
          .from(tokens)
          .where(and(...conditions)),
      ]);

      return reply.send({
        tokens: tokensList.map(token => ({
          ...token,
          isVerified: token.isVerified ?? false,
          isNative: token.isNative ?? false,
          priceUsd: token.priceUsd?.toString() ?? null,
          volume24hUsd: token.volume24hUsd?.toString() ?? '0',
          tvlUsd: token.tvlUsd?.toString() ?? '0',
          priceChange24h: token.priceChange24h?.toString() ?? '0',
        })),
        total: count,
        limit,
        offset,
      });
    } catch (error) {
      request.log.error(error, 'Failed to get tokens');
      return reply.status(500).send({ error: 'Failed to get tokens' });
    }
  };

  getToken = async (
    request: FastifyRequest<{
      Params: { address: string };
      Querystring: { chainId: number };
    }>,
    reply: FastifyReply
  ) => {
    const { address } = request.params;
    const { chainId } = request.query;

    try {
      const [token] = await this.fastify.db
        .select()
        .from(tokens)
        .where(and(eq(tokens.address, address.toLowerCase()), eq(tokens.chainId, chainId)))
        .limit(1);

      if (!token) {
        return reply.status(404).send({ error: 'Token not found' });
      }

      const response: GetTokenResponse = {
        ...token,
        isVerified: token.isVerified ?? false,
        isNative: token.isNative ?? false,
        priceUsd: token.priceUsd?.toString() ?? null,
        volume24hUsd: token.volume24hUsd?.toString() ?? '0',
        tvlUsd: token.tvlUsd?.toString() ?? '0',
        priceChange24h: token.priceChange24h?.toString() ?? '0',
      };

      return reply.send(response);
    } catch (error) {
      request.log.error(error, 'Failed to get token');
      return reply.status(500).send({ error: 'Failed to get token' });
    }
  };
}
