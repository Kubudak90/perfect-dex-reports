import { Address } from 'viem';
import { CHAIN_IDS } from './chains';

/**
 * Hook contract addresses for BaseBook DEX
 *
 * Each hook provides specific functionality that can be attached to pools:
 * - DynamicFeeHook: Adjusts fees based on volatility (0.01% - 1%)
 * - OracleHook: Provides TWAP price oracle
 * - LimitOrderHook: On-chain limit orders
 * - MEVProtectionHook: Sandwich attack protection
 * - TWAPOrderHook: Time-weighted average price orders
 * - AutoCompoundHook: Automatic LP fee compounding
 */

type HookAddressMap = Record<number, Address>;

// Placeholder for undeployed hooks
const PLACEHOLDER_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

/**
 * DynamicFeeHook - Volatility-based fee adjustment
 */
export const DYNAMIC_FEE_HOOK_ADDRESSES: HookAddressMap = {
  [CHAIN_IDS.BASE]: '0xd3424b4EeAE62dD38701Fbd910cE18007f9A276B', // Base Sepolia
  [CHAIN_IDS.ARBITRUM]: PLACEHOLDER_ADDRESS,
  [CHAIN_IDS.OPTIMISM]: PLACEHOLDER_ADDRESS,
};

/**
 * OracleHook - TWAP price oracle
 */
export const ORACLE_HOOK_ADDRESSES: HookAddressMap = {
  [CHAIN_IDS.BASE]: '0x50bcED57635B8c0Cf5603E5Fa30DfAaB3d2c27EA', // Base Sepolia
  [CHAIN_IDS.ARBITRUM]: PLACEHOLDER_ADDRESS,
  [CHAIN_IDS.OPTIMISM]: PLACEHOLDER_ADDRESS,
};

/**
 * LimitOrderHook - On-chain limit orders
 */
export const LIMIT_ORDER_HOOK_ADDRESSES: HookAddressMap = {
  [CHAIN_IDS.BASE]: '0x5a02aFA3c286559D696250898c7a47D4F9d6a7AC', // Base Sepolia
  [CHAIN_IDS.ARBITRUM]: PLACEHOLDER_ADDRESS,
  [CHAIN_IDS.OPTIMISM]: PLACEHOLDER_ADDRESS,
};

/**
 * MEVProtectionHook - Sandwich attack protection
 */
export const MEV_PROTECTION_HOOK_ADDRESSES: HookAddressMap = {
  [CHAIN_IDS.BASE]: '0xEbf84b06eBE6492FF89bfc1E68fD8eC9E540Fb40', // Base Sepolia
  [CHAIN_IDS.ARBITRUM]: PLACEHOLDER_ADDRESS,
  [CHAIN_IDS.OPTIMISM]: PLACEHOLDER_ADDRESS,
};

/**
 * TWAPOrderHook - Time-weighted average price orders
 */
export const TWAP_ORDER_HOOK_ADDRESSES: HookAddressMap = {
  [CHAIN_IDS.BASE]: '0x94C3541740d13c175615608314aAcC3b136a6781', // Base Sepolia
  [CHAIN_IDS.ARBITRUM]: PLACEHOLDER_ADDRESS,
  [CHAIN_IDS.OPTIMISM]: PLACEHOLDER_ADDRESS,
};

/**
 * AutoCompoundHook - Automatic LP fee compounding
 */
export const AUTO_COMPOUND_HOOK_ADDRESSES: HookAddressMap = {
  [CHAIN_IDS.BASE]: '0x879CA2181056F1d2BB84C5579CBb65BE22c0b71B', // Base Sepolia
  [CHAIN_IDS.ARBITRUM]: PLACEHOLDER_ADDRESS,
  [CHAIN_IDS.OPTIMISM]: PLACEHOLDER_ADDRESS,
};

/**
 * All hooks in a single object for convenience
 */
export const HOOK_ADDRESSES = {
  DynamicFeeHook: DYNAMIC_FEE_HOOK_ADDRESSES,
  OracleHook: ORACLE_HOOK_ADDRESSES,
  LimitOrderHook: LIMIT_ORDER_HOOK_ADDRESSES,
  MEVProtectionHook: MEV_PROTECTION_HOOK_ADDRESSES,
  TWAPOrderHook: TWAP_ORDER_HOOK_ADDRESSES,
  AutoCompoundHook: AUTO_COMPOUND_HOOK_ADDRESSES,
} as const;

/**
 * Hook types enum
 */
export enum HookType {
  DynamicFee = 'DynamicFeeHook',
  Oracle = 'OracleHook',
  LimitOrder = 'LimitOrderHook',
  MEVProtection = 'MEVProtectionHook',
  TWAPOrder = 'TWAPOrderHook',
  AutoCompound = 'AutoCompoundHook',
}

/**
 * Hook metadata for UI display
 */
export const HOOK_METADATA: Record<HookType, {
  name: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  icon: string;
}> = {
  [HookType.DynamicFee]: {
    name: 'Dynamic Fee',
    description: 'Adjusts swap fees based on pool volatility (0.01% - 1%)',
    priority: 'high',
    icon: '📊',
  },
  [HookType.Oracle]: {
    name: 'TWAP Oracle',
    description: 'Provides time-weighted average price for the pool',
    priority: 'high',
    icon: '🔮',
  },
  [HookType.LimitOrder]: {
    name: 'Limit Orders',
    description: 'Place on-chain limit orders that execute automatically',
    priority: 'medium',
    icon: '📝',
  },
  [HookType.MEVProtection]: {
    name: 'MEV Protection',
    description: 'Protects against sandwich attacks and MEV extraction',
    priority: 'medium',
    icon: '🛡️',
  },
  [HookType.TWAPOrder]: {
    name: 'TWAP Orders',
    description: 'Execute large orders over time to reduce market impact',
    priority: 'low',
    icon: '⏱️',
  },
  [HookType.AutoCompound]: {
    name: 'Auto Compound',
    description: 'Automatically reinvest earned fees into your position',
    priority: 'low',
    icon: '🔄',
  },
};

/**
 * Get hook address by type and chain
 */
export function getHookAddress(hookType: HookType, chainId: number): Address | null {
  const addresses = HOOK_ADDRESSES[hookType];
  const address = addresses?.[chainId];

  if (!address || address === PLACEHOLDER_ADDRESS) {
    return null;
  }

  return address;
}

/**
 * Check if a hook is deployed on a specific chain
 */
export function isHookDeployed(hookType: HookType, chainId: number): boolean {
  return getHookAddress(hookType, chainId) !== null;
}

/**
 * Get all available hooks for a chain
 */
export function getAvailableHooks(chainId: number): HookType[] {
  return Object.values(HookType).filter(hookType => isHookDeployed(hookType, chainId));
}
