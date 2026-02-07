import type { FastifyRequest, FastifyReply } from 'fastify';
import type {
  GetPoolOHLCVParams,
  GetPoolOHLCVQuerystring,
  GetPoolTVLHistoryParams,
  GetPoolTVLHistoryQuerystring,
  GetPoolVolumeHistoryParams,
  GetPoolVolumeHistoryQuerystring,
  GetPoolFeesHistoryParams,
  GetPoolFeesHistoryQuerystring,
  TimeInterval,
} from '../schemas/charts.schema.js';
// NOTE: Do NOT import `db` directly from '../../db/index.js' here.
// In production mode (MOCK_MODE=false) we use request.server.db which is
// the real Drizzle client. In mock mode it is the MockDB stub. Importing
// the module-level `db` directly would bypass the mock system and also
// trigger a PostgreSQL pool creation at import time even in mock mode.
import { pools, poolHourData, poolDayData } from '../../db/schema/pools.js';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { CacheService } from '../../cache/index.js';

/**
 * Convert Date to ISO date string (YYYY-MM-DD)
 */
function toDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Calculate time range based on interval
 */
function calculateTimeRange(
  interval: TimeInterval,
  from?: number,
  to?: number
): { fromTime: Date; toTime: Date } {
  const now = to ? new Date(to * 1000) : new Date();
  const toTime = now;

  let fromTime: Date;
  if (from) {
    fromTime = new Date(from * 1000);
  } else {
    // Default lookback based on interval
    const lookbackHours: Record<TimeInterval, number> = {
      '1h': 24 * 7, // 7 days
      '4h': 24 * 30, // 30 days
      '1d': 24 * 90, // 90 days
      '1w': 24 * 365, // 1 year
      '1m': 24 * 365 * 2, // 2 years
    };

    fromTime = new Date(now.getTime() - lookbackHours[interval] * 60 * 60 * 1000);
  }

  return { fromTime, toTime };
}

/**
 * Get pool OHLCV data
 */
