import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { tokens, type InsertToken } from '../db/schema/index.js';
import { getTokenMetadata } from '../blockchain/contracts/erc20.js';
import type { Address } from 'viem';

export class TokenService {
  constructor(private fastify: FastifyInstance) {}

  /**
   * Get or create token in database
   */
  async getOrCreateToken(chainId: number, address: Address) {
    // Check if token exists
    const [existing] = await this.fastify.db
      .select()
      .from(tokens)
      .where(and(eq(tokens.address, address.toLowerCase()), eq(tokens.chainId, chainId)))
      .limit(1);

    if (existing) {
      return existing;
    }

    // Fetch metadata from blockchain
    const metadata = await getTokenMetadata(chainId, address);

    // Insert new token
    const [newToken] = await this.fastify.db
      .insert(tokens)
      .values({
        address: address.toLowerCase(),
        chainId,
        symbol: metadata.symbol,
        name: metadata.name,
        decimals: metadata.decimals,
        totalSupply: metadata.totalSupply.toString(),
        isVerified: false,
        isNative: address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      })
      .returning();

    return newToken;
  }

  /**
   * Bulk insert or update tokens
   */
  async upsertTokens(tokenData: InsertToken[]) {
    for (const token of tokenData) {
      await this.fastify.db
        .insert(tokens)
        .values(token)
        .onConflictDoUpdate({
          target: [tokens.address, tokens.chainId],
          set: {
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            logoUri: token.logoUri,
            isVerified: token.isVerified,
            updatedAt: new Date(),
          },
        });
    }
  }

  /**
   * Update token price
   */
  async updateTokenPrice(chainId: number, address: string, priceUsd: string) {
    await this.fastify.db
      .update(tokens)
      .set({
        priceUsd,
        updatedAt: new Date(),
      })
      .where(and(eq(tokens.address, address.toLowerCase()), eq(tokens.chainId, chainId)));
  }
}
