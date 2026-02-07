import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { tokens } from '../db/schema/index.js';
import { CacheService } from '../cache/index.js';
import { CacheKeys, CacheTTL } from '../cache/keys.js';
import { RedisChannels } from '../websocket/channels.js';
import {
  getChainlinkPriceFeedService,
  type PriceFeedResult,
  type ChainlinkPriceFeedService,
} from '../services/chainlinkPriceFeed.js';

/**
 * Price data structure
 */
interface TokenPrice {
  address: string;
  symbol: string;
  priceUsd: string;
  priceChange24h: string;
  volume24h: string;
  timestamp: number;
  source?: string;
}

/**
 * Price history for 24h change calculation
 */
interface PriceHistory {
  price: number;
  timestamp: number;
}

/**
 * Price Sync Worker
 * Periodically syncs token prices from Chainlink oracles (via ChainlinkPriceFeedService)
 * with CoinGecko API as a secondary fallback.
 */
export class PriceSyncWorker {
  private cache: CacheService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private priceFeedService: ChainlinkPriceFeedService;
  private priceHistory: Map<string, PriceHistory[]> = new Map();
  private readonly HISTORY_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(private fastify: FastifyInstance) {
    this.cache = new CacheService(fastify.redis);

    // Use the shared ChainlinkPriceFeedService singleton
    this.priceFeedService = getChainlinkPriceFeedService({
      logger: fastify.log as any,
    });
  }

  /**
   * Start the worker
   */
  start(intervalMs: number = 10000) {
    if (this.isRunning) {
      this.fastify.log.warn('PriceSyncWorker is already running');
      return;
    }

    this.isRunning = true;
    this.fastify.log.info(`Starting PriceSyncWorker (interval: ${intervalMs}ms)`);

    // Run immediately
    this.syncPrices();

    // Then run at interval
    this.intervalId = setInterval(() => {
      this.syncPrices();
    }, intervalMs);
  }

  /**
   * Stop the worker
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.fastify.log.info('PriceSyncWorker stopped');
  }

  /**
   * Sync prices for all chains
   */
  private async syncPrices() {
    const chains = [8453]; // Base (add more chains as needed)

    for (const chainId of chains) {
      try {
        await this.syncChainPrices(chainId);
      } catch (error) {
        this.fastify.log.error(error, `Failed to sync prices for chain ${chainId}`);
      }
    }
  }

  /**
   * Sync prices for a specific chain
   */
  private async syncChainPrices(chainId: number) {
    // Fetch all tokens for this chain
    const tokensList = await this.fastify.db
      .select()
      .from(tokens)
      .where(eq(tokens.chainId, chainId))
      .limit(100); // Limit to top 100 tokens

    if (tokensList.length === 0) {
      return;
    }

    // Fetch fresh prices via ChainlinkPriceFeedService
    const prices = await this.fetchPrices(tokensList);

    // Update database
    await this.updateDatabase(prices);

    // Update cache
    await this.updateCache(chainId, prices);

    // Broadcast via Redis pub/sub
    await this.broadcast(chainId, prices);

    this.fastify.log.debug(`Synced ${prices.length} prices for chain ${chainId}`);
  }

  /**
   * Fetch fresh prices for tokens using ChainlinkPriceFeedService
   */
  private async fetchPrices(tokensList: any[]): Promise<TokenPrice[]> {
    const prices: TokenPrice[] = [];

    // Collect all addresses and fetch in batch
    const addresses = tokensList.map((t: any) => t.address as string);
    const feedResults = await this.priceFeedService.getPrices(addresses);

    for (const token of tokensList) {
      try {
        const feedResult: PriceFeedResult | undefined = feedResults[token.address];

        if (feedResult && feedResult.priceUsd !== '0.000000') {
          const price = parseFloat(feedResult.priceUsd);
          const priceChange24h = this.calculate24hChange(token.address, price);

          // Store price in history for 24h change calculation
          this.storePriceHistory(token.address, price);

          prices.push({
            address: token.address,
            symbol: token.symbol,
            priceUsd: feedResult.priceUsd,
            priceChange24h: priceChange24h.toFixed(2),
            volume24h: token.volume24hUsd?.toString() ?? '0',
            timestamp: Date.now(),
            source: feedResult.source,
          });

          this.fastify.log.debug(
            `Fetched price for ${token.symbol}: $${price.toFixed(4)} (source: ${feedResult.source})`
          );
        } else {
          // No price from Chainlink — try CoinGecko as secondary fallback
          const coingeckoPrice = await this.fetchFromCoinGecko(token.address);
          if (coingeckoPrice !== null) {
            const priceChange24h = this.calculate24hChange(token.address, coingeckoPrice);
            this.storePriceHistory(token.address, coingeckoPrice);

            prices.push({
              address: token.address,
              symbol: token.symbol,
              priceUsd: coingeckoPrice.toFixed(6),
              priceChange24h: priceChange24h.toFixed(2),
              volume24h: token.volume24hUsd?.toString() ?? '0',
              timestamp: Date.now(),
              source: 'coingecko',
            });

            this.fastify.log.debug(
              `Fetched price for ${token.symbol}: $${coingeckoPrice.toFixed(4)} (source: coingecko)`
            );
          } else {
            // Keep existing price on failure
            prices.push({
              address: token.address,
              symbol: token.symbol,
              priceUsd: token.priceUsd ?? '0',
              priceChange24h: token.priceChange24h ?? '0',
              volume24h: token.volume24hUsd?.toString() ?? '0',
              timestamp: Date.now(),
              source: 'cached',
            });
          }
        }
      } catch (error) {
        this.fastify.log.error(error, `Failed to fetch price for ${token.symbol}`);
        prices.push({
          address: token.address,
          symbol: token.symbol,
          priceUsd: token.priceUsd ?? '0',
          priceChange24h: token.priceChange24h ?? '0',
          volume24h: token.volume24hUsd?.toString() ?? '0',
          timestamp: Date.now(),
          source: 'cached',
        });
      }
    }

    return prices;
  }