export async function getPoolOHLCVHandler(
  request: FastifyRequest<{
    Params: GetPoolOHLCVParams;
    Querystring: GetPoolOHLCVQuerystring;
  }>,
  reply: FastifyReply
) {
  const { poolId } = request.params;
  const { chainId, interval, from, to, limit } = request.query;

  try {
    // Check cache
    const cache = new CacheService(request.server.redis);
    const cacheKey = `chart:ohlcv:${chainId}:${poolId}:${interval}:${from || 'default'}:${to || 'now'}:${limit}`;
    const cached = await cache.get(cacheKey);

    if (cached) {
      return reply.send({
        success: true,
        data: cached,
      });
    }

    // Get pool from database
    const poolData = await request.server.db
      .select()
      .from(pools)
      .where(and(eq(pools.poolId, poolId as `0x${string}`), eq(pools.chainId, chainId)))
      .limit(1);

    if (poolData.length === 0) {
      return reply.code(404).send({
        success: false,
        error: 'Pool not found',
      });
    }

    const pool = poolData[0];
    const { fromTime, toTime } = calculateTimeRange(interval, from, to);

    // Choose the right table based on interval
    let candles: any[] = [];

    if (interval === '1h' || interval === '4h') {
      // Use hourly data
      const hourlyData = await request.server.db
        .select()
        .from(poolHourData)
        .where(
          and(
            eq(poolHourData.poolId, pool.id),
            gte(poolHourData.hourStart, fromTime),
            lte(poolHourData.hourStart, toTime)
          )
        )
        .orderBy(desc(poolHourData.hourStart))
        .limit(limit);

      // Aggregate for 4h if needed
      if (interval === '4h') {
        // Group by 4-hour periods
        const grouped = new Map<number, any[]>();
        hourlyData.forEach((data) => {
          const timestamp = Math.floor(new Date(data.hourStart).getTime() / 1000);
          const periodStart = Math.floor(timestamp / (4 * 3600)) * (4 * 3600);
          if (!grouped.has(periodStart)) {
            grouped.set(periodStart, []);
          }
          grouped.get(periodStart)!.push(data);
        });

        candles = Array.from(grouped.entries()).map(([timestamp, periodData]) => {
          const sortedData = periodData.sort(
            (a, b) => new Date(a.hourStart).getTime() - new Date(b.hourStart).getTime()
          );
          return {
            timestamp,
            open: sortedData[0].openPrice || '0',
            high: Math.max(...sortedData.map((d) => parseFloat(d.highPrice || '0'))).toString(),
            low: Math.min(
              ...sortedData.map((d) => parseFloat(d.lowPrice || '0')).filter((v) => v > 0)
            ).toString(),
            close: sortedData[sortedData.length - 1].closePrice || '0',
            volume: sortedData
              .reduce((sum, d) => sum + parseFloat(d.volumeToken0 || '0'), 0)
              .toString(),
            volumeUsd: sortedData
              .reduce((sum, d) => sum + parseFloat(d.volumeUsd || '0'), 0)
              .toString(),
            txCount: sortedData.reduce((sum, d) => sum + (d.txCount || 0), 0),
          };
        });
      } else {
        candles = hourlyData.map((data) => ({
          timestamp: Math.floor(new Date(data.hourStart).getTime() / 1000),
          open: data.openPrice || '0',
          high: data.highPrice || '0',
          low: data.lowPrice || '0',
          close: data.closePrice || '0',
          volume: data.volumeToken0 || '0',
          volumeUsd: data.volumeUsd || '0',
          txCount: data.txCount || 0,
        }));
      }
    } else {
      // Use daily data for 1d, 1w, 1m
      const dailyData = await request.server.db
        .select()
        .from(poolDayData)
        .where(
          and(
            eq(poolDayData.poolId, pool.id),
            gte(poolDayData.dayStart, toDateString(fromTime)),
            lte(poolDayData.dayStart, toDateString(toTime))
          )
        )
        .orderBy(desc(poolDayData.dayStart))
        .limit(limit);

      if (interval === '1w' || interval === '1m') {
        // Aggregate for weekly/monthly
        const periodDays = interval === '1w' ? 7 : 30;
        const grouped = new Map<number, any[]>();

        dailyData.forEach((data) => {
          const timestamp = Math.floor(new Date(data.dayStart).getTime() / 1000);
          const periodStart = Math.floor(timestamp / (periodDays * 86400)) * (periodDays * 86400);
          if (!grouped.has(periodStart)) {
            grouped.set(periodStart, []);
          }
          grouped.get(periodStart)!.push(data);
        });

        candles = Array.from(grouped.entries()).map(([timestamp, periodData]) => {
          const sortedData = periodData.sort(
            (a, b) => new Date(a.dayStart).getTime() - new Date(b.dayStart).getTime()
          );
          return {
            timestamp,
            open: sortedData[0].openPrice || '0',
            high: Math.max(...sortedData.map((d) => parseFloat(d.highPrice || '0'))).toString(),
            low: Math.min(
              ...sortedData.map((d) => parseFloat(d.lowPrice || '0')).filter((v) => v > 0)
            ).toString(),
            close: sortedData[sortedData.length - 1].closePrice || '0',
            volume: sortedData
              .reduce((sum, d) => sum + parseFloat(d.volumeToken0 || '0'), 0)
              .toString(),
            volumeUsd: sortedData
              .reduce((sum, d) => sum + parseFloat(d.volumeUsd || '0'), 0)
              .toString(),
            txCount: sortedData.reduce((sum, d) => sum + (d.txCount || 0), 0),
          };
        });
      } else {
        candles = dailyData.map((data) => ({
          timestamp: Math.floor(new Date(data.dayStart).getTime() / 1000),
          open: data.openPrice || '0',
          high: data.highPrice || '0',
          low: data.lowPrice || '0',
          close: data.closePrice || '0',
          volume: data.volumeToken0 || '0',
          volumeUsd: data.volumeUsd || '0',
          txCount: data.txCount || 0,
        }));
      }
    }

    // Sort by timestamp ascending
    candles.sort((a, b) => a.timestamp - b.timestamp);

    const result = {
      interval,
      candles,
    };

    // Cache for 1 minute
    await cache.set(cacheKey, result, 60);

    return reply.send({
      success: true,
      data: result,
    });
  } catch (error) {
    request.log.error(error, 'Failed to fetch pool OHLCV data');
    return reply.code(500).send({
      success: false,
      error: 'Failed to fetch pool OHLCV data',
    });
  }
}

