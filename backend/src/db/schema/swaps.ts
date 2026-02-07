import { pgTable, bigserial, varchar, integer, numeric, timestamp, uniqueIndex, bigint } from 'drizzle-orm/pg-core';
import { pools } from './pools.js';

export const swaps = pgTable('swaps', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),

  // Transaction info
  txHash: varchar('tx_hash', { length: 66 }).notNull(),
  logIndex: integer('log_index').notNull(),
  chainId: integer('chain_id').notNull(),

  // Pool reference
  poolId: integer('pool_id').references(() => pools.id),

  // Participants
  sender: varchar('sender', { length: 42 }).notNull(),
  recipient: varchar('recipient', { length: 42 }).notNull(),
  origin: varchar('origin', { length: 42 }),

  // Amounts
  amount0: numeric('amount0', { precision: 78 }).notNull(),
  amount1: numeric('amount1', { precision: 78 }).notNull(),
  amountUsd: numeric('amount_usd', { precision: 30, scale: 2 }),

  // State after swap
  sqrtPriceX96: numeric('sqrt_price_x96', { precision: 78 }),
  tick: integer('tick'),
  liquidity: numeric('liquidity', { precision: 78 }),

  // Block info
  blockNumber: bigint('block_number', { mode: 'bigint' }).notNull(),
  blockTimestamp: timestamp('block_timestamp').notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueTxLogChain: uniqueIndex('swaps_tx_log_chain_idx').on(table.txHash, table.logIndex, table.chainId),
  poolIdx: uniqueIndex('swaps_pool_idx').on(table.poolId),
  senderIdx: uniqueIndex('swaps_sender_idx').on(table.sender),
  blockIdx: uniqueIndex('swaps_block_idx').on(table.blockNumber),
}));

export type Swap = typeof swaps.$inferSelect;
export type InsertSwap = typeof swaps.$inferInsert;
