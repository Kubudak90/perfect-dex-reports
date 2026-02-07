import { createPublicClient, http, type Address } from 'viem';
import { base } from 'viem/chains';
import { CHAINLINK_AGGREGATOR_V3_ABI } from '../blockchain/abis/chainlinkAggregator.js';
import { isMockMode } from '../config/mock.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChainlinkFeedConfig {
  /** Chainlink aggregator proxy address on Base mainnet */
  feedAddress: Address;
  /** Number of decimals returned by the feed (typically 8 for USD feeds) */
  feedDecimals: number;
  /** Human-readable pair description, e.g. "ETH / USD" */
  pair: string;
  /** Maximum acceptable age of a price update in seconds (heartbeat) */
  heartbeatSeconds: number;
}

export interface PriceFeedResult {
  /** Token address (checksummed) */
  address: string;
  /** Human-readable symbol */
  symbol: string;
  /** Price in USD as a string with full precision */
  priceUsd: string;
  /** Price denominated in ETH */
  priceEth: string;
  /** Token decimals */
  decimals: number;
  /** Unix timestamp of the price update (seconds) */
  lastUpdated: number;
  /** Source of the price data */
  source: 'chainlink' | 'fallback_twap' | 'fallback_cache' | 'mock';
  /** Chainlink roundId (when source is chainlink) */
  roundId?: string;
}

interface CachedPrice {
  result: PriceFeedResult;
  cachedAt: number;
}

// ---------------------------------------------------------------------------
// Chainlink Feed Registry – Base Mainnet (chain 8453)
// ---------------------------------------------------------------------------

/**
 * Known Chainlink price feed addresses on Base mainnet.
 * Keys are lower-cased token addresses.
 */
export const CHAINLINK_FEED_REGISTRY: Record<string, ChainlinkFeedConfig> = {
  // WETH
  '0x4200000000000000000000000000000000000006': {
    feedAddress: '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70',
    feedDecimals: 8,
    pair: 'ETH / USD',
    heartbeatSeconds: 3600, // 1 hour
  },
  // WBTC
  '0x0555e30da8f98308edb960aa94c0db47230d2b9c': {
    feedAddress: '0xCCADC697c55bbB68dc5bCdf8d3CBe83CdD4E071E',
    feedDecimals: 8,
    pair: 'WBTC / USD',
    heartbeatSeconds: 3600,
  },
  // USDC
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': {
    feedAddress: '0x7e860098F58bBFC8648a4311b374B1D669a2bc6B',
    feedDecimals: 8,
    pair: 'USDC / USD',
    heartbeatSeconds: 86400, // 24 hours for stablecoins
  },
  // DAI
  '0x50c5725949a6f0c72e6c4a641f24049a917db0cb': {
    feedAddress: '0x591e79239a7d679378eC8c847e5038150364C78F',
    feedDecimals: 8,
    pair: 'DAI / USD',
    heartbeatSeconds: 3600,
  },
  // cbETH
  '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22': {
    feedAddress: '0xd7818272B9e248357d13057AAb0B417aF31E817d',
    feedDecimals: 8,
    pair: 'cbETH / USD',
    heartbeatSeconds: 3600,
  },
};

/**
 * Token metadata used for building PriceFeedResult objects.
 * Keys are lower-cased token addresses.
 */
const TOKEN_METADATA: Record<string, { symbol: string; decimals: number }> = {
  '0x4200000000000000000000000000000000000006': { symbol: 'WETH', decimals: 18 },
  '0x0555e30da8f98308edb960aa94c0db47230d2b9c': { symbol: 'WBTC', decimals: 8 },
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { symbol: 'USDC', decimals: 6 },
  '0x50c5725949a6f0c72e6c4a641f24049a917db0cb': { symbol: 'DAI', decimals: 18 },
  '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22': { symbol: 'cbETH', decimals: 18 },
};

/**
 * Static mock prices used when running in mock mode or as a last-resort fallback.
 */
const MOCK_PRICES: Record<string, { priceUsd: number; priceEth: number }> = {
  '0x4200000000000000000000000000000000000006': { priceUsd: 2450.50, priceEth: 1.0 },
  '0x0555e30da8f98308edb960aa94c0db47230d2b9c': { priceUsd: 43250.00, priceEth: 17.653 },
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { priceUsd: 1.00, priceEth: 0.000408 },
  '0x50c5725949a6f0c72e6c4a641f24049a917db0cb': { priceUsd: 0.9998, priceEth: 0.000408 },
  '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22': { priceUsd: 2455.00, priceEth: 1.0018 },
};

// ---------------------------------------------------------------------------
// WETH address for ETH denominated prices
// ---------------------------------------------------------------------------
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';

// ---------------------------------------------------------------------------
// ChainlinkPriceFeedService
// ---------------------------------------------------------------------------

