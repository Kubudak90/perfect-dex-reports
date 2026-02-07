import { db, tokens, pools } from '../db/index.js';
import { eq, and } from 'drizzle-orm';

/**
 * Seed database with sample data for development/testing
 */
async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // Seed Base tokens
    console.log('📝 Seeding Base tokens...');

    const baseTokens = await db.insert(tokens).values([
      {
        address: '0x4200000000000000000000000000000000000006',
        chainId: 8453,
        symbol: 'WETH',
        name: 'Wrapped Ether',
        decimals: 18,
        isVerified: true,
        isNative: false,
        priceUsd: '2450.50',
        volume24hUsd: '150000000',
        tvlUsd: '500000000',
      },
      {
        address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        chainId: 8453,
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        isVerified: true,
        isNative: false,
        priceUsd: '1.00',
        volume24hUsd: '200000000',
        tvlUsd: '800000000',
      },
      {
        address: '0x50c5725949a6f0c72e6c4a641f24049a917db0cb',
        chainId: 8453,
        symbol: 'DAI',
        name: 'Dai Stablecoin',
        decimals: 18,
        isVerified: true,
        isNative: false,
        priceUsd: '0.9998',
        volume24hUsd: '50000000',
        tvlUsd: '200000000',
      },
      {
        address: '0x0555e30da8f98308edb960aa94c0db47230d2b9c',
        chainId: 8453,
        symbol: 'WBTC',
        name: 'Wrapped Bitcoin',
        decimals: 8,
        isVerified: true,
        isNative: false,
        priceUsd: '43250.00',
        volume24hUsd: '75000000',
        tvlUsd: '350000000',
      },
      {
        address: '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22',
        chainId: 8453,
        symbol: 'cbETH',
        name: 'Coinbase Wrapped Staked ETH',
        decimals: 18,
        isVerified: true,
        isNative: false,
        priceUsd: '2455.00',
        volume24hUsd: '25000000',
        tvlUsd: '120000000',
      },
      {
        address: '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca',
        chainId: 8453,
        symbol: 'USDbC',
        name: 'USD Base Coin',
        decimals: 6,
        isVerified: true,
        isNative: false,
        priceUsd: '1.0001',
        volume24hUsd: '30000000',
        tvlUsd: '100000000',
      },
      {
        address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        chainId: 8453,
        symbol: 'ETH',
        name: 'Ether',
        decimals: 18,
        isVerified: true,
        isNative: true,
        priceUsd: '2450.50',
        volume24hUsd: '300000000',
        tvlUsd: '1000000000',
      },
    ]).onConflictDoNothing().returning();

    console.log(`✅ Created ${baseTokens.length} tokens`);

    // Get token IDs for pool creation
    const [weth] = await db.select().from(tokens).where(and(eq(tokens.symbol, 'WETH'), eq(tokens.chainId, 8453))).limit(1);
    const [usdc] = await db.select().from(tokens).where(and(eq(tokens.symbol, 'USDC'), eq(tokens.chainId, 8453))).limit(1);
    const [dai] = await db.select().from(tokens).where(and(eq(tokens.symbol, 'DAI'), eq(tokens.chainId, 8453))).limit(1);

    if (!weth || !usdc || !dai) {
      throw new Error('Required tokens not found');
    }

    // Seed pools
    console.log('🏊 Seeding pools...');

    const basePools = await db.insert(pools).values([
      {
        poolId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        chainId: 8453,
        token0Id: weth.id,
        token1Id: usdc.id,
        feeTier: 3000, // 0.3%
        tickSpacing: 60,
        hookAddress: null,
        sqrtPriceX96: '1234567890123456789012345',
        currentTick: -200000,
        liquidity: '500000000000000000000',
        token0Price: '2450.50',
        token1Price: '0.000408',
        volume24hUsd: '5000000',
        volume24hToken0: '2040',
        volume24hToken1: '5000000',
        fees24hUsd: '15000',
        txCount24h: 1250,
        tvlUsd: '12000000',
        tvlToken0: '2450',
        tvlToken1: '6000000',
        apr24h: '45.67',
        createdBlock: 10000000n,
      },
      {
        poolId: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        chainId: 8453,
        token0Id: usdc.id,
        token1Id: dai.id,
        feeTier: 500, // 0.05%
        tickSpacing: 10,
        hookAddress: null,
        sqrtPriceX96: '79228162514264337593543950336',
        currentTick: 0,
        liquidity: '1000000000000000000000',
        token0Price: '1.0001',
        token1Price: '0.9999',
        volume24hUsd: '8000000',
        volume24hToken0: '4000000',
        volume24hToken1: '4000000',
        fees24hUsd: '4000',
        txCount24h: 2100,
        tvlUsd: '20000000',
        tvlToken0: '10000000',
        tvlToken1: '10000000',
        apr24h: '7.30',
        createdBlock: 10000100n,
      },
      {
        poolId: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        chainId: 8453,
        token0Id: weth.id,
        token1Id: dai.id,
        feeTier: 3000, // 0.3%
        tickSpacing: 60,
        hookAddress: null,
        sqrtPriceX96: '1234500000000000000000000',
        currentTick: -200050,
        liquidity: '300000000000000000000',
        token0Price: '2450.00',
        token1Price: '0.000408',
        volume24hUsd: '2500000',
        volume24hToken0: '1020',
        volume24hToken1: '2500000',
        fees24hUsd: '7500',
        txCount24h: 650,
        tvlUsd: '8000000',
        tvlToken0: '1632',
        tvlToken1: '4000000',
        apr24h: '34.22',
        createdBlock: 10000200n,
      },
    ]).onConflictDoNothing().returning();

    console.log(`✅ Created ${basePools.length} pools`);

    console.log('🎉 Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

// Run seed if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seed };
