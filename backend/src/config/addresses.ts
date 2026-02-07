import type { Address } from 'viem';
import { validateEnv } from './env.js';
import { DEFAULT_CHAIN_ID } from './chains.js';

const env = validateEnv();

const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000';

export interface ContractAddresses {
  poolManager: Address;
  swapRouter: Address;
  positionManager: Address;
  quoter: Address;
  permit2: Address;
}

export interface HookAddresses {
  dynamicFeeHook: Address | null;
  oracleHook: Address | null;
  limitOrderHook: Address | null;
  mevProtectionHook: Address | null;
  twapOrderHook: Address | null;
  autoCompoundHook: Address | null;
}

function isZeroAddress(address: Address): boolean {
  return address.toLowerCase() === ZERO_ADDRESS.toLowerCase();
}

export const contractAddresses: Record<number, ContractAddresses> = {
  // Base Mainnet (Chain ID: 8453)
  8453: {
    poolManager: (env.POOL_MANAGER_ADDRESS_8453 || ZERO_ADDRESS) as Address,
    swapRouter: (env.SWAP_ROUTER_ADDRESS_8453 || ZERO_ADDRESS) as Address,
    positionManager: (env.POSITION_MANAGER_ADDRESS_8453 || ZERO_ADDRESS) as Address,
    quoter: (env.QUOTER_ADDRESS_8453 || ZERO_ADDRESS) as Address,
    permit2: env.PERMIT2_ADDRESS_8453 as Address,
  },
  // Base Sepolia Testnet (Chain ID: 84532)
  84532: {
    poolManager: env.POOL_MANAGER_ADDRESS_84532 as Address,
    swapRouter: env.SWAP_ROUTER_ADDRESS_84532 as Address,
    positionManager: env.POSITION_MANAGER_ADDRESS_84532 as Address,
    quoter: env.QUOTER_ADDRESS_84532 as Address,
    permit2: env.PERMIT2_ADDRESS_84532 as Address,
  },
  // Additional chains can be added here
  // 42161: { ... }, // Arbitrum
  // 10: { ... },     // Optimism
};

export function getContractAddresses(chainId: number): ContractAddresses {
  const addresses = contractAddresses[chainId];
  if (!addresses) {
    throw new Error(`No contract addresses configured for chain ID: ${chainId}`);
  }
  // Validate no zero addresses are returned at runtime
  for (const [name, address] of Object.entries(addresses)) {
    if (isZeroAddress(address as Address)) {
      throw new Error(
        `Contract address "${name}" is the zero address for chain ID ${chainId}. ` +
        `Sending funds to the zero address would result in permanent loss. ` +
        `Set the corresponding environment variable to a valid contract address.`
      );
    }
  }
  return addresses;
}

/**
 * Validates that all contract addresses for the active chain are non-zero.
 * Call this at server startup to fail fast if critical addresses are misconfigured.
 * Prevents user funds from being sent to the zero address and permanently lost.
 */
export function validateAddresses(chainId: number = DEFAULT_CHAIN_ID): void {
  const addresses = contractAddresses[chainId];
  if (!addresses) {
    throw new Error(
      `No contract addresses configured for chain ID: ${chainId}. ` +
      `Cannot start server without valid contract addresses.`
    );
  }

  const zeroAddressFields: string[] = [];

  for (const [name, address] of Object.entries(addresses)) {
    if (isZeroAddress(address as Address)) {
      zeroAddressFields.push(name);
    }
  }

  if (zeroAddressFields.length > 0) {
    throw new Error(
      `FATAL: Zero address detected for chain ID ${chainId}. ` +
      `The following contract addresses are set to the zero address: ${zeroAddressFields.join(', ')}. ` +
      `User funds sent to the zero address are permanently lost. ` +
      `Set the required environment variables before starting the server.`
    );
  }

  // Also validate hook addresses if they exist for this chain
  const hooks = hookAddresses[chainId];
  if (hooks) {
    const zeroHookFields: string[] = [];
    for (const [name, address] of Object.entries(hooks)) {
      if (address !== null && isZeroAddress(address as Address)) {
        zeroHookFields.push(name);
      }
    }
    if (zeroHookFields.length > 0) {
      throw new Error(
        `FATAL: Zero address detected in hook addresses for chain ID ${chainId}. ` +
        `The following hook addresses are set to the zero address: ${zeroHookFields.join(', ')}. ` +
        `Set the required environment variables or leave hooks as null if not deployed.`
      );
    }
  }
}

export const hookAddresses: Record<number, HookAddresses> = {
  // Base Mainnet (Chain ID: 8453) - Not yet deployed
  8453: {
    dynamicFeeHook: null,
    oracleHook: null,
    limitOrderHook: null,
    mevProtectionHook: null,
    twapOrderHook: null,
    autoCompoundHook: null,
  },
  // Base Sepolia Testnet (Chain ID: 84532) - DEPLOYED 2026-02-05
  84532: {
    dynamicFeeHook: (env.DYNAMIC_FEE_HOOK_ADDRESS_84532 || '0xd3424b4EeAE62dD38701Fbd910cE18007f9A276B') as Address,
    oracleHook: (env.ORACLE_HOOK_ADDRESS_84532 || '0x50bcED57635B8c0Cf5603E5Fa30DfAaB3d2c27EA') as Address,
    limitOrderHook: (env.LIMIT_ORDER_HOOK_ADDRESS_84532 || '0x5a02aFA3c286559D696250898c7a47D4F9d6a7AC') as Address,
    mevProtectionHook: (env.MEV_PROTECTION_HOOK_ADDRESS_84532 || '0xEbf84b06eBE6492FF89bfc1E68fD8eC9E540Fb40') as Address,
    twapOrderHook: (env.TWAP_ORDER_HOOK_ADDRESS_84532 || '0x94C3541740d13c175615608314aAcC3b136a6781') as Address,
    autoCompoundHook: (env.AUTO_COMPOUND_HOOK_ADDRESS_84532 || '0x879CA2181056F1d2BB84C5579CBb65BE22c0b71B') as Address,
  },
};

export function getHookAddresses(chainId: number): HookAddresses {
  const addresses = hookAddresses[chainId];
  if (!addresses) {
    throw new Error(`No hook addresses configured for chain ID: ${chainId}`);
  }
  return addresses;
}
