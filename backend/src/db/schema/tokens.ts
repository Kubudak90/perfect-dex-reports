import { pgTable, serial, varchar, integer, boolean, numeric, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const tokens = pgTable('tokens', {
  id: serial('id').primaryKey(),
  address: varchar('address', { length: 42 }).notNull(),
  chainId: integer('chain_id').notNull(),

  symbol: varchar('symbol', { length: 20 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  decimals: integer('decimals').notNull(),

  logoUri: varchar('logo_uri', { length: 500 }),
  coingeckoId: varchar('coingecko_id', { length: 100 }),

  isVerified: boolean('is_verified').default(false),
  isNative: boolean('is_native').default(false),

  // Cached stats
  totalSupply: numeric('total_supply', { precision: 78 }),
  priceUsd: numeric('price_usd', { precision: 30, scale: 18 }),
  volume24hUsd: numeric('volume_24h_usd', { precision: 30, scale: 2 }).default('0'),
  tvlUsd: numeric('tvl_usd', { precision: 30, scale: 2 }).default('0'),
  priceChange24h: numeric('price_change_24h', { precision: 10, scale: 4 }).default('0'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueAddressChain: uniqueIndex('tokens_address_chain_idx').on(table.address, table.chainId),
  chainIdx: uniqueIndex('tokens_chain_idx').on(table.chainId),
  symbolIdx: uniqueIndex('tokens_symbol_idx').on(table.symbol),
}));

export type Token = typeof tokens.$inferSelect;
export type InsertToken = typeof tokens.$inferInsert;
