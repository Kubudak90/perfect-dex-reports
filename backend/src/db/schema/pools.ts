import { pgTable, serial, varchar, integer, numeric, timestamp, uniqueIndex, bigint, date } from 'drizzle-orm/pg-core';
import { tokens } from './tokens.js';

export const pools = pgTable('pools', {
  id: serial('id').primaryKey(),
  poolId: varchar('pool_id', { length: 66 }).notNull(),
  chainId: integer('chain_id').notNull(),

  // Pool Key components
  token0Id: integer('token0_id').references(() => tokens.id).notNull(),
  token1Id: integer('token1_id').references(() => tokens.id).notNull(),
  feeTier: integer('fee_tier').notNull(), // 100, 500, 3000, 10000
  tickSpacing: integer('tick_spacing').notNull(),
  hookAddress: varchar('hook_address', { length: 42 }),

  // Current state
  sqrtPriceX96: numeric('sqrt_price_x96', { precision: 78 }),
  currentTick: integer('current_tick'),
  liquidity: numeric('liquidity', { precision: 78 }),

  // Pricing
  token0Price: numeric('token0_price', { precision: 30, scale: 18 }),
  token1Price: numeric('token1_price', { precision: 30, scale: 18 }),

  // Stats (24h)
  volume24hUsd: numeric('volume_24h_usd', { precision: 30, scale: 2 }).default('0'),
  volume24hToken0: numeric('volume_24h_token0', { precision: 78 }).default('0'),
  volume24hToken1: numeric('volume_24h_token1', { precision: 78 }).default('0'),
  fees24hUsd: numeric('fees_24h_usd', { precision: 30, scale: 2 }).default('0'),
  txCount24h: integer('tx_count_24h').default(0),

  // TVL
  tvlUsd: numeric('tvl_usd', { precision: 30, scale: 2 }).default('0'),
  tvlToken0: numeric('tvl_token0', { precision: 78 }).default('0'),
  tvlToken1: numeric('tvl_token1', { precision: 78 }).default('0'),

  // Calculated
  apr24h: numeric('apr_24h', { precision: 10, scale: 4 }).default('0'),

  // Metadata
  createdBlock: bigint('created_block', { mode: 'bigint' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniquePoolIdChain: uniqueIndex('pools_pool_id_chain_idx').on(table.poolId, table.chainId),
  token0Idx: uniqueIndex('pools_token0_idx').on(table.token0Id),
  token1Idx: uniqueIndex('pools_token1_idx').on(table.token1Id),
  chainIdx: uniqueIndex('pools_chain_idx').on(table.chainId),
}));

export type Pool = typeof pools.$inferSelect;
export type InsertPool = typeof pools.$inferInsert;

// Pool Hour Data (OHLCV)
export const poolHourData = pgTable('pool_hour_data', {
  id: serial('id').primaryKey(),
  poolId: integer('pool_id').references(() => pools.id).notNull(),

  // Time
  hourStart: timestamp('hour_start').notNull(),

  // OHLCV
  openPrice: numeric('open_price', { precision: 30, scale: 18 }),
  highPrice: numeric('high_price', { precision: 30, scale: 18 }),
  lowPrice: numeric('low_price', { precision: 30, scale: 18 }),
  closePrice: numeric('close_price', { precision: 30, scale: 18 }),

  // Volume
  volumeUsd: numeric('volume_usd', { precision: 30, scale: 2 }).default('0'),
  volumeToken0: numeric('volume_token0', { precision: 78 }).default('0'),
  volumeToken1: numeric('volume_token1', { precision: 78 }).default('0'),

  // Stats
  tvlUsd: numeric('tvl_usd', { precision: 30, scale: 2 }).default('0'),
  feesUsd: numeric('fees_usd', { precision: 30, scale: 2 }).default('0'),
  txCount: integer('tx_count').default(0),

  // Liquidity
  liquidity: numeric('liquidity', { precision: 78 }),
  sqrtPrice: numeric('sqrt_price', { precision: 78 }),
  tick: integer('tick'),
}, (table) => ({
  uniquePoolHour: uniqueIndex('pool_hour_data_pool_hour_idx').on(table.poolId, table.hourStart),
}));

export type PoolHourData = typeof poolHourData.$inferSelect;
export type InsertPoolHourData = typeof poolHourData.$inferInsert;

// Pool Day Data
export const poolDayData = pgTable('pool_day_data', {
  id: serial('id').primaryKey(),
  poolId: integer('pool_id').references(() => pools.id).notNull(),

  // Time
  dayStart: date('day_start').notNull(),

  // OHLCV
  openPrice: numeric('open_price', { precision: 30, scale: 18 }),
  highPrice: numeric('high_price', { precision: 30, scale: 18 }),
  lowPrice: numeric('low_price', { precision: 30, scale: 18 }),
  closePrice: numeric('close_price', { precision: 30, scale: 18 }),

  // Volume
  volumeUsd: numeric('volume_usd', { precision: 30, scale: 2 }).default('0'),
  volumeToken0: numeric('volume_token0', { precision: 78 }).default('0'),
  volumeToken1: numeric('volume_token1', { precision: 78 }).default('0'),
  tvlUsd: numeric('tvl_usd', { precision: 30, scale: 2 }).default('0'),
  feesUsd: numeric('fees_usd', { precision: 30, scale: 2 }).default('0'),
  txCount: integer('tx_count').default(0),
}, (table) => ({
  uniquePoolDay: uniqueIndex('pool_day_data_pool_day_idx').on(table.poolId, table.dayStart),
}));

export type PoolDayData = typeof poolDayData.$inferSelect;
export type InsertPoolDayData = typeof poolDayData.$inferInsert;