/**
 * Get pool TVL history
 */
export async function getPoolTVLHistoryHandler(
  request: FastifyRequest<{
    Params: GetPoolTVLHistoryParams;
    Querystring: GetPoolTVLHistoryQuerystring;
  }>,
  reply: FastifyReply
) {
  const { poolId } = request.params;
  const { chainId, interval, from, to, limit } = request.query;

  try {
    // Check cache
    const cache = new CacheService(request.server.redis);
    const cacheKey = `chart:tvl:${chainId}:${poolId}:${interval}:${from || 'default'}:${to || 'now'}:${limit}`;
    const cached = await cache.get(cacheKey);

    if (cached) {
      return reply.send({
        success: true,
        data: cached,
      });
    }

    // Get pool from database
    const poolData = await request.server.db
      .select()
      .from(pools)
      .where(and(eq(pools.poolId, poolId as `0x${string}`), eq(pools.chainId, chainId)))
      .limit(1);

    if (poolData.length === 0) {
      return reply.code(404).send({
        success: false,
        error: 'Pool not found',
      });
    }

    const pool = poolData[0];
    const { fromTime, toTime } = calculateTimeRange(interval, from, to);

    let history: any[] = [];

    if (interval === '1h' || interval === '4h') {
      const hourlyData = await request.server.db
        .select()
        .from(poolHourData)
        .where(
          and(
            eq(poolHourData.poolId, pool.id),
            gte(poolHourData.hourStart, fromTime),
            lte(poolHourData.hourStart, toTime)
          )
        )
        .orderBy(desc(poolHourData.hourStart))
        .limit(limit);

      if (interval === '4h') {
        // Aggregate for 4-hour periods
        const grouped = new Map<number, any[]>();
        hourlyData.forEach((data) => {
          const timestamp = Math.floor(new Date(data.hourStart).getTime() / 1000);
          const periodStart = Math.floor(timestamp / (4 * 3600)) * (4 * 3600);
          if (!grouped.has(periodStart)) {
            grouped.set(periodStart, []);
          }
          grouped.get(periodStart)!.push(data);
        });

        history = Array.from(grouped.entries()).map(([timestamp, periodData]) => {
          // Take the last value in the period
          const lastData = periodData.sort(
            (a, b) => new Date(b.hourStart).getTime() - new Date(a.hourStart).getTime()
          )[0];
          return {
            timestamp,
            tvlUsd: lastData.tvlUsd || '0',
            tvlToken0: '0', // Not available in hour data
            tvlToken1: '0',
          };
        });
      } else {
        history = hourlyData.map((data) => ({
          timestamp: Math.floor(new Date(data.hourStart).getTime() / 1000),
          tvlUsd: data.tvlUsd || '0',
          tvlToken0: '0',
          tvlToken1: '0',
        }));
      }
    } else {
      const dailyData = await request.server.db
        .select()
        .from(poolDayData)
        .where(
          and(
            eq(poolDayData.poolId, pool.id),
            gte(poolDayData.dayStart, toDateString(fromTime)),
            lte(poolDayData.dayStart, toDateString(toTime))
          )
        )
        .orderBy(desc(poolDayData.dayStart))
        .limit(limit);

      if (interval === '1w' || interval === '1m') {
        const periodDays = interval === '1w' ? 7 : 30;
        const grouped = new Map<number, any[]>();

        dailyData.forEach((data) => {
          const timestamp = Math.floor(new Date(data.dayStart).getTime() / 1000);
          const periodStart = Math.floor(timestamp / (periodDays * 86400)) * (periodDays * 86400);
          if (!grouped.has(periodStart)) {
            grouped.set(periodStart, []);
          }
          grouped.get(periodStart)!.push(data);
        });

        history = Array.from(grouped.entries()).map(([timestamp, periodData]) => {
          const lastData = periodData.sort(
            (a, b) => new Date(b.dayStart).getTime() - new Date(a.dayStart).getTime()
          )[0];
          return {
            timestamp,
            tvlUsd: lastData.tvlUsd || '0',
            tvlToken0: '0',
            tvlToken1: '0',
          };
        });
      } else {
        history = dailyData.map((data) => ({
          timestamp: Math.floor(new Date(data.dayStart).getTime() / 1000),
          tvlUsd: data.tvlUsd || '0',
          tvlToken0: '0',
          tvlToken1: '0',
        }));
      }
    }

    // Sort by timestamp ascending
    history.sort((a, b) => a.timestamp - b.timestamp);

    const result = {
      interval,
      history,
    };

    // Cache for 1 minute
    await cache.set(cacheKey, result, 60);

    return reply.send({
      success: true,
      data: result,
    });
  } catch (error) {
    request.log.error(error, 'Failed to fetch pool TVL history');
    return reply.code(500).send({
      success: false,
      error: 'Failed to fetch pool TVL history',
    });
  }
}

