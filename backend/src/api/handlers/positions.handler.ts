import type { FastifyRequest, FastifyReply } from 'fastify';
import type {
  GetPositionsByAddressParams,
  GetPositionsByAddressQuerystring,
  GetPositionByIdParams,
  GetPositionByIdQuerystring,
  GetPoolTicksParams,
  GetPoolTicksQuerystring,
} from '../schemas/positions.schema.js';
import {
  getPosition,
  getPositionOwner,
  getPositionsByOwner,
} from '../../blockchain/contracts/positionManager.js';
import { getPoolState } from '../../blockchain/contracts/poolManager.js';
// NOTE: Do NOT import `db` directly from '../../db/index.js' here.
// Use request.server.db which respects the mock/real mode selection.
import { pools } from '../../db/schema/pools.js';
import { tokens } from '../../db/schema/tokens.js';
import { eq, and, inArray } from 'drizzle-orm';
import { CacheService } from '../../cache/index.js';
import { CacheKeys } from '../../cache/keys.js';
import { Address } from 'viem';

/**
 * Get positions by address
 */
export async function getPositionsByAddressHandler(
  request: FastifyRequest<{
    Params: GetPositionsByAddressParams;
    Querystring: GetPositionsByAddressQuerystring;
  }>,
  reply: FastifyReply
) {
  const { address } = request.params;
  const { chainId } = request.query;

  try {
    // Check cache first
    const cache = new CacheService(request.server.redis);
    const cacheKey = CacheKeys.userPositions(chainId, address);
    const cached = await cache.get(cacheKey);

    if (cached) {
      return reply.send({
        success: true,
        data: cached,
      });
    }

    // Get positions from blockchain
    const onChainPositions = await getPositionsByOwner(chainId, address as Address);

    if (onChainPositions.length === 0) {
      const result = { positions: [], total: 0 };
      await cache.set(cacheKey, result, 30); // Cache for 30 seconds
      return reply.send({
        success: true,
        data: result,
      });
    }

    // Fetch pool and token details from database
    const poolIds = [...new Set(onChainPositions.map((p) => p.position.poolId))];
    const poolsList = await request.server.db
      .select({
        pool: pools,
        token0: tokens,
        token1: tokens,
      })
      .from(pools)
      .leftJoin(tokens, eq(pools.token0Id, tokens.id))
      .leftJoin(tokens, eq(pools.token1Id, tokens.id))
      .where(
        and(
          eq(pools.chainId, chainId),
          inArray(pools.poolId, poolIds)
        )
      );

    // Map pool data
    const poolsMap = new Map(
      poolsList.map(({ pool, token0, token1 }) => [
        pool.poolId,
        { pool, token0, token1 },
      ])
    );

    // Build response
    const positions = onChainPositions.map(({ tokenId, position }) => {
      const poolData = poolsMap.get(position.poolId);

      return {
        tokenId: tokenId.toString(),
        poolId: position.poolId,
        pool: poolData
          ? {
              token0: {
                address: poolData.token0?.address || '',
                symbol: poolData.token0?.symbol || '',
                name: poolData.token0?.name || '',
                decimals: poolData.token0?.decimals || 18,
              },
              token1: {
                address: poolData.token1?.address || '',
                symbol: poolData.token1?.symbol || '',
                name: poolData.token1?.name || '',
                decimals: poolData.token1?.decimals || 18,
              },
              feeTier: poolData.pool?.feeTier || 0,
            }
          : null,
        tickLower: position.tickLower,
        tickUpper: position.tickUpper,
        liquidity: position.liquidity.toString(),
        tokensOwed0: position.tokensOwed0.toString(),
        tokensOwed1: position.tokensOwed1.toString(),
      };
    });

    const result = {
      positions: positions.filter((p) => p.pool !== null),
      total: positions.length,
    };

    // Cache result
    await cache.set(cacheKey, result, 30); // 30 seconds TTL

    return reply.send({
      success: true,
      data: result,
    });
  } catch (error) {
    request.log.error(error, 'Failed to fetch positions');
    return reply.code(500).send({
      success: false,
      error: 'Failed to fetch positions',
    });
  }
}

/**
 * Get position by token ID
 */