  /**
   * CoinGecko token ID mapping
   */
  private static readonly COINGECKO_IDS: Record<string, string> = {
    '0x4200000000000000000000000000000000000006': 'ethereum',
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'usd-coin',
    '0x50c5725949a6f0c72e6c4a641f24049a917db0cb': 'dai',
    '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22': 'coinbase-wrapped-staked-eth',
  };

  /**
   * Fetch price from CoinGecko API (free tier, rate limited)
   */
  private async fetchFromCoinGecko(address: string): Promise<number | null> {
    const tokenId = PriceSyncWorker.COINGECKO_IDS[address.toLowerCase()];
    if (!tokenId) return null;

    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=usd`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as Record<string, { usd?: number }>;
      const price = data[tokenId]?.usd;
      return typeof price === 'number' ? price : null;
    } catch {
      return null;
    }
  }

  /**
   * Store price in history for 24h change calculation
   */
  private storePriceHistory(address: string, price: number): void {
    const history = this.priceHistory.get(address) || [];
    const now = Date.now();

    // Add new price point
    history.push({ price, timestamp: now });

    // Remove entries older than 24 hours
    const cutoff = now - this.HISTORY_RETENTION_MS;
    const filtered = history.filter(h => h.timestamp > cutoff);

    this.priceHistory.set(address, filtered);
  }

  /**
   * Calculate 24h price change percentage from historical data
   */
  private calculate24hChange(address: string, currentPrice: number): number {
    const history = this.priceHistory.get(address);
    if (!history || history.length === 0) {
      return 0;
    }

    // Find the oldest price within 24h (closest to 24h ago)
    const now = Date.now();
    const targetTime = now - this.HISTORY_RETENTION_MS;

    // Get the price closest to 24h ago
    let oldestPrice = history[0];
    for (const entry of history) {
      if (Math.abs(entry.timestamp - targetTime) < Math.abs(oldestPrice.timestamp - targetTime)) {
        oldestPrice = entry;
      }
    }

    if (oldestPrice.price === 0) {
      return 0;
    }

    // Calculate percentage change
    const change = ((currentPrice - oldestPrice.price) / oldestPrice.price) * 100;
    return change;
  }

  /**
   * Update database with new prices
   */
  private async updateDatabase(prices: TokenPrice[]) {
    for (const price of prices) {
      try {
        await this.fastify.db
          .update(tokens)
          .set({
            priceUsd: price.priceUsd,
            priceChange24h: price.priceChange24h,
            updatedAt: new Date(),
          })
          .where(eq(tokens.address, price.address));
      } catch (error) {
        this.fastify.log.error(error, `Failed to update price for ${price.symbol}`);
      }
    }
  }

  /**
   * Update cache with new prices
   */
  private async updateCache(chainId: number, prices: TokenPrice[]) {
    // Cache all prices as a batch
    const priceMap: Record<string, TokenPrice> = {};
    for (const price of prices) {
      priceMap[price.address] = price;

      // Also cache individual token prices
      await this.cache.set(
        CacheKeys.price(chainId, price.address),
        price,
        CacheTTL.price
      );
    }

    // Cache the full price map
    await this.cache.set(CacheKeys.prices(chainId), priceMap, CacheTTL.price);
  }

  /**
   * Broadcast price updates via Redis pub/sub
   */
  private async broadcast(chainId: number, prices: TokenPrice[]) {
    const channel = RedisChannels.prices(chainId);

    await this.cache.publish(channel, {
      chainId,
      prices,
      timestamp: Date.now(),
    });
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalId: this.intervalId !== null,
    };
  }
}
