import { Address } from 'viem';
import { CHAIN_IDS } from './chains';

/**
 * Contract addresses for BaseBook DEX
 *
 * TODO: Post-deployment checklist:
 * 1. Update Arbitrum addresses after deployment
 * 2. Update Optimism addresses after deployment
 * 3. Verify all addresses on block explorers
 * 4. Remove placeholder (0x000...) addresses once deployed
 */

type AddressMap = Record<number, Address>;

// Placeholder address constant for undeployed contracts
const PLACEHOLDER_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

/**
 * Pool Manager (Singleton) addresses
 * Deployed on Base Sepolia testnet
 */
export const POOL_MANAGER_ADDRESSES: AddressMap = {
  [CHAIN_IDS.BASE]: '0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05', // Base Sepolia deployment
  // TODO: Update after Arbitrum deployment - contract not yet deployed
  [CHAIN_IDS.ARBITRUM]: PLACEHOLDER_ADDRESS,
  // TODO: Update after Optimism deployment - contract not yet deployed
  [CHAIN_IDS.OPTIMISM]: PLACEHOLDER_ADDRESS,
};

/**
 * Swap Router addresses
 * Deployed on Base Sepolia testnet
 */
export const SWAP_ROUTER_ADDRESSES: AddressMap = {
  [CHAIN_IDS.BASE]: '0xFf438e2d528F55fD1141382D1eB436201552d1A5', // Base Sepolia deployment
  // TODO: Update after Arbitrum deployment - contract not yet deployed
  [CHAIN_IDS.ARBITRUM]: PLACEHOLDER_ADDRESS,
  // TODO: Update after Optimism deployment - contract not yet deployed
  [CHAIN_IDS.OPTIMISM]: PLACEHOLDER_ADDRESS,
};

/**
 * Position Manager (NFT) addresses
 * Deployed on Base Sepolia testnet
 */
export const POSITION_MANAGER_ADDRESSES: AddressMap = {
  [CHAIN_IDS.BASE]: '0xCf31fbdBD7A44ba1bCF99642E64a1d0B56a372bA', // Base Sepolia deployment
  // TODO: Update after Arbitrum deployment - contract not yet deployed
  [CHAIN_IDS.ARBITRUM]: PLACEHOLDER_ADDRESS,
  // TODO: Update after Optimism deployment - contract not yet deployed
  [CHAIN_IDS.OPTIMISM]: PLACEHOLDER_ADDRESS,
};

/**
 * Quoter addresses
 * Deployed on Base Sepolia testnet
 */
export const QUOTER_ADDRESSES: AddressMap = {
  [CHAIN_IDS.BASE]: '0x3e3D0d2cC349F42825B5cF58fd34d3bDFE25404b', // Base Sepolia deployment
  // TODO: Update after Arbitrum deployment - contract not yet deployed
  [CHAIN_IDS.ARBITRUM]: PLACEHOLDER_ADDRESS,
  // TODO: Update after Optimism deployment - contract not yet deployed
  [CHAIN_IDS.OPTIMISM]: PLACEHOLDER_ADDRESS,
};

/**
 * Permit2 addresses (Uniswap's universal approval contract)
 */
export const PERMIT2_ADDRESSES: AddressMap = {
  [CHAIN_IDS.BASE]: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  [CHAIN_IDS.ARBITRUM]: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  [CHAIN_IDS.OPTIMISM]: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
};

/**
 * Helper function to get contract address by chain ID
 * @throws Error if contract is not deployed (placeholder address)
 */
export function getContractAddress(
  addresses: AddressMap,
  chainId: number
): Address {
  const address = addresses[chainId];
  if (!address || address === PLACEHOLDER_ADDRESS) {
    throw new Error(`Contract not deployed on chain ${chainId}`);
  }
  return address;
}

/**
 * Check if a contract is deployed on a specific chain
 */
export function isContractDeployed(
  addresses: AddressMap,
  chainId: number
): boolean {
  const address = addresses[chainId];
  return !!address && address !== PLACEHOLDER_ADDRESS;
}
