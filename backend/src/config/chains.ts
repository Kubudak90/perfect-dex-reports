import { base, baseSepolia, arbitrum, optimism } from 'viem/chains';
import type { Chain } from 'viem';

export const supportedChains = {
  8453: base,
  84532: baseSepolia,
  42161: arbitrum,
  10: optimism,
} as const;

export type SupportedChainId = keyof typeof supportedChains;

export function getChain(chainId: number): Chain {
  const chain = supportedChains[chainId as SupportedChainId];
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return chain;
}

export function isSupportedChain(chainId: number): chainId is SupportedChainId {
  return chainId in supportedChains;
}

export const DEFAULT_CHAIN_ID: SupportedChainId = 84532; // Base Sepolia (testnet)
