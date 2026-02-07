import { base, arbitrum, optimism } from 'wagmi/chains';

/**
 * Supported chains for BaseBook DEX
 */
export const SUPPORTED_CHAINS = [base, arbitrum, optimism] as const;

/**
 * Default chain (Base)
 */
export const DEFAULT_CHAIN = base;

/**
 * Chain IDs
 */
export const CHAIN_IDS = {
  BASE: 8453,
  ARBITRUM: 42161,
  OPTIMISM: 10,
} as const;

/**
 * Chain names
 */
export const CHAIN_NAMES: Record<number, string> = {
  [CHAIN_IDS.BASE]: 'Base',
  [CHAIN_IDS.ARBITRUM]: 'Arbitrum',
  [CHAIN_IDS.OPTIMISM]: 'Optimism',
};

/**
 * Block explorer URLs
 */
export const BLOCK_EXPLORERS: Record<number, string> = {
  [CHAIN_IDS.BASE]: 'https://basescan.org',
  [CHAIN_IDS.ARBITRUM]: 'https://arbiscan.io',
  [CHAIN_IDS.OPTIMISM]: 'https://optimistic.etherscan.io',
};