export class ChainlinkPriceFeedService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any = null;
  private cache = new Map<string, CachedPrice>();
  private readonly cacheTtlMs: number;
  private readonly stalePriceThresholdSeconds: number;
  private logger: { info: Function; warn: Function; error: Function; debug: Function };

  /**
   * @param options.rpcUrl - Base mainnet RPC URL (defaults to env or public endpoint)
   * @param options.cacheTtlSeconds - How long to serve cached prices (default 30s)
   * @param options.stalePriceThresholdSeconds - Max acceptable age for a Chainlink price (default 3600s / 1 hour)
   * @param options.logger - Optional structured logger
   */
  constructor(options?: {
    rpcUrl?: string;
    cacheTtlSeconds?: number;
    stalePriceThresholdSeconds?: number;
    logger?: { info: Function; warn: Function; error: Function; debug: Function };
  }) {
    this.cacheTtlMs = (options?.cacheTtlSeconds ?? 30) * 1000;
    this.stalePriceThresholdSeconds = options?.stalePriceThresholdSeconds ?? 3600;
    this.logger = options?.logger ?? console;

    if (!isMockMode()) {
      const rpcUrl = options?.rpcUrl
        || process.env.CHAINLINK_RPC_URL
        || process.env.RPC_URL_BASE
        || 'https://mainnet.base.org';

      this.client = createPublicClient({
        chain: base,
        transport: http(rpcUrl, {
          timeout: 15_000,
          retryCount: 2,
          retryDelay: 500,
        }),
      });
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Get the price for a single token address.
   *
   * Resolution order:
   * 1. In-memory cache (if fresh)
   * 2. Chainlink on-chain feed
   * 3. Fallback to cached stale price (if available)
   * 4. Mock/static fallback
   */
  async getPrice(tokenAddress: string): Promise<PriceFeedResult> {
    const address = tokenAddress.toLowerCase();

    // 1. Check in-memory cache
    const cached = this.getCached(address);
    if (cached) {
      return cached;
    }

    // 2. Mock mode — return static data
    if (isMockMode()) {
      return this.buildMockResult(address);
    }

    // 3. Try Chainlink feed
    const feedConfig = CHAINLINK_FEED_REGISTRY[address];
    if (feedConfig && this.client) {
      try {
        const result = await this.fetchFromChainlink(address, feedConfig);
        this.setCache(address, result);
        return result;
      } catch (error) {
        this.logger.warn(
          `Chainlink fetch failed for ${address} (${feedConfig.pair}): ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // 4. Fallback — serve stale cache if available
    const stale = this.cache.get(address);
    if (stale) {
      this.logger.warn(`Serving stale cached price for ${address}`);
      return {
        ...stale.result,
        source: 'fallback_cache',
      };
    }

    // 5. Last resort — static mock fallback
    this.logger.warn(`No price source available for ${address}, using static fallback`);
    return this.buildMockResult(address);
  }

  /**
   * Get prices for multiple token addresses in a single call.
   */
  async getPrices(tokenAddresses: string[]): Promise<Record<string, PriceFeedResult>> {
    const results: Record<string, PriceFeedResult> = {};
    const promises = tokenAddresses.map(async (addr) => {
      results[addr] = await this.getPrice(addr);
    });
    await Promise.allSettled(promises);
    return results;
  }

  /**
   * Get prices for all known tokens in the registry.
   */
  async getAllPrices(): Promise<Record<string, PriceFeedResult>> {
    const addresses = Object.keys(CHAINLINK_FEED_REGISTRY);
    return this.getPrices(addresses);
  }

  /**
   * Returns the list of token addresses that have Chainlink feed support.
   */
  getSupportedTokens(): string[] {
    return Object.keys(CHAINLINK_FEED_REGISTRY);
  }

  /**
   * Clear the price cache (useful for testing or forced refresh).
   */
  clearCache(): void {
    this.cache.clear();
  }

  // -------------------------------------------------------------------------
  // Chainlink interaction
  // -------------------------------------------------------------------------

  /**
   * Fetch latest price from a Chainlink aggregator contract.
   * Validates staleness before returning.
   */
  private async fetchFromChainlink(
    tokenAddress: string,
    feedConfig: ChainlinkFeedConfig
  ): Promise<PriceFeedResult> {
    if (!this.client) {
      throw new Error('Blockchain client not initialised (mock mode?)');
    }

    const [roundId, answer, _startedAt, updatedAt, _answeredInRound] =
      await this.client.readContract({
        address: feedConfig.feedAddress,
        abi: CHAINLINK_AGGREGATOR_V3_ABI,
        functionName: 'latestRoundData',
      });

    // --- Validation ---

    // answer must be positive
    if (answer <= 0n) {
      throw new Error(
        `Chainlink returned non-positive price for ${feedConfig.pair}: ${answer.toString()}`
      );
    }

    // Stale price check: updatedAt must be within the heartbeat window
    const now = BigInt(Math.floor(Date.now() / 1000));
    const age = now - updatedAt;
    const maxAge = BigInt(Math.max(feedConfig.heartbeatSeconds, this.stalePriceThresholdSeconds));

    if (age > maxAge) {
      throw new Error(
        `Chainlink price for ${feedConfig.pair} is stale: updated ${age}s ago (max ${maxAge}s)`
      );
    }

    // roundId sanity check
    if (roundId === 0n) {
      throw new Error(`Chainlink returned roundId 0 for ${feedConfig.pair}`);
    }

    // --- Build result ---
    const priceUsd = Number(answer) / Math.pow(10, feedConfig.feedDecimals);

    // Derive ETH price from the WETH feed
    const ethPriceUsd = await this.getEthPriceUsd();
    const priceEth = ethPriceUsd > 0 ? priceUsd / ethPriceUsd : 0;

    const meta = TOKEN_METADATA[tokenAddress] ?? { symbol: 'UNKNOWN', decimals: 18 };

    return {
      address: tokenAddress,
      symbol: meta.symbol,
      priceUsd: priceUsd.toFixed(6),
      priceEth: priceEth.toFixed(6),
      decimals: meta.decimals,
      lastUpdated: Number(updatedAt),
      source: 'chainlink',
      roundId: roundId.toString(),
    };
  }

  /**
   * Helper to fetch the ETH/USD price for ETH-denominated conversions.
   * Uses the cache when available to avoid redundant RPC calls.
   */
  private async getEthPriceUsd(): Promise<number> {
    // Check cache first
    const cached = this.cache.get(WETH_ADDRESS);
    if (cached && this.isCacheFresh(cached)) {
      return parseFloat(cached.result.priceUsd);
    }

    // Fetch live
    if (this.client) {
      const feedConfig = CHAINLINK_FEED_REGISTRY[WETH_ADDRESS];
      if (feedConfig) {
        try {
          const [_roundId, answer, _startedAt, _updatedAt, _answeredInRound] =
            await this.client.readContract({
              address: feedConfig.feedAddress,
              abi: CHAINLINK_AGGREGATOR_V3_ABI,
              functionName: 'latestRoundData',
            });

          if (answer > 0n) {
            return Number(answer) / Math.pow(10, feedConfig.feedDecimals);
          }
        } catch {
          // fall through to static
        }
      }
    }

    // Static fallback
    return MOCK_PRICES[WETH_ADDRESS]?.priceUsd ?? 2450.50;
  }

  // -------------------------------------------------------------------------
  // Caching helpers
  // -------------------------------------------------------------------------

  private getCached(address: string): PriceFeedResult | null {
    const entry = this.cache.get(address);
    if (!entry) return null;
    if (!this.isCacheFresh(entry)) return null;
    return entry.result;
  }

  private isCacheFresh(entry: CachedPrice): boolean {
    return Date.now() - entry.cachedAt < this.cacheTtlMs;
  }

  private setCache(address: string, result: PriceFeedResult): void {
    this.cache.set(address, { result, cachedAt: Date.now() });
  }

  // -------------------------------------------------------------------------
  // Mock / fallback helpers
  // -------------------------------------------------------------------------

  private buildMockResult(address: string): PriceFeedResult {
    const meta = TOKEN_METADATA[address] ?? { symbol: 'UNKNOWN', decimals: 18 };
    const mock = MOCK_PRICES[address];

    if (mock) {
      return {
        address,
        symbol: meta.symbol,
        priceUsd: mock.priceUsd.toFixed(6),
        priceEth: mock.priceEth.toFixed(6),
        decimals: meta.decimals,
        lastUpdated: Math.floor(Date.now() / 1000),
        source: 'mock',
      };
    }

    return {
      address,
      symbol: meta.symbol,
      priceUsd: '0.000000',
      priceEth: '0.000000',
      decimals: meta.decimals,
      lastUpdated: Math.floor(Date.now() / 1000),
      source: 'mock',
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

let _instance: ChainlinkPriceFeedService | null = null;

/**
 * Get or create the global ChainlinkPriceFeedService singleton.
 * Safe to call multiple times — returns the same instance.
 */
export function getChainlinkPriceFeedService(options?: {
  rpcUrl?: string;
  cacheTtlSeconds?: number;
  stalePriceThresholdSeconds?: number;
  logger?: { info: Function; warn: Function; error: Function; debug: Function };
}): ChainlinkPriceFeedService {
  if (!_instance) {
    _instance = new ChainlinkPriceFeedService(options);
  }
  return _instance;
}

/**
 * Reset the singleton (useful for testing).
 */
export function resetChainlinkPriceFeedService(): void {
  _instance = null;
}
