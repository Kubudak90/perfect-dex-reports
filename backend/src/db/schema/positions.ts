import { pgTable, bigserial, bigint, varchar, integer, numeric, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { pools } from './pools.js';

export const userPositions = pgTable('user_positions', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  tokenId: bigint('token_id', { mode: 'bigint' }).notNull(), // NFT token ID
  chainId: integer('chain_id').notNull(),

  // Owner
  owner: varchar('owner', { length: 42 }).notNull(),

  // Pool reference
  poolId: integer('pool_id').references(() => pools.id).notNull(),

  // Range
  tickLower: integer('tick_lower').notNull(),
  tickUpper: integer('tick_upper').notNull(),

  // Liquidity
  liquidity: numeric('liquidity', { precision: 78 }).notNull(),

  // Deposited amounts
  depositedToken0: numeric('deposited_token0', { precision: 78 }),
  depositedToken1: numeric('deposited_token1', { precision: 78 }),

  // Unclaimed fees
  unclaimedFees0: numeric('unclaimed_fees0', { precision: 78 }).default('0'),
  unclaimedFees1: numeric('unclaimed_fees1', { precision: 78 }).default('0'),

  // Fee tracking
  feeGrowthInside0: numeric('fee_growth_inside0', { precision: 78 }),
  feeGrowthInside1: numeric('fee_growth_inside1', { precision: 78 }),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueTokenIdChain: uniqueIndex('positions_token_id_chain_idx').on(table.tokenId, table.chainId),
  ownerIdx: uniqueIndex('positions_owner_idx').on(table.owner),
  poolIdx: uniqueIndex('positions_pool_idx').on(table.poolId),
}));

export type UserPosition = typeof userPositions.$inferSelect;
export type InsertUserPosition = typeof userPositions.$inferInsert;
