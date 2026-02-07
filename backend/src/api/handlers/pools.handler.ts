import type { FastifyReply, FastifyRequest, FastifyInstance } from 'fastify';
import { eq, and, sql, gte, desc, asc, aliasedTable } from 'drizzle-orm';
import { pools, tokens, type Pool, type Token } from '../../db/schema/index.js';
import type { GetPoolsRequest, PoolDetailResponse } from '../schemas/pools.schema.js';
import { getPoolState } from '../../blockchain/contracts/poolManager.js';
import { CacheService } from '../../cache/index.js';
import { CacheKeys, CacheTTL } from '../../cache/keys.js';

// Create an alias for the tokens table so we can JOIN it twice
// (once for token0, once for token1) in the same query.
const tokens1 = aliasedTable(tokens, 'tokens1');

export class PoolsHandler {
  private cache: CacheService;

  constructor(private fastify: FastifyInstance) {
    this.cache = new CacheService(fastify.redis);
  }

  getPools = async (
    request: FastifyRequest<{ Querystring: GetPoolsRequest }>,
    reply: FastifyReply
  ) => {
    const { chainId, limit, offset, sortBy, sortOrder, token0, token1, minTvl } = request.query;

    try {
      // Check cache first
      const cacheKey = CacheKeys.poolList(chainId, `${sortBy}-${sortOrder}-${offset}-${limit}`);
      const cached = await this.cache.get(cacheKey);

      if (cached && !token0 && !token1 && !minTvl) {
        return reply.send(cached);
      }

      // Build query conditions
      const conditions = [eq(pools.chainId, chainId)];

      if (token0) {
        const [token0Record] = await this.fastify.db
          .select({ id: tokens.id })
          .from(tokens)
          .where(and(eq(tokens.address, token0.toLowerCase()), eq(tokens.chainId, chainId)))
          .limit(1);

        if (token0Record) {
          conditions.push(eq(pools.token0Id, token0Record.id));
        }
      }

      if (token1) {
        const [token1Record] = await this.fastify.db
          .select({ id: tokens.id })
          .from(tokens)
          .where(and(eq(tokens.address, token1.toLowerCase()), eq(tokens.chainId, chainId)))
          .limit(1);

        if (token1Record) {
          conditions.push(eq(pools.token1Id, token1Record.id));
        }
      }

      if (minTvl !== undefined) {
        conditions.push(gte(pools.tvlUsd, minTvl.toString()));
      }

      // Determine sort column
      const sortColumn = {
        tvl: pools.tvlUsd,
        volume: pools.volume24hUsd,
        apr: pools.apr24h,
        createdAt: pools.createdAt,
      }[sortBy];

      const sortFn = sortOrder === 'desc' ? desc : asc;

      // Get pools with pagination, joining tokens table twice for token0 and token1
      const [poolsList, [{ count }]] = await Promise.all([
        this.fastify.db
          .select({
            pool: pools,
            token0: tokens,
            token1: tokens1,
          })
          .from(pools)
          .leftJoin(tokens, eq(pools.token0Id, tokens.id))
          .leftJoin(tokens1, eq(pools.token1Id, tokens1.id))
          .where(and(...conditions))
          .limit(limit)
          .offset(offset)
          .orderBy(sortFn(sortColumn)),

        this.fastify.db
          .select({ count: sql<number>`count(*)` })
          .from(pools)
          .where(and(...conditions)),
      ]);

      // Format response — no extra queries needed since both tokens
      // are fetched via the double JOIN above.
      const formattedPools = poolsList.map(({ pool, token0, token1: token1Data }: { pool: Pool; token0: Token | null; token1: Token | null }) => ({
        id: pool.id,
        poolId: pool.poolId,
        chainId: pool.chainId,

        token0: token0 ? {
          id: token0.id,
          address: token0.address,
          symbol: token0.symbol,
          name: token0.name,
          decimals: token0.decimals,
          logoUri: token0.logoUri,
        } : null,

        token1: token1Data ? {
          id: token1Data.id,
          address: token1Data.address,
          symbol: token1Data.symbol,
          name: token1Data.name,
          decimals: token1Data.decimals,
          logoUri: token1Data.logoUri,
        } : null,

        feeTier: pool.feeTier,
        tickSpacing: pool.tickSpacing,
        hookAddress: pool.hookAddress,

        sqrtPriceX96: pool.sqrtPriceX96?.toString() ?? '0',
        currentTick: pool.currentTick ?? 0,
        liquidity: pool.liquidity?.toString() ?? '0',
        token0Price: pool.token0Price?.toString() ?? null,
        token1Price: pool.token1Price?.toString() ?? null,

        volume24hUsd: pool.volume24hUsd?.toString() ?? '0',
        volume24hToken0: pool.volume24hToken0?.toString() ?? '0',
        volume24hToken1: pool.volume24hToken1?.toString() ?? '0',
        fees24hUsd: pool.fees24hUsd?.toString() ?? '0',
        txCount24h: pool.txCount24h ?? 0,

        tvlUsd: pool.tvlUsd?.toString() ?? '0',
        tvlToken0: pool.tvlToken0?.toString() ?? '0',
        tvlToken1: pool.tvlToken1?.toString() ?? '0',

        apr24h: pool.apr24h?.toString() ?? '0',

        createdAt: pool.createdAt.toISOString(),
        updatedAt: pool.updatedAt.toISOString(),
      }));

      const response = {
        pools: formattedPools,
        total: count,
        limit,
        offset,
      };

      // Cache the response
      if (!token0 && !token1 && !minTvl) {
        await this.cache.set(cacheKey, response, CacheTTL.poolList);
      }

      return reply.send(response);
    } catch (error) {
      request.log.error(error, 'Failed to get pools');
      return reply.status(500).send({ error: 'Failed to get pools' });
    }
  };

