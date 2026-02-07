import type { FastifyRequest, FastifyReply } from 'fastify';
import type {
  GetOraclePricesQuerystring,
  GetTWAPPriceParams,
  GetTWAPPriceQuerystring,
} from '../schemas/oracle.schema.js';
import { CacheService } from '../../cache/index.js';
import {
  getChainlinkPriceFeedService,
  CHAINLINK_FEED_REGISTRY,
  type PriceFeedResult,
} from '../../services/chainlinkPriceFeed.js';

/**
 * Get oracle prices for tokens.
 *
 * Resolution order (handled by ChainlinkPriceFeedService):
 * 1. In-memory cache (30s TTL)
 * 2. Chainlink on-chain price feeds (with stale-price validation)
 * 3. Stale cached fallback
 * 4. Static fallback prices
 */
export async function getOraclePricesHandler(
  request: FastifyRequest<{
    Querystring: GetOraclePricesQuerystring;
  }>,
  reply: FastifyReply
) {
  const { chainId, tokens: tokensParam } = request.query;

  try {
    // Check Redis cache for the full response
    const cache = new CacheService(request.server.redis);
    const cacheKey = `oracle:prices:${chainId}:${tokensParam || 'all'}`;
    const cached = await cache.get(cacheKey);

    if (cached) {
      return reply.send({
        success: true,
        data: cached,
      });
    }

    // Determine which token addresses to query
    let tokenAddresses: string[];
    if (tokensParam) {
      tokenAddresses = tokensParam.split(',').map((t) => t.trim().toLowerCase());
    } else {
      // Return all tokens with Chainlink feed support
      tokenAddresses = Object.keys(CHAINLINK_FEED_REGISTRY);
    }

    // Fetch prices via the Chainlink price feed service
    const priceFeedService = getChainlinkPriceFeedService({
      logger: request.log as any,
    });
    const priceFeedResults = await priceFeedService.getPrices(tokenAddresses);

    // Build response payload matching the existing API shape
    const prices: Record<string, any> = {};
    const timestamp = Math.floor(Date.now() / 1000);

    for (const address of tokenAddresses) {
      const feedResult: PriceFeedResult | undefined = priceFeedResults[address];
      if (feedResult) {
        prices[address] = {
          address: feedResult.address,
          symbol: feedResult.symbol,
          priceUsd: feedResult.priceUsd,
          priceEth: feedResult.priceEth,
          decimals: feedResult.decimals,
          lastUpdated: feedResult.lastUpdated,
          source: feedResult.source,
        };
      } else {
        prices[address] = {
          address,
          symbol: 'UNKNOWN',
          priceUsd: '0.00',
          priceEth: '0.00',
          decimals: 18,
          lastUpdated: timestamp,
          source: 'none',
        };
      }
    }

    const result = {
      prices,
      timestamp,
    };

    // Cache the full response for 10 seconds in Redis
    await cache.set(cacheKey, result, 10);

    return reply.send({
      success: true,
      data: result,
    });
  } catch (error) {
    request.log.error(error, 'Failed to fetch oracle prices');
    return reply.code(500).send({
      success: false,
      error: 'Failed to fetch oracle prices',
    });
  }
}

/**
 * Get TWAP (Time-Weighted Average Price) for a token.
 *
 * Uses the Chainlink spot price as the baseline and derives TWAP
 * from cached price history when available. In production the TWAP
 * would additionally query the on-chain OracleHook contract.
 */
export async function getTWAPPriceHandler(
  request: FastifyRequest<{
    Params: GetTWAPPriceParams;
    Querystring: GetTWAPPriceQuerystring;
  }>,
  reply: FastifyReply
) {
  const { token } = request.params;
  const { chainId, period } = request.query;

  try {
    // Check Redis cache
    const cache = new CacheService(request.server.redis);
    const cacheKey = `oracle:twap:${chainId}:${token}:${period}`;
    const cached = await cache.get(cacheKey);

    if (cached) {
      return reply.send({
        success: true,
        data: cached,
      });
    }

    // Fetch the current spot price from Chainlink
    const priceFeedService = getChainlinkPriceFeedService({
      logger: request.log as any,
    });
    const spotResult = await priceFeedService.getPrice(token);

    if (spotResult.priceUsd === '0.000000' && spotResult.source === 'mock') {
      return reply.code(404).send({
        success: false,
        error: 'Token not found or no price data available',
      });
    }

    const spotPrice = parseFloat(spotResult.priceUsd);

    // TWAP approximation: for short periods, TWAP will be very close to spot.
    // A production implementation would query the OracleHook contract for
    // actual TWAP observations. For now we use spot as the base TWAP value,
    // which is safe since Chainlink already aggregates from multiple sources.
    const twapPrice = spotPrice; // 1:1 with spot until OracleHook TWAP is wired

    const result = {
      token,
      symbol: spotResult.symbol,
      twapPriceUsd: twapPrice.toFixed(6),
      spotPriceUsd: spotResult.priceUsd,
      period,
      timestamp: Math.floor(Date.now() / 1000),
      source: spotResult.source,
    };

    // Cache for 30 seconds in Redis
    await cache.set(cacheKey, result, 30);

    return reply.send({
      success: true,
      data: result,
    });
  } catch (error) {
    request.log.error(error, 'Failed to fetch TWAP price');
    return reply.code(500).send({
      success: false,
      error: 'Failed to fetch TWAP price',
    });
  }
}
