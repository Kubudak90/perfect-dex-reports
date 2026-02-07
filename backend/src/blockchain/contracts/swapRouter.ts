import type { Address } from 'viem';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { SWAP_ROUTER_ABI } from '../abis/swapRouter.js';
import { getContractAddresses } from '../../config/addresses.js';
import { getRpcUrl } from '../../config/chains.js';

/**
 * Swap parameters for exactInputSingle
 */
export interface ExactInputSingleParams {
  tokenIn: Address;
  tokenOut: Address;
  fee: number; // Fee tier (100, 500, 3000, 10000)
  recipient: Address;
  deadline: bigint;
  amountIn: bigint;
  amountOutMinimum: bigint;
  sqrtPriceLimitX96: bigint;
}

/**
 * Swap parameters for exactInput (multi-hop)
 */
export interface ExactInputParams {
  path: `0x${string}`; // Encoded path
  recipient: Address;
  deadline: bigint;
  amountIn: bigint;
  amountOutMinimum: bigint;
}

/**
 * Swap parameters for exactOutputSingle
 */
export interface ExactOutputSingleParams {
  tokenIn: Address;
  tokenOut: Address;
  fee: number;
  recipient: Address;
  deadline: bigint;
  amountOut: bigint;
  amountInMaximum: bigint;
  sqrtPriceLimitX96: bigint;
}

/**
 * Get SwapRouter contract address for chain
 */
export function getSwapRouterAddress(chainId: number): Address {
  const addresses = getContractAddresses(chainId);
  return addresses.swapRouter;
}

/**
 * Create public client for chain
 */
function getPublicClient(chainId: number) {
  const rpcUrl = getRpcUrl(chainId);

  return createPublicClient({
    chain: chainId === 8453 ? base : undefined,
    transport: http(rpcUrl),
  });
}

/**
 * Simulate exactInputSingle swap
 * Returns expected amountOut
 */
export async function simulateExactInputSingle(
  chainId: number,
  params: ExactInputSingleParams
): Promise<bigint> {
  const client = getPublicClient(chainId);
  const swapRouterAddress = getSwapRouterAddress(chainId);

  const { result } = await client.simulateContract({
    address: swapRouterAddress,
    abi: SWAP_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [params],
  });

  return result;
}

/**
 * Simulate exactInput swap (multi-hop)
 * Returns expected amountOut
 */
export async function simulateExactInput(
  chainId: number,
  params: ExactInputParams
): Promise<bigint> {
  const client = getPublicClient(chainId);
  const swapRouterAddress = getSwapRouterAddress(chainId);

  const { result } = await client.simulateContract({
    address: swapRouterAddress,
    abi: SWAP_ROUTER_ABI,
    functionName: 'exactInput',
    args: [params],
  });

  return result;
}

/**
 * Simulate exactOutputSingle swap
 * Returns required amountIn
 */
export async function simulateExactOutputSingle(
  chainId: number,
  params: ExactOutputSingleParams
): Promise<bigint> {
  const client = getPublicClient(chainId);
  const swapRouterAddress = getSwapRouterAddress(chainId);

  const { result } = await client.simulateContract({
    address: swapRouterAddress,
    abi: SWAP_ROUTER_ABI,
    functionName: 'exactOutputSingle',
    args: [params],
  });

  return result;
}

/**
 * Encode multi-hop swap path
 * Format: tokenIn | fee | tokenOut | fee | ... | finalTokenOut
 */
export function encodePath(tokens: Address[], fees: number[]): `0x${string}` {
  if (tokens.length !== fees.length + 1) {
    throw new Error('Tokens array must be one element longer than fees array');
  }

  let path = '0x';

  for (let i = 0; i < fees.length; i++) {
    // Add token address (remove 0x prefix)
    path += tokens[i].slice(2);

    // Add fee as 3 bytes (6 hex chars)
    const feeHex = fees[i].toString(16).padStart(6, '0');
    path += feeHex;
  }

  // Add final token
  path += tokens[tokens.length - 1].slice(2);

  return path as `0x${string}`;
}

/**
 * Decode swap path
 * Returns array of tokens and fees
 */
export function decodePath(path: `0x${string}`): {
  tokens: Address[];
  fees: number[];
} {
  // Remove 0x prefix
  const pathWithoutPrefix = path.slice(2);

  const tokens: Address[] = [];
  const fees: number[] = [];

  // Each token is 40 chars (20 bytes), each fee is 6 chars (3 bytes)
  // Pattern: token(40) + fee(6) + token(40) + fee(6) + ... + token(40)
  const ADDR_SIZE = 40;
  const FEE_SIZE = 6;

  let offset = 0;

  while (offset < pathWithoutPrefix.length) {
    // Extract token
    const tokenHex = pathWithoutPrefix.slice(offset, offset + ADDR_SIZE);
    tokens.push(`0x${tokenHex}` as Address);
    offset += ADDR_SIZE;

    // Extract fee if not at end
    if (offset < pathWithoutPrefix.length) {
      const feeHex = pathWithoutPrefix.slice(offset, offset + FEE_SIZE);
      fees.push(parseInt(feeHex, 16));
      offset += FEE_SIZE;
    }
  }

  return { tokens, fees };
}
