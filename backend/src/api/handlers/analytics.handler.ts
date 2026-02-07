import type { FastifyRequest, FastifyReply } from 'fastify';
import type {
  GetProtocolOverviewQuerystring,
  GetProtocolTVLHistoryQuerystring,
  GetProtocolVolumeHistoryQuerystring,
  GetTopPoolsQuerystring,
  GetTopTokensQuerystring,
  GetTrendingPoolsQuerystring,
} from '../schemas/analytics.schema.js';
// NOTE: Do NOT import `db` directly from '../../db/index.js' here.
// Use request.server.db which respects the mock/real mode selection.
import { pools, poolDayData } from '../../db/schema/pools.js';
import { tokens } from '../../db/schema/tokens.js';
import { eq, desc, sql, and, gte } from 'drizzle-orm';
import { CacheService } from '../../cache/index.js';

/**
 * Get protocol overview statistics
 */
export async function getProtocolOverviewHandler(
  request: FastifyRequest<{
    Querystring: GetProtocolOverviewQuerystring;
  }>,
  reply: FastifyReply
) {
  const { chainId } = request.query;

  try {
    // Check cache
    const cache = new CacheService(request.server.redis);
    const cacheKey = `analytics:${chainId}:overview`;
    const cached = await cache.get(cacheKey);

    if (cached) {
      return reply.send({
        success: true,
        data: cached,
      });
    }

    // Aggregate data from all pools
    const poolsData = await request.server.db
      .select({
        totalTvl: sql<string>`COALESCE(SUM(${pools.tvlUsd}), 0)`,
        totalVolume24h: sql<string>`COALESCE(SUM(${pools.volume24hUsd}), 0)`,
        totalFees24h: sql<string>`COALESCE(SUM(${pools.fees24hUsd}), 0)`,
        totalTxCount24h: sql<number>`COALESCE(SUM(${pools.txCount24h}), 0)`,
        poolCount: sql<number>`COUNT(*)`,
      })
      .from(pools)
      .where(eq(pools.chainId, chainId));

    const data = poolsData[0];

    // Calculate 7d volume and fees
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const weeklyData = await request.server.db
      .select({
        totalVolume7d: sql<string>`COALESCE(SUM(${poolDayData.volumeUsd}), 0)`,
        totalFees7d: sql<string>`COALESCE(SUM(${poolDayData.feesUsd}), 0)`,
      })
      .from(poolDayData)
      .innerJoin(pools, eq(poolDayData.poolId, pools.id))
      .where(and(eq(pools.chainId, chainId), gte(poolDayData.dayStart, sevenDaysAgoStr)));

    const weekData = weeklyData[0] || { totalVolume7d: '0', totalFees7d: '0' };

    const result = {
      tvlUsd: data.totalTvl || '0',
      volume24h: data.totalVolume24h || '0',
      volume7d: weekData.totalVolume7d || '0',
      fees24h: data.totalFees24h || '0',
      fees7d: weekData.totalFees7d || '0',
      poolCount: data.poolCount || 0,
      txCount24h: data.totalTxCount24h || 0,
      timestamp: Math.floor(Date.now() / 1000),
    };

    // Cache for 1 minute
    await cache.set(cacheKey, result, 60);

    return reply.send({
      success: true,
      data: result,
    });
  } catch (error) {
    request.log.error(error, 'Failed to fetch protocol overview');
    return reply.code(500).send({
      success: false,
      error: 'Failed to fetch protocol overview',
    });
  }
}

/**
 * Get protocol TVL history
 */
export async function getProtocolTVLHistoryHandler(
  request: FastifyRequest<{
    Querystring: GetProtocolTVLHistoryQuerystring;
  }>,
  reply: FastifyReply
) {
  const { chainId, period } = request.query;

  try {
    // Check cache
    const cache = new CacheService(request.server.redis);
    const cacheKey = `analytics:${chainId}:tvl:${period}`;
    const cached = await cache.get(cacheKey);

    if (cached) {
      return reply.send({
        success: true,
        data: cached,
      });
    }

    // Calculate date range
    const now = new Date();
    let daysBack = 30;
    switch (period) {
      case '7d':
        daysBack = 7;
        break;
      case '30d':
        daysBack = 30;
        break;
      case '90d':
        daysBack = 90;
        break;
      case '1y':
        daysBack = 365;
        break;
      case 'all':
        daysBack = 3650; // 10 years
        break;
    }

    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysBack);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Aggregate daily TVL from all pools
    const dailyTvl = await request.server.db
      .select({
        dayStart: poolDayData.dayStart,
        totalTvl: sql<string>`SUM(${poolDayData.tvlUsd})`,
      })
      .from(poolDayData)
      .innerJoin(pools, eq(poolDayData.poolId, pools.id))
      .where(and(eq(pools.chainId, chainId), gte(poolDayData.dayStart, startDateStr)))
      .groupBy(poolDayData.dayStart)
      .orderBy(poolDayData.dayStart);

    const history = dailyTvl.map((item) => ({
      timestamp: Math.floor(new Date(item.dayStart).getTime() / 1000),
      tvlUsd: item.totalTvl || '0',
    }));

    const result = { history };

    // Cache for 5 minutes
    await cache.set(cacheKey, result, 300);

    return reply.send({
      success: true,
      data: result,
    });
  } catch (error) {
    request.log.error(error, 'Failed to fetch protocol TVL history');
    return reply.code(500).send({
      success: false,
      error: 'Failed to fetch protocol TVL history',
    });
  }
}

