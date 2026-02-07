/**
 * Quoter Contract ABI
 *
 * Off-chain price quotes for swaps (view functions)
 * Address (Base Sepolia): 0x3e3D0d2cC349F42825B5cF58fd34d3bDFE25404b
 */

import abi from './Quoter.json';

export const QuoterABI = abi as const;

export default QuoterABI;

// Type-safe contract address
export const QUOTER_ADDRESS = {
  BASE_SEPOLIA: '0x3e3D0d2cC349F42825B5cF58fd34d3bDFE25404b' as const,
} as const;

// Example usage with wagmi v2:
// import { useReadContract } from 'wagmi';
// import { QuoterABI, QUOTER_ADDRESS } from '@/abis/Quoter';
//
// const { data: quote } = useReadContract({
//   address: QUOTER_ADDRESS.BASE_SEPOLIA,
//   abi: QuoterABI,
//   functionName: 'quoteExactInputSingle',
//   args: [quoteParams],
// });

// Example usage with viem:
// import { createPublicClient, http } from 'viem';
// import { baseSepolia } from 'viem/chains';
// import { QuoterABI, QUOTER_ADDRESS } from './abis/Quoter';
//
// const client = createPublicClient({
//   chain: baseSepolia,
//   transport: http(),
// });
//
// const quote = await client.readContract({
//   address: QUOTER_ADDRESS.BASE_SEPOLIA,
//   abi: QuoterABI,
//   functionName: 'quoteExactInputSingle',
//   args: [quoteParams],
// });
