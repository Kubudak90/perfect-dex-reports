/**
 * PoolManager Contract ABI
 *
 * Core singleton pool manager for BaseBook DEX
 * Address (Base Sepolia): 0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05
 */

import abi from './PoolManager.json';

export const PoolManagerABI = abi as const;

export default PoolManagerABI;

// Type-safe contract address
export const POOL_MANAGER_ADDRESS = {
  BASE_SEPOLIA: '0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05' as const,
} as const;

// Example usage with wagmi v2:
// import { useReadContract } from 'wagmi';
// import { PoolManagerABI, POOL_MANAGER_ADDRESS } from '@/abis/PoolManager';
//
// const { data: slot0 } = useReadContract({
//   address: POOL_MANAGER_ADDRESS.BASE_SEPOLIA,
//   abi: PoolManagerABI,
//   functionName: 'getSlot0',
//   args: [poolId],
// });

// Example usage with viem:
// import { createPublicClient, http } from 'viem';
// import { baseSepolia } from 'viem/chains';
// import { PoolManagerABI, POOL_MANAGER_ADDRESS } from './abis/PoolManager';
//
// const client = createPublicClient({
//   chain: baseSepolia,
//   transport: http(),
// });
//
// const slot0 = await client.readContract({
//   address: POOL_MANAGER_ADDRESS.BASE_SEPOLIA,
//   abi: PoolManagerABI,
//   functionName: 'getSlot0',
//   args: [poolId],
// });