/**
 * Get protocol volume history
 */
export async function getProtocolVolumeHistoryHandler(
  request: FastifyRequest<{
    Querystring: GetProtocolVolumeHistoryQuerystring;
  }>,
  reply: FastifyReply
) {
  const { chainId, period } = request.query;

  try {
    // Check cache
    const cache = new CacheService(request.server.redis);
    const cacheKey = `analytics:${chainId}:volume:${period}`;
    const cached = await cache.get(cacheKey);

    if (cached) {
      return reply.send({
        success: true,
        data: cached,
      });
    }

    // Calculate date range
    const now = new Date();
    let daysBack = 30;
    switch (period) {
      case '7d':
        daysBack = 7;
        break;
      case '30d':
        daysBack = 30;
        break;
      case '90d':
        daysBack = 90;
        break;
      case '1y':
        daysBack = 365;
        break;
      case 'all':
        daysBack = 3650;
        break;
    }

    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysBack);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Aggregate daily volume and fees from all pools
    const dailyStats = await request.server.db
      .select({
        dayStart: poolDayData.dayStart,
        totalVolume: sql<string>`SUM(${poolDayData.volumeUsd})`,
        totalFees: sql<string>`SUM(${poolDayData.feesUsd})`,
        totalTxCount: sql<number>`SUM(${poolDayData.txCount})`,
      })
      .from(poolDayData)
      .innerJoin(pools, eq(poolDayData.poolId, pools.id))
      .where(and(eq(pools.chainId, chainId), gte(poolDayData.dayStart, startDateStr)))
      .groupBy(poolDayData.dayStart)
      .orderBy(poolDayData.dayStart);

    const history = dailyStats.map((item) => ({
      timestamp: Math.floor(new Date(item.dayStart).getTime() / 1000),
      volumeUsd: item.totalVolume || '0',
      feesUsd: item.totalFees || '0',
      txCount: item.totalTxCount || 0,
    }));

    const result = { history };

    // Cache for 5 minutes
    await cache.set(cacheKey, result, 300);

    return reply.send({
      success: true,
      data: result,
    });
  } catch (error) {
    request.log.error(error, 'Failed to fetch protocol volume history');
    return reply.code(500).send({
      success: false,
      error: 'Failed to fetch protocol volume history',
    });
  }
}

/**
 * Get top pools
 */
export async function getTopPoolsHandler(
  request: FastifyRequest<{
    Querystring: GetTopPoolsQuerystring;
  }>,
  reply: FastifyReply
) {
  const { chainId, orderBy, limit } = request.query;

  try {
    // Check cache
    const cache = new CacheService(request.server.redis);
    const cacheKey = `analytics:${chainId}:top-pools:${orderBy}:${limit}`;
    const cached = await cache.get(cacheKey);

    if (cached) {
      return reply.send({
        success: true,
        data: cached,
      });
    }

    // Determine sort column
    let sortColumn;
    switch (orderBy) {
      case 'tvl':
        sortColumn = pools.tvlUsd;
        break;
      case 'volume24h':
        sortColumn = pools.volume24hUsd;
        break;
      case 'fees24h':
        sortColumn = pools.fees24hUsd;
        break;
      case 'apr':
        sortColumn = pools.apr24h;
        break;
    }

    // Fetch top pools with token details
    const topPools = await request.server.db
      .select({
        pool: pools,
        token0: tokens,
        token1: tokens,
      })
      .from(pools)
      .leftJoin(tokens, eq(pools.token0Id, tokens.id))
      .leftJoin(tokens, eq(pools.token1Id, tokens.id))
      .where(eq(pools.chainId, chainId))
      .orderBy(desc(sortColumn))
      .limit(limit);

    const poolsData = topPools.map(({ pool, token0, token1 }) => ({
      poolId: pool.poolId,
      token0: {
        address: token0?.address || '',
        symbol: token0?.symbol || '',
        name: token0?.name || '',
      },
      token1: {
        address: token1?.address || '',
        symbol: token1?.symbol || '',
        name: token1?.name || '',
      },
      feeTier: pool.feeTier,
      tvlUsd: pool.tvlUsd || '0',
      volume24h: pool.volume24hUsd || '0',
      fees24h: pool.fees24hUsd || '0',
      apr24h: pool.apr24h || '0',
    }));

    const result = { pools: poolsData };

    // Cache for 2 minutes
    await cache.set(cacheKey, result, 120);

    return reply.send({
      success: true,
      data: result,
    });
  } catch (error) {
    request.log.error(error, 'Failed to fetch top pools');
    return reply.code(500).send({
      success: false,
      error: 'Failed to fetch top pools',
    });
  }
}

