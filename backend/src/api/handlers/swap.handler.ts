import type { FastifyReply, FastifyRequest, FastifyInstance } from 'fastify';
import { eq, and, or } from 'drizzle-orm';
import { pools, tokens } from '../../db/schema/index.js';
import type { GetQuoteRequest, GetQuoteResponse, RouteHop } from '../schemas/swap.schema.js';
import {
  quoteExactInputSingle,
  createPoolKey,
  calculateSqrtPriceLimit,
} from '../../blockchain/contracts/quoter.js';
import { getPoolState } from '../../blockchain/contracts/poolManager.js';
import { calculatePriceImpact } from '../../services/priceImpact.js';
import { CacheService } from '../../cache/index.js';
import { CacheKeys, CacheTTL } from '../../cache/keys.js';
import { getBlockchainClient } from '../../blockchain/client.js';
import { getChainlinkPriceFeedService } from '../../services/chainlinkPriceFeed.js';
import type { Address } from 'viem';

// WETH address on Base for ETH price lookups
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';

// Default gas price for Base L2 in wei (0.001 gwei = 1_000_000 wei).
// Used as a fallback when the RPC gas price call fails.
const DEFAULT_BASE_GAS_PRICE = 1_000_000n;

/**
 * Calculate the estimated gas cost in USD.
 *
 * Formula: gasEstimateUsd = gasUnits * gasPriceWei * ethPriceUsd / 1e18
 *
 * Returns undefined when the price cannot be determined so the caller can
 * degrade gracefully rather than failing the entire quote.
 */
async function calculateGasEstimateUsd(
  chainId: number,
  gasEstimate: bigint,
  logger: { warn: Function },
): Promise<number | undefined> {
  try {
    // 1. Get current gas price from the chain (returns wei)
    let gasPrice: bigint;
    try {
      const client = getBlockchainClient(chainId);
      gasPrice = await client.getGasPrice();
    } catch {
      // Base L2 typically has very low gas prices; use a safe default
      gasPrice = DEFAULT_BASE_GAS_PRICE;
    }

    // 2. Get ETH/USD price via Chainlink service
    const priceFeedService = getChainlinkPriceFeedService();
    const ethPriceResult = await priceFeedService.getPrice(WETH_ADDRESS);
    const ethPriceUsd = parseFloat(ethPriceResult.priceUsd);

    if (ethPriceUsd <= 0) {
      return undefined;
    }

    // 3. Calculate: gasCostWei = gasEstimate * gasPrice (in wei)
    //    Convert wei to ETH by dividing by 1e18, then multiply by ETH price
    const gasCostWei = gasEstimate * gasPrice;
    const gasCostEth = Number(gasCostWei) / 1e18;
    const gasCostUsd = gasCostEth * ethPriceUsd;

    // Round to 6 decimal places to avoid floating point noise
    return Math.round(gasCostUsd * 1e6) / 1e6;
  } catch (error) {
    logger.warn(
      `Failed to calculate gasEstimateUsd: ${error instanceof Error ? error.message : String(error)}`
    );
    return undefined;
  }
}

export class SwapHandler {
  private cache: CacheService;

  constructor(private fastify: FastifyInstance) {
    this.cache = new CacheService(fastify.redis);
  }

