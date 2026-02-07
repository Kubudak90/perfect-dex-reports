/**
 * BaseBook DEX - Deployed Contract Addresses
 *
 * Chain: Base Sepolia Testnet
 * Deployment Date: 2026-02-03
 */

export const BASE_SEPOLIA_ADDRESSES = {
  PoolManager: '0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05',
  SwapRouter: '0xFf438e2d528F55fD1141382D1eB436201552d1A5',
  Quoter: '0x3e3D0d2cC349F42825B5cF58fd34d3bDFE25404b',
  PositionManager: '0xCf31fbdBD7A44ba1bCF99642E64a1d0B56a372bA',
  Permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3', // Canonical
} as const;

export const CHAIN_IDS = {
  BASE_SEPOLIA: 84532,
  BASE_MAINNET: 8453,
} as const;

/**
 * Get contract addresses for specific chain
 */
export function getAddresses(chainId: number) {
  switch (chainId) {
    case CHAIN_IDS.BASE_SEPOLIA:
      return BASE_SEPOLIA_ADDRESSES;
    case CHAIN_IDS.BASE_MAINNET:
      throw new Error('Mainnet not deployed yet');
    default:
      throw new Error(`Unsupported chain ID: ${chainId}`);
  }
}

/**
 * Export type for contract addresses
 */
export type ContractAddresses = typeof BASE_SEPOLIA_ADDRESSES;
