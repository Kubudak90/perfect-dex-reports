import { Token } from '@/types/token';
import { CHAIN_IDS } from './chains';

/**
 * Native ETH token (used for native currency on all chains)
 */
export const NATIVE_TOKEN: Token = {
  address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  chainId: CHAIN_IDS.BASE,
  decimals: 18,
  symbol: 'ETH',
  name: 'Ethereum',
  isNative: true,
  isVerified: true,
  logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
};

/**
 * Common tokens on Base
 */
export const BASE_TOKENS: Token[] = [
  NATIVE_TOKEN,
  {
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    chainId: CHAIN_IDS.BASE,
    decimals: 6,
    symbol: 'USDC',
    name: 'USD Coin',
    isVerified: true,
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
  },
  {
    address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    chainId: CHAIN_IDS.BASE,
    decimals: 18,
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    isVerified: true,
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png',
  },
  {
    address: '0x4200000000000000000000000000000000000006',
    chainId: CHAIN_IDS.BASE,
    decimals: 18,
    symbol: 'WETH',
    name: 'Wrapped Ether',
    isVerified: true,
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
  },
  {
    address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
    chainId: CHAIN_IDS.BASE,
    decimals: 6,
    symbol: 'USDbC',
    name: 'USD Base Coin',
    isVerified: true,
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
  },
  {
    address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
    chainId: CHAIN_IDS.BASE,
    decimals: 18,
    symbol: 'cbETH',
    name: 'Coinbase Wrapped Staked ETH',
    isVerified: true,
    logoURI: 'https://assets.coingecko.com/coins/images/27008/large/cbeth.png',
  },
];

/**
 * Get default tokens for a chain
 */
export function getDefaultTokens(chainId: number): Token[] {
  switch (chainId) {
    case CHAIN_IDS.BASE:
      return BASE_TOKENS;
    case CHAIN_IDS.ARBITRUM:
      // TODO: Add Arbitrum tokens
      return [];
    case CHAIN_IDS.OPTIMISM:
      // TODO: Add Optimism tokens
      return [];
    default:
      return [];
  }
}

/**
 * Get native token for a chain
 */
export function getNativeToken(chainId: number): Token {
  return {
    ...NATIVE_TOKEN,
    chainId,
  };
}

/**
 * Check if token is native
 */
export function isNativeToken(token: Token): boolean {
  return (
    token.isNative === true ||
    token.address.toLowerCase() === NATIVE_TOKEN.address.toLowerCase()
  );
}

/**
 * Popular tokens (for quick selection)
 */
export const POPULAR_TOKENS = [
  'ETH',
  'USDC',
  'DAI',
  'WETH',
] as const;
