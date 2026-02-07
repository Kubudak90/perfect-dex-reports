/**
 * Test token fixtures
 */
export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
  logoURI?: string;
}

export const ETH: Token = {
  address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  symbol: 'ETH',
  name: 'Ethereum',
  decimals: 18,
  chainId: 8453,
};

export const USDC: Token = {
  address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  chainId: 8453,
};

export const WETH: Token = {
  address: '0x4200000000000000000000000000000000000006',
  symbol: 'WETH',
  name: 'Wrapped Ether',
  decimals: 18,
  chainId: 8453,
};

export const DAI: Token = {
  address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
  symbol: 'DAI',
  name: 'Dai Stablecoin',
  decimals: 18,
  chainId: 8453,
};

export const USDT: Token = {
  address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
  symbol: 'USDT',
  name: 'Tether USD',
  decimals: 6,
  chainId: 8453,
};

export const testTokens: Token[] = [ETH, USDC, WETH, DAI, USDT];

/**
 * Get token by symbol
 */
export function getTokenBySymbol(symbol: string): Token | undefined {
  return testTokens.find((t) => t.symbol === symbol);
}

/**
 * Mock token balances
 */
export interface TokenBalance {
  token: Token;
  balance: string;
  balanceUSD: string;
}

export const mockBalances: TokenBalance[] = [
  { token: ETH, balance: '10.5', balanceUSD: '25000' },
  { token: USDC, balance: '50000', balanceUSD: '50000' },
  { token: WETH, balance: '5', balanceUSD: '12000' },
  { token: DAI, balance: '10000', balanceUSD: '10000' },
  { token: USDT, balance: '5000', balanceUSD: '5000' },
];