/**
 * Get pool volume history
 */
export async function getPoolVolumeHistoryHandler(
  request: FastifyRequest<{
    Params: GetPoolVolumeHistoryParams;
    Querystring: GetPoolVolumeHistoryQuerystring;
  }>,
  reply: FastifyReply
) {
  const { poolId } = request.params;
  const { chainId, interval, from, to, limit } = request.query;

  try {
    // Check cache
    const cache = new CacheService(request.server.redis);
    const cacheKey = `chart:volume:${chainId}:${poolId}:${interval}:${from || 'default'}:${to || 'now'}:${limit}`;
    const cached = await cache.get(cacheKey);

    if (cached) {
      return reply.send({
        success: true,
        data: cached,
      });
    }

    // Get pool from database
    const poolData = await request.server.db
      .select()
      .from(pools)
      .where(and(eq(pools.poolId, poolId as `0x${string}`), eq(pools.chainId, chainId)))
      .limit(1);

    if (poolData.length === 0) {
      return reply.code(404).send({
        success: false,
        error: 'Pool not found',
      });
    }

    const pool = poolData[0];
    const { fromTime, toTime } = calculateTimeRange(interval, from, to);

    let history: any[] = [];

    if (interval === '1h' || interval === '4h') {
      const hourlyData = await request.server.db
        .select()
        .from(poolHourData)
        .where(
          and(
            eq(poolHourData.poolId, pool.id),
            gte(poolHourData.hourStart, fromTime),
            lte(poolHourData.hourStart, toTime)
          )
        )
        .orderBy(desc(poolHourData.hourStart))
        .limit(limit);

      if (interval === '4h') {
        const grouped = new Map<number, any[]>();
        hourlyData.forEach((data) => {
          const timestamp = Math.floor(new Date(data.hourStart).getTime() / 1000);
          const periodStart = Math.floor(timestamp / (4 * 3600)) * (4 * 3600);
          if (!grouped.has(periodStart)) {
            grouped.set(periodStart, []);
          }
          grouped.get(periodStart)!.push(data);
        });

        history = Array.from(grouped.entries()).map(([timestamp, periodData]) => ({
          timestamp,
          volumeUsd: periodData
            .reduce((sum, d) => sum + parseFloat(d.volumeUsd || '0'), 0)
            .toString(),
          volumeToken0: periodData
            .reduce((sum, d) => sum + parseFloat(d.volumeToken0 || '0'), 0)
            .toString(),
          volumeToken1: periodData
            .reduce((sum, d) => sum + parseFloat(d.volumeToken1 || '0'), 0)
            .toString(),
          feesUsd: periodData.reduce((sum, d) => sum + parseFloat(d.feesUsd || '0'), 0).toString(),
          txCount: periodData.reduce((sum, d) => sum + (d.txCount || 0), 0),
        }));
      } else {
        history = hourlyData.map((data) => ({
          timestamp: Math.floor(new Date(data.hourStart).getTime() / 1000),
          volumeUsd: data.volumeUsd || '0',
          volumeToken0: data.volumeToken0 || '0',
          volumeToken1: data.volumeToken1 || '0',
          feesUsd: data.feesUsd || '0',
          txCount: data.txCount || 0,
        }));
      }
    } else {
      const dailyData = await request.server.db
        .select()
        .from(poolDayData)
        .where(
          and(
            eq(poolDayData.poolId, pool.id),
            gte(poolDayData.dayStart, toDateString(fromTime)),
            lte(poolDayData.dayStart, toDateString(toTime))
          )
        )
        .orderBy(desc(poolDayData.dayStart))
        .limit(limit);

      if (interval === '1w' || interval === '1m') {
        const periodDays = interval === '1w' ? 7 : 30;
        const grouped = new Map<number, any[]>();

        dailyData.forEach((data) => {
          const timestamp = Math.floor(new Date(data.dayStart).getTime() / 1000);
          const periodStart = Math.floor(timestamp / (periodDays * 86400)) * (periodDays * 86400);
          if (!grouped.has(periodStart)) {
            grouped.set(periodStart, []);
          }
          grouped.get(periodStart)!.push(data);
        });

        history = Array.from(grouped.entries()).map(([timestamp, periodData]) => ({
          timestamp,
          volumeUsd: periodData
            .reduce((sum, d) => sum + parseFloat(d.volumeUsd || '0'), 0)
            .toString(),
          volumeToken0: '0',
          volumeToken1: '0',
          feesUsd: periodData.reduce((sum, d) => sum + parseFloat(d.feesUsd || '0'), 0).toString(),
          txCount: periodData.reduce((sum, d) => sum + (d.txCount || 0), 0),
        }));
      } else {
        history = dailyData.map((data) => ({
          timestamp: Math.floor(new Date(data.dayStart).getTime() / 1000),
          volumeUsd: data.volumeUsd || '0',
          volumeToken0: '0',
          volumeToken1: '0',
          feesUsd: data.feesUsd || '0',
          txCount: data.txCount || 0,
        }));
      }
    }

    // Sort by timestamp ascending
    history.sort((a, b) => a.timestamp - b.timestamp);

    const result = {
      interval,
      history,
    };

    // Cache for 1 minute
    await cache.set(cacheKey, result, 60);

    return reply.send({
      success: true,
      data: result,
    });
  } catch (error) {
    request.log.error(error, 'Failed to fetch pool volume history');
    return reply.code(500).send({
      success: false,
      error: 'Failed to fetch pool volume history',
    });
  }
}