  getQuote = async (
    request: FastifyRequest<{ Querystring: GetQuoteRequest }>,
    reply: FastifyReply
  ) => {
    const { chainId, tokenIn, tokenOut, amountIn, slippage } = request.query;

    try {
      // Check cache first
      const cacheKey = CacheKeys.quote(chainId, tokenIn, tokenOut, amountIn);
      const cached = await this.cache.get<GetQuoteResponse>(cacheKey);

      if (cached) {
        return reply.send({ ...cached, cached: true });
      }

      // Get tokens from database
      const [tokenInData] = await this.fastify.db
        .select()
        .from(tokens)
        .where(and(eq(tokens.address, tokenIn.toLowerCase()), eq(tokens.chainId, chainId)))
        .limit(1);

      const [tokenOutData] = await this.fastify.db
        .select()
        .from(tokens)
        .where(and(eq(tokens.address, tokenOut.toLowerCase()), eq(tokens.chainId, chainId)))
        .limit(1);

      if (!tokenInData || !tokenOutData) {
        return reply.status(404).send({ error: 'Token not found' });
      }

      // Find best pool for this pair
      const availablePools = await this.fastify.db
        .select()
        .from(pools)
        .where(
          and(
            eq(pools.chainId, chainId),
            or(
              and(eq(pools.token0Id, tokenInData.id), eq(pools.token1Id, tokenOutData.id)),
              and(eq(pools.token0Id, tokenOutData.id), eq(pools.token1Id, tokenInData.id))
            )
          )
        )
        .orderBy((pools) => pools.tvlUsd);

      if (availablePools.length === 0) {
        return reply.status(404).send({ error: 'No pool found for this pair' });
      }

      // Use the pool with highest TVL
      const bestPool = availablePools[0];

      // Get fresh on-chain pool state
      const poolState = await getPoolState(chainId, bestPool.poolId as `0x${string}`);

      // Determine swap direction
      const zeroForOne = bestPool.token0Id === tokenInData.id;

      // Create pool key
      const poolKey = createPoolKey(
        tokenInData.address as Address,
        tokenOutData.address as Address,
        bestPool.feeTier,
        bestPool.tickSpacing,
        bestPool.hookAddress as Address | undefined
      );

      // Get quote from Quoter contract
      const quoteResult = await quoteExactInputSingle(chainId, {
        poolKey,
        zeroForOne,
        exactAmount: BigInt(amountIn),
        sqrtPriceLimitX96: calculateSqrtPriceLimit(
          zeroForOne,
          poolState.sqrtPriceX96,
          Math.floor(slippage * 100) // Convert percentage to bps (0.5% -> 50 bps)
        ),
        hookData: '0x',
      });

      // Calculate amount out with slippage
      const amountOutMin = (quoteResult.amountOut * BigInt(10000 - Math.floor(slippage * 100))) / 10000n;

      // Calculate execution price
      const amountInDecimal = Number(amountIn) / 10 ** tokenInData.decimals;
      const amountOutDecimal = Number(quoteResult.amountOut) / 10 ** tokenOutData.decimals;
      const executionPrice = amountOutDecimal / amountInDecimal;

      // Calculate real price impact from pool state and swap result
      const impactResult = calculatePriceImpact({
        sqrtPriceX96Before: poolState.sqrtPriceX96,
        amountIn: BigInt(amountIn),
        amountOut: quoteResult.amountOut,
        tokenInDecimals: tokenInData.decimals,
        tokenOutDecimals: tokenOutData.decimals,
        zeroForOne,
      });
      const priceImpact = impactResult.priceImpact;
      const priceImpactWarning = impactResult.warning;

      // Build route hop
      const routeHop: RouteHop = {
        poolId: bestPool.poolId,
        tokenIn: tokenInData.address as Address,
        tokenOut: tokenOutData.address as Address,
        fee: bestPool.feeTier,
        sqrtPriceX96: poolState.sqrtPriceX96.toString(),
        tick: poolState.tick,
        liquidity: poolState.liquidity.toString(),
      };

      // Calculate gas cost in USD
      const gasEstimateUsd = await calculateGasEstimateUsd(
        chainId,
        quoteResult.gasEstimate,
        request.log,
      );

      // Build response
      const response: GetQuoteResponse = {
        tokenIn: tokenInData.address as Address,
        tokenOut: tokenOutData.address as Address,
        amountIn,
        amountOut: quoteResult.amountOut.toString(),
        amountOutMin: amountOutMin.toString(),

        route: [routeHop],
        routeString: `${tokenInData.symbol} → ${tokenOutData.symbol}`,

        executionPrice: `${executionPrice.toFixed(6)} ${tokenOutData.symbol} per ${tokenInData.symbol}`,
        priceImpact,
        priceImpactWarning,

        gasEstimate: Number(quoteResult.gasEstimate),
        gasEstimateUsd,

        timestamp: Date.now(),
        cached: false,
      };

      // Cache the response
      await this.cache.set(cacheKey, response, CacheTTL.quote);

      return reply.send(response);
    } catch (error) {
      request.log.error(error, 'Failed to get quote');

      // Check if it's a contract revert
      if (error instanceof Error) {
        if (error.message.includes('revert') || error.message.includes('execution reverted')) {
          return reply.status(400).send({
            error: 'Quote failed',
            message: 'Insufficient liquidity or invalid swap parameters',
          });
        }
      }

      return reply.status(500).send({ error: 'Failed to get quote' });
    }
  };
}