/**
 * Get top tokens
 */
export async function getTopTokensHandler(
  request: FastifyRequest<{
    Querystring: GetTopTokensQuerystring;
  }>,
  reply: FastifyReply
) {
  const { chainId, orderBy, limit } = request.query;

  try {
    // Check cache
    const cache = new CacheService(request.server.redis);
    const cacheKey = `analytics:${chainId}:top-tokens:${orderBy}:${limit}`;
    const cached = await cache.get(cacheKey);

    if (cached) {
      return reply.send({
        success: true,
        data: cached,
      });
    }

    // Determine sort column
    let sortColumn;
    switch (orderBy) {
      case 'volume24h':
        sortColumn = tokens.volume24hUsd;
        break;
      case 'tvl':
        sortColumn = tokens.tvlUsd;
        break;
      case 'priceChange24h':
        sortColumn = tokens.priceChange24h;
        break;
    }

    // Fetch top tokens
    const topTokens = await request.server.db
      .select()
      .from(tokens)
      .where(eq(tokens.chainId, chainId))
      .orderBy(desc(sortColumn))
      .limit(limit);

    const tokensData = topTokens.map((token) => ({
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      priceUsd: token.priceUsd || '0',
      priceChange24h: token.priceChange24h || '0',
      volume24h: token.volume24hUsd || '0',
      tvl: token.tvlUsd || '0',
    }));

    const result = { tokens: tokensData };

    // Cache for 2 minutes
    await cache.set(cacheKey, result, 120);

    return reply.send({
      success: true,
      data: result,
    });
  } catch (error) {
    request.log.error(error, 'Failed to fetch top tokens');
    return reply.code(500).send({
      success: false,
      error: 'Failed to fetch top tokens',
    });
  }
}

/**
 * Get trending pools (by volume change)
 */
export async function getTrendingPoolsHandler(
  request: FastifyRequest<{
    Querystring: GetTrendingPoolsQuerystring;
  }>,
  reply: FastifyReply
) {
  const { chainId, limit } = request.query;

  try {
    // Check cache
    const cache = new CacheService(request.server.redis);
    const cacheKey = `analytics:${chainId}:trending-pools:${limit}`;
    const cached = await cache.get(cacheKey);

    if (cached) {
      return reply.send({
        success: true,
        data: cached,
      });
    }

    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Get pools with volume comparison
    const trendingData = await request.server.db
      .select({
        pool: pools,
        token0: tokens,
        token1: tokens,
        todayVolume: sql<string>`COALESCE((
          SELECT ${poolDayData.volumeUsd}
          FROM ${poolDayData}
          WHERE ${poolDayData.poolId} = ${pools.id}
          AND ${poolDayData.dayStart} = ${todayStr}
        ), '0')`,
        yesterdayVolume: sql<string>`COALESCE((
          SELECT ${poolDayData.volumeUsd}
          FROM ${poolDayData}
          WHERE ${poolDayData.poolId} = ${pools.id}
          AND ${poolDayData.dayStart} = ${yesterdayStr}
        ), '0')`,
      })
      .from(pools)
      .leftJoin(tokens, eq(pools.token0Id, tokens.id))
      .leftJoin(tokens, eq(pools.token1Id, tokens.id))
      .where(eq(pools.chainId, chainId))
      .orderBy(desc(pools.volume24hUsd))
      .limit(limit * 2); // Get more to filter

    // Calculate volume changes and filter
    const trendingPools = trendingData
      .map(({ pool, token0, token1, todayVolume, yesterdayVolume }) => {
        const today = parseFloat(todayVolume || '0');
        const yesterday = parseFloat(yesterdayVolume || '0');
        const volumeChange = yesterday > 0 ? ((today - yesterday) / yesterday) * 100 : 0;

        return {
          poolId: pool.poolId,
          token0: {
            address: token0?.address || '',
            symbol: token0?.symbol || '',
          },
          token1: {
            address: token1?.address || '',
            symbol: token1?.symbol || '',
          },
          feeTier: pool.feeTier,
          volume24h: pool.volume24hUsd || '0',
          volumeChange: volumeChange.toFixed(2),
          priceChange: '0', // Would need historical price data
        };
      })
      .sort((a, b) => parseFloat(b.volumeChange) - parseFloat(a.volumeChange))
      .slice(0, limit);

    const result = { pools: trendingPools };

    // Cache for 5 minutes
    await cache.set(cacheKey, result, 300);

    return reply.send({
      success: true,
      data: result,
    });
  } catch (error) {
    request.log.error(error, 'Failed to fetch trending pools');
    return reply.code(500).send({
      success: false,
      error: 'Failed to fetch trending pools',
    });
  }
}