  getPool = async (
    request: FastifyRequest<{
      Params: { poolId: string };
      Querystring: { chainId: number };
    }>,
    reply: FastifyReply
  ) => {
    const { poolId } = request.params;
    const { chainId } = request.query;

    try {
      // Check cache first
      const cacheKey = CacheKeys.pool(chainId, poolId);
      const cached = await this.cache.get<PoolDetailResponse>(cacheKey);

      if (cached) {
        return reply.send(cached);
      }

      // Get pool from database
      const [poolRecord] = await this.fastify.db
        .select({
          pool: pools,
        })
        .from(pools)
        .where(and(eq(pools.poolId, poolId), eq(pools.chainId, chainId)))
        .limit(1);

      if (!poolRecord) {
        return reply.status(404).send({ error: 'Pool not found' });
      }

      const pool = poolRecord.pool;

      // Get tokens
      const [token0Data, token1Data] = await Promise.all([
        this.fastify.db.select().from(tokens).where(eq(tokens.id, pool.token0Id)).limit(1),
        this.fastify.db.select().from(tokens).where(eq(tokens.id, pool.token1Id)).limit(1),
      ]);

      const token0 = token0Data[0];
      const token1 = token1Data[0];

      // Try to get fresh on-chain state
      let onChainState = null;
      try {
        onChainState = await getPoolState(chainId, poolId as `0x${string}`);
      } catch (error) {
        request.log.warn(error, 'Failed to fetch on-chain pool state');
      }

      const response: PoolDetailResponse = {
        id: pool.id,
        poolId: pool.poolId,
        chainId: pool.chainId,

        token0: token0 ? {
          id: token0.id,
          address: token0.address,
          symbol: token0.symbol,
          name: token0.name,
          decimals: token0.decimals,
          logoUri: token0.logoUri,
        } : null as any,

        token1: token1 ? {
          id: token1.id,
          address: token1.address,
          symbol: token1.symbol,
          name: token1.name,
          decimals: token1.decimals,
          logoUri: token1.logoUri,
        } : null as any,

        feeTier: pool.feeTier,
        tickSpacing: pool.tickSpacing,
        hookAddress: pool.hookAddress,

        // Use on-chain state if available, fallback to DB
        sqrtPriceX96: onChainState?.sqrtPriceX96.toString() ?? pool.sqrtPriceX96?.toString() ?? '0',
        currentTick: onChainState?.tick ?? pool.currentTick ?? 0,
        liquidity: onChainState?.liquidity.toString() ?? pool.liquidity?.toString() ?? '0',
        token0Price: pool.token0Price?.toString() ?? null,
        token1Price: pool.token1Price?.toString() ?? null,

        volume24hUsd: pool.volume24hUsd?.toString() ?? '0',
        volume24hToken0: pool.volume24hToken0?.toString() ?? '0',
        volume24hToken1: pool.volume24hToken1?.toString() ?? '0',
        fees24hUsd: pool.fees24hUsd?.toString() ?? '0',
        txCount24h: pool.txCount24h ?? 0,

        tvlUsd: pool.tvlUsd?.toString() ?? '0',
        tvlToken0: pool.tvlToken0?.toString() ?? '0',
        tvlToken1: pool.tvlToken1?.toString() ?? '0',

        apr24h: pool.apr24h?.toString() ?? '0',

        createdAt: pool.createdAt.toISOString(),
        updatedAt: pool.updatedAt.toISOString(),

        // Extended fields (future implementation)
        volume7dUsd: '0',
        volume30dUsd: '0',
        fees7dUsd: '0',
        fees30dUsd: '0',
      };

      // Cache the response
      await this.cache.set(cacheKey, response, CacheTTL.pool);

      return reply.send(response);
    } catch (error) {
      request.log.error(error, 'Failed to get pool');
      return reply.status(500).send({ error: 'Failed to get pool' });
    }
  };
}