/**
 * Get pool fees history
 */
export async function getPoolFeesHistoryHandler(
  request: FastifyRequest<{
    Params: GetPoolFeesHistoryParams;
    Querystring: GetPoolFeesHistoryQuerystring;
  }>,
  reply: FastifyReply
) {
  const { poolId } = request.params;
  const { chainId, interval, from, to, limit } = request.query;

  try {
    // Check cache
    const cache = new CacheService(request.server.redis);
    const cacheKey = `chart:fees:${chainId}:${poolId}:${interval}:${from || 'default'}:${to || 'now'}:${limit}`;
    const cached = await cache.get(cacheKey);

    if (cached) {
      return reply.send({
        success: true,
        data: cached,
      });
    }

    // Get pool from database
    const poolData = await request.server.db
      .select()
      .from(pools)
      .where(and(eq(pools.poolId, poolId as `0x${string}`), eq(pools.chainId, chainId)))
      .limit(1);

    if (poolData.length === 0) {
      return reply.code(404).send({
        success: false,
        error: 'Pool not found',
      });
    }

    const pool = poolData[0];
    const { fromTime, toTime } = calculateTimeRange(interval, from, to);

    let history: any[] = [];

    if (interval === '1h' || interval === '4h') {
      const hourlyData = await request.server.db
        .select()
        .from(poolHourData)
        .where(
          and(
            eq(poolHourData.poolId, pool.id),
            gte(poolHourData.hourStart, fromTime),
            lte(poolHourData.hourStart, toTime)
          )
        )
        .orderBy(desc(poolHourData.hourStart))
        .limit(limit);

      if (interval === '4h') {
        const grouped = new Map<number, any[]>();
        hourlyData.forEach((data) => {
          const timestamp = Math.floor(new Date(data.hourStart).getTime() / 1000);
          const periodStart = Math.floor(timestamp / (4 * 3600)) * (4 * 3600);
          if (!grouped.has(periodStart)) {
            grouped.set(periodStart, []);
          }
          grouped.get(periodStart)!.push(data);
        });

        history = Array.from(grouped.entries()).map(([timestamp, periodData]) => {
          const totalFees = periodData.reduce((sum, d) => sum + parseFloat(d.feesUsd || '0'), 0);
          const avgTvl =
            periodData.reduce((sum, d) => sum + parseFloat(d.tvlUsd || '0'), 0) /
            periodData.length;
          const apr = avgTvl > 0 ? ((totalFees * 365 * 24) / 4 / avgTvl) * 100 : 0;

          return {
            timestamp,
            feesUsd: totalFees.toString(),
            feesToken0: '0',
            feesToken1: '0',
            apr,
          };
        });
      } else {
        history = hourlyData.map((data) => {
          const feesUsd = parseFloat(data.feesUsd || '0');
          const tvlUsd = parseFloat(data.tvlUsd || '0');
          const apr = tvlUsd > 0 ? ((feesUsd * 365 * 24) / tvlUsd) * 100 : 0;

          return {
            timestamp: Math.floor(new Date(data.hourStart).getTime() / 1000),
            feesUsd: data.feesUsd || '0',
            feesToken0: '0',
            feesToken1: '0',
            apr,
          };
        });
      }
    } else {
      const dailyData = await request.server.db
        .select()
        .from(poolDayData)
        .where(
          and(
            eq(poolDayData.poolId, pool.id),
            gte(poolDayData.dayStart, toDateString(fromTime)),
            lte(poolDayData.dayStart, toDateString(toTime))
          )
        )
        .orderBy(desc(poolDayData.dayStart))
        .limit(limit);

      if (interval === '1w' || interval === '1m') {
        const periodDays = interval === '1w' ? 7 : 30;
        const grouped = new Map<number, any[]>();

        dailyData.forEach((data) => {
          const timestamp = Math.floor(new Date(data.dayStart).getTime() / 1000);
          const periodStart = Math.floor(timestamp / (periodDays * 86400)) * (periodDays * 86400);
          if (!grouped.has(periodStart)) {
            grouped.set(periodStart, []);
          }
          grouped.get(periodStart)!.push(data);
        });

        history = Array.from(grouped.entries()).map(([timestamp, periodData]) => {
          const totalFees = periodData.reduce((sum, d) => sum + parseFloat(d.feesUsd || '0'), 0);
          const avgTvl =
            periodData.reduce((sum, d) => sum + parseFloat(d.tvlUsd || '0'), 0) /
            periodData.length;
          const apr = avgTvl > 0 ? ((totalFees * 365) / periodDays / avgTvl) * 100 : 0;

          return {
            timestamp,
            feesUsd: totalFees.toString(),
            feesToken0: '0',
            feesToken1: '0',
            apr,
          };
        });
      } else {
        history = dailyData.map((data) => {
          const feesUsd = parseFloat(data.feesUsd || '0');
          const tvlUsd = parseFloat(data.tvlUsd || '0');
          const apr = tvlUsd > 0 ? ((feesUsd * 365) / tvlUsd) * 100 : 0;

          return {
            timestamp: Math.floor(new Date(data.dayStart).getTime() / 1000),
            feesUsd: data.feesUsd || '0',
            feesToken0: '0',
            feesToken1: '0',
            apr,
          };
        });
      }
    }

    // Sort by timestamp ascending
    history.sort((a, b) => a.timestamp - b.timestamp);

    const result = {
      interval,
      history,
    };

    // Cache for 1 minute
    await cache.set(cacheKey, result, 60);

    return reply.send({
      success: true,
      data: result,
    });
  } catch (error) {
    request.log.error(error, 'Failed to fetch pool fees history');
    return reply.code(500).send({
      success: false,
      error: 'Failed to fetch pool fees history',
    });
  }
}