export async function getPositionByIdHandler(
  request: FastifyRequest<{
    Params: GetPositionByIdParams;
    Querystring: GetPositionByIdQuerystring;
  }>,
  reply: FastifyReply
) {
  const { tokenId } = request.params;
  const { chainId } = request.query;

  try {
    // Check cache
    const cache = new CacheService(request.server.redis);
    const cacheKey = CacheKeys.position(chainId, tokenId.toString());
    const cached = await cache.get(cacheKey);

    if (cached) {
      return reply.send({
        success: true,
        data: cached,
      });
    }

    // Get position from blockchain
    const [position, owner] = await Promise.all([
      getPosition(chainId, tokenId),
      getPositionOwner(chainId, tokenId),
    ]);

    // Get pool details from database
    const poolData = await request.server.db
      .select({
        pool: pools,
        token0: tokens,
        token1: tokens,
      })
      .from(pools)
      .leftJoin(tokens, eq(pools.token0Id, tokens.id))
      .leftJoin(tokens, eq(pools.token1Id, tokens.id))
      .where(and(eq(pools.poolId, position.poolId), eq(pools.chainId, chainId)))
      .limit(1);

    if (poolData.length === 0) {
      return reply.code(404).send({
        success: false,
        error: 'Pool not found',
      });
    }

    const { pool, token0, token1 } = poolData[0];

    // Get current pool state
    const poolState = await getPoolState(chainId, position.poolId);

    const result = {
      tokenId: tokenId.toString(),
      owner,
      poolId: position.poolId,
      pool: {
        token0: {
          address: token0?.address || '',
          symbol: token0?.symbol || '',
          name: token0?.name || '',
          decimals: token0?.decimals || 18,
        },
        token1: {
          address: token1?.address || '',
          symbol: token1?.symbol || '',
          name: token1?.name || '',
          decimals: token1?.decimals || 18,
        },
        feeTier: pool?.feeTier || 0,
        sqrtPrice: poolState.sqrtPriceX96.toString(),
        tick: poolState.tick,
      },
      tickLower: position.tickLower,
      tickUpper: position.tickUpper,
      liquidity: position.liquidity.toString(),
      feeGrowthInside0LastX128: position.feeGrowthInside0LastX128.toString(),
      feeGrowthInside1LastX128: position.feeGrowthInside1LastX128.toString(),
      tokensOwed0: position.tokensOwed0.toString(),
      tokensOwed1: position.tokensOwed1.toString(),
    };

    // Cache result
    await cache.set(cacheKey, result, 30); // 30 seconds TTL

    return reply.send({
      success: true,
      data: result,
    });
  } catch (error) {
    request.log.error(error, 'Failed to fetch position');
    return reply.code(500).send({
      success: false,
      error: 'Failed to fetch position',
    });
  }
}

/**
 * Get pool ticks (liquidity distribution)
 */
export async function getPoolTicksHandler(
  request: FastifyRequest<{
    Params: GetPoolTicksParams;
    Querystring: GetPoolTicksQuerystring;
  }>,
  reply: FastifyReply
) {
  const { poolId } = request.params;
  const { chainId, tickLower, tickUpper } = request.query;

  try {
    // Check cache
    const cache = new CacheService(request.server.redis);
    const cacheKey = CacheKeys.poolTicks(chainId, poolId);
    const cached = await cache.get<{
      ticks: Array<{ tickIdx: number; liquidityGross: string; liquidityNet: string }>;
      currentTick: number;
      tickSpacing: number;
    }>(cacheKey);

    if (cached) {
      // Filter by range if specified
      let ticks = cached.ticks;
      if (tickLower !== undefined) {
        ticks = ticks.filter((t) => t.tickIdx >= tickLower);
      }
      if (tickUpper !== undefined) {
        ticks = ticks.filter((t) => t.tickIdx <= tickUpper);
      }

      return reply.send({
        success: true,
        data: {
          ticks,
          currentTick: cached.currentTick,
          tickSpacing: cached.tickSpacing,
        },
      });
    }

    // Get pool info from database
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

    // For now, return mock tick data
    // In a real implementation, you would:
    // 1. Query tick data from The Graph subgraph
    // 2. Or maintain tick data in the database via event indexing
    // 3. Or query directly from the blockchain (expensive)

    const mockTicks = [];
    const currentTick = pool.currentTick || 0;
    const tickSpacing = pool.tickSpacing || 60;

    // Generate some mock ticks around current price
    for (let i = -10; i <= 10; i++) {
      const tickIdx = currentTick + i * tickSpacing;
      mockTicks.push({
        tickIdx,
        liquidityGross: (Math.random() * 1000000).toFixed(0),
        liquidityNet: (Math.random() * 500000 * (Math.random() > 0.5 ? 1 : -1)).toFixed(0),
      });
    }

    const result = {
      ticks: mockTicks,
      currentTick,
      tickSpacing,
    };

    // Cache for 1 minute
    await cache.set(cacheKey, result, 60);

    return reply.send({
      success: true,
      data: result,
    });
  } catch (error) {
    request.log.error(error, 'Failed to fetch pool ticks');
    return reply.code(500).send({
      success: false,
      error: 'Failed to fetch pool ticks',
    });
  }
}
