import { createPublicClient, http, type PublicClient } from 'viem';
import { config, getChain, type SupportedChainId } from '../config/index.js';

// Client instances cache
const clients = new Map<number, PublicClient>();

/**
 * Create a blockchain client for a specific chain
 */
export function createBlockchainClient(chainId: SupportedChainId): PublicClient {
  const chain = getChain(chainId);
  const rpcUrl = config.rpc[chainId];

  if (!rpcUrl) {
    throw new Error(`No RPC URL configured for chain ${chainId}`);
  }

  return createPublicClient({
    chain,
    transport: http(rpcUrl, {
      timeout: 30_000,
      retryCount: 3,
      retryDelay: 1000,
    }),
    batch: {
      multicall: {
        wait: 16, // 16ms batching window
      },
    },
  });
}

/**
 * Get or create a blockchain client (singleton per chain)
 */
export function getBlockchainClient(chainId: number): PublicClient {
  if (!clients.has(chainId)) {
    clients.set(chainId, createBlockchainClient(chainId as SupportedChainId));
  }
  return clients.get(chainId)!;
}

/**
 * Check if client is healthy
 */
export async function checkClientHealth(chainId: number): Promise<boolean> {
  try {
    const client = getBlockchainClient(chainId);
    const blockNumber = await client.getBlockNumber();
    return blockNumber > 0n;
  } catch (error) {
    console.error(`Client health check failed for chain ${chainId}:`, error);
    return false;
  }
}

/**
 * Get current block number
 */
export async function getCurrentBlock(chainId: number): Promise<bigint> {
  const client = getBlockchainClient(chainId);
  return await client.getBlockNumber();
}
