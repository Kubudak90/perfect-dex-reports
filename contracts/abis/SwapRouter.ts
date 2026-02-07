/**
 * SwapRouter Contract ABI
 *
 * Swap execution router with Permit2 support
 * Address (Base Sepolia): 0xFf438e2d528F55fD1141382D1eB436201552d1A5
 */

import abi from './SwapRouter.json';

export const SwapRouterABI = abi as const;

export default SwapRouterABI;

// Type-safe contract address
export const SWAP_ROUTER_ADDRESS = {
  BASE_SEPOLIA: '0xFf438e2d528F55fD1141382D1eB436201552d1A5' as const,
} as const;

// Example usage with wagmi v2:
// import { useWriteContract } from 'wagmi';
// import { SwapRouterABI, SWAP_ROUTER_ADDRESS } from '@/abis/SwapRouter';
//
// const { writeContract } = useWriteContract();
//
// await writeContract({
//   address: SWAP_ROUTER_ADDRESS.BASE_SEPOLIA,
//   abi: SwapRouterABI,
//   functionName: 'exactInputSingle',
//   args: [params],
// });

// Example usage with viem:
// import { createWalletClient, http } from 'viem';
// import { baseSepolia } from 'viem/chains';
// import { SwapRouterABI, SWAP_ROUTER_ADDRESS } from './abis/SwapRouter';
//
// const walletClient = createWalletClient({
//   chain: baseSepolia,
//   transport: http(),
// });
//
// const hash = await walletClient.writeContract({
//   address: SWAP_ROUTER_ADDRESS.BASE_SEPOLIA,
//   abi: SwapRouterABI,
//   functionName: 'exactInputSingle',
//   args: [params],
// });
