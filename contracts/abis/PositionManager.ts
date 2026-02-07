/**
 * PositionManager Contract ABI
 *
 * NFT-based liquidity position manager (ERC721)
 * Address (Base Sepolia): 0xCf31fbdBD7A44ba1bCF99642E64a1d0B56a372bA
 */

import abi from './PositionManager.json';

export const PositionManagerABI = abi as const;

export default PositionManagerABI;

// Type-safe contract address
export const POSITION_MANAGER_ADDRESS = {
  BASE_SEPOLIA: '0xCf31fbdBD7A44ba1bCF99642E64a1d0B56a372bA' as const,
} as const;

// Example usage with wagmi v2:
// import { useWriteContract } from 'wagmi';
// import { PositionManagerABI, POSITION_MANAGER_ADDRESS } from '@/abis/PositionManager';
//
// const { writeContract } = useWriteContract();
//
// await writeContract({
//   address: POSITION_MANAGER_ADDRESS.BASE_SEPOLIA,
//   abi: PositionManagerABI,
//   functionName: 'mint',
//   args: [mintParams],
// });

// Example usage with viem:
// import { createWalletClient, http } from 'viem';
// import { baseSepolia } from 'viem/chains';
// import { PositionManagerABI, POSITION_MANAGER_ADDRESS } from './abis/PositionManager';
//
// const walletClient = createWalletClient({
//   chain: baseSepolia,
//   transport: http(),
// });
//
// const hash = await walletClient.writeContract({
//   address: POSITION_MANAGER_ADDRESS.BASE_SEPOLIA,
//   abi: PositionManagerABI,
//   functionName: 'mint',
//   args: [mintParams],
// });
