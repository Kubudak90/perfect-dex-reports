import { Address } from 'viem';

/**
 * Token interface
 */
export interface Token {
  address: Address;
  chainId: number;
  decimals: number;
  symbol: string;
  name: string;
  logoURI?: string;
  isNative?: boolean;
  isVerified?: boolean;
}

/**
 * Token balance
 */
export interface TokenBalance {
  token: Token;
  balance: bigint;
  balanceFormatted: string;
  balanceUsd?: number;
}

/**
 * Token price
 */
export interface TokenPrice {
  address: Address;
  priceUsd: number;
  priceChange24h?: number;
  volume24h?: number;
  updatedAt: number;
}
