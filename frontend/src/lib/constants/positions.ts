import { Position } from '@/types/pool';
import { getMockPoolById } from './pools';

/**
 * @deprecated Use the usePositions hook from '@/hooks/liquidity/usePositions' instead.
 * This function returns hardcoded mock data and should not be used in production.
 * Retained temporarily for the position detail page ([tokenId]/page.tsx) which
 * has not yet been migrated.
 */
export function getMockPositions(userAddress?: string): Position[] {
  // For demo purposes, show positions regardless of address
  const pool1 = getMockPoolById('0x1111111111111111111111111111111111111111111111111111111111111111')!;
  const pool2 = getMockPoolById('0x2222222222222222222222222222222222222222222222222222222222222222')!;
  const pool3 = getMockPoolById('0x3333333333333333333333333333333333333333333333333333333333333333')!;

  const defaultAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' as `0x${string}`;

  return [
    // Position 1: ETH/USDC 0.05% - In Range
    {
      tokenId: 1001,
      owner: (userAddress as `0x${string}`) || defaultAddress,
      chainId: 8453,
      poolId: pool1.id,
      tickLower: 80000,
      tickUpper: 80500,
      liquidity: '1234567890123456789',
      amount0: '500000000000000000', // 0.5 ETH
      amount1: '1225000000', // 1,225 USDC (6 decimals)
      unclaimedFees0: '5000000000000000', // 0.005 ETH
      unclaimedFees1: '12250000', // 12.25 USDC
      inRange: true,
    },

    // Position 2: ETH/USDC 0.3% - In Range
    {
      tokenId: 1002,
      owner: (userAddress as `0x${string}`) || defaultAddress,
      chainId: 8453,
      poolId: pool2.id,
      tickLower: 79500,
      tickUpper: 81000,
      liquidity: '2345678901234567890',
      amount0: '2000000000000000000', // 2.0 ETH
      amount1: '4900000000', // 4,900 USDC
      unclaimedFees0: '25000000000000000', // 0.025 ETH
      unclaimedFees1: '61250000', // 61.25 USDC
      inRange: true,
    },

    // Position 3: USDC/DAI 0.01% - In Range
    {
      tokenId: 1003,
      owner: (userAddress as `0x${string}`) || defaultAddress,
      chainId: 8453,
      poolId: pool3.id,
      tickLower: -100,
      tickUpper: 100,
      liquidity: '5000000000000000000000',
      amount0: '5000000000', // 5,000 USDC
      amount1: '5000000000000000000000', // 5,000 DAI (18 decimals)
      unclaimedFees0: '1500000', // 1.5 USDC
      unclaimedFees1: '1500000000000000000', // 1.5 DAI
      inRange: true,
    },

    // Position 4: ETH/USDC 0.05% - Out of Range
    {
      tokenId: 1004,
      owner: (userAddress as `0x${string}`) || defaultAddress,
      chainId: 8453,
      poolId: pool1.id,
      tickLower: 82000,
      tickUpper: 82500,
      liquidity: '987654321098765432',
      amount0: '0', // All in token1 (out of range above)
      amount1: '1000000000', // 1,000 USDC
      unclaimedFees0: '0',
      unclaimedFees1: '500000', // 0.5 USDC (earned before going out of range)
      inRange: false,
    },
  ];
}

/**
 * @deprecated Use the backend API endpoint GET /v1/positions/id/:tokenId instead.
 * Retained temporarily for the position detail page.
 */
export function getMockPositionById(tokenId: number): Position | undefined {
  return getMockPositions().find((p) => p.tokenId === tokenId);
}

/**
 * Position history item
 */
export interface PositionHistoryItem {
  id: string;
  type: 'mint' | 'burn' | 'collect' | 'increase' | 'decrease';
  timestamp: number;
  amount0?: string;
  amount1?: string;
  fees0?: string;
  fees1?: string;
  txHash: string;
}

/**
 * @deprecated Use real transaction history from the backend/indexer instead.
 * Retained temporarily for the position detail page.
 */
export function getMockPositionHistory(tokenId: number): PositionHistoryItem[] {
  const now = Date.now();

  return [
    {
      id: 'hist-1',
      type: 'mint',
      timestamp: now - 30 * 24 * 60 * 60 * 1000, // 30 days ago
      amount0: '500000000000000000',
      amount1: '1225000000',
      txHash: '0x1234567890abcdef',
    },
    {
      id: 'hist-2',
      type: 'collect',
      timestamp: now - 15 * 24 * 60 * 60 * 1000, // 15 days ago
      fees0: '2500000000000000',
      fees1: '6125000',
      txHash: '0x2345678901bcdefg',
    },
    {
      id: 'hist-3',
      type: 'increase',
      timestamp: now - 7 * 24 * 60 * 60 * 1000, // 7 days ago
      amount0: '100000000000000000',
      amount1: '245000000',
      txHash: '0x3456789012cdefgh',
    },
    {
      id: 'hist-4',
      type: 'collect',
      timestamp: now - 2 * 24 * 60 * 60 * 1000, // 2 days ago
      fees0: '1500000000000000',
      fees1: '3675000',
      txHash: '0x456789013defghij',
    },
  ];
}

/**
 * Calculate position PnL (simplified)
 */
export interface PositionPnL {
  // Initial investment
  initialValueUsd: number;

  // Current value
  currentValueUsd: number;

  // Fees earned
  feesEarnedUsd: number;

  // Impermanent loss
  impermanentLossUsd: number;
  impermanentLossPercent: number;

  // Net PnL
  netPnlUsd: number;
  netPnlPercent: number;

  // ROI
  roi: number;
}

export function calculatePositionPnL(
  position: Position,
  token0PriceUsd: number,
  token1PriceUsd: number,
  token0Decimals: number,
  token1Decimals: number
): PositionPnL {
  // Current amounts in USD
  const amount0Usd = (Number(position.amount0) / 10 ** token0Decimals) * token0PriceUsd;
  const amount1Usd = (Number(position.amount1) / 10 ** token1Decimals) * token1PriceUsd;
  const currentValueUsd = amount0Usd + amount1Usd;

  // Fees earned in USD
  const fees0Usd = (Number(position.unclaimedFees0) / 10 ** token0Decimals) * token0PriceUsd;
  const fees1Usd = (Number(position.unclaimedFees1) / 10 ** token1Decimals) * token1PriceUsd;
  const feesEarnedUsd = fees0Usd + fees1Usd;

  // For simplicity, assume initial value = current value (no price change)
  // In reality, you'd need to track initial deposit amounts
  const initialValueUsd = currentValueUsd * 0.95; // Assume 5% IL for demo

  // Impermanent loss (simplified - actual calculation is more complex)
  const impermanentLossUsd = currentValueUsd - initialValueUsd;
  const impermanentLossPercent = (impermanentLossUsd / initialValueUsd) * 100;

  // Net PnL = Current Value + Fees - Initial Value
  const netPnlUsd = currentValueUsd + feesEarnedUsd - initialValueUsd;
  const netPnlPercent = (netPnlUsd / initialValueUsd) * 100;

  // ROI
  const roi = ((currentValueUsd + feesEarnedUsd - initialValueUsd) / initialValueUsd) * 100;

  return {
    initialValueUsd,
    currentValueUsd,
    feesEarnedUsd,
    impermanentLossUsd,
    impermanentLossPercent,
    netPnlUsd,
    netPnlPercent,
    roi,
  };
}

/**
 * Portfolio summary
 */
export interface PortfolioSummary {
  totalValueUsd: number;
  totalFeesEarnedUsd: number;
  totalPnlUsd: number;
  totalPnlPercent: number;
  activePositions: number;
  inactivePositions: number;
}

export function calculatePortfolioSummary(positions: Position[]): PortfolioSummary {
  // Mock prices for calculation
  const ethPrice = 2450;
  const usdcPrice = 1;
  const daiPrice = 1;

  let totalValueUsd = 0;
  let totalFeesEarnedUsd = 0;
  let totalPnlUsd = 0;
  let activePositions = 0;
  let inactivePositions = 0;

  positions.forEach((position) => {
    // Determine token decimals and prices based on pool
    // This is simplified - in reality you'd look up pool details
    let token0Price = ethPrice;
    let token1Price = usdcPrice;
    let token0Decimals = 18;
    let token1Decimals = 6;

    // Calculate PnL
    const pnl = calculatePositionPnL(
      position,
      token0Price,
      token1Price,
      token0Decimals,
      token1Decimals
    );

    totalValueUsd += pnl.currentValueUsd;
    totalFeesEarnedUsd += pnl.feesEarnedUsd;
    totalPnlUsd += pnl.netPnlUsd;

    if (position.inRange) {
      activePositions++;
    } else {
      inactivePositions++;
    }
  });

  const totalInitialValue = totalValueUsd * 0.95; // Simplified
  const totalPnlPercent = totalInitialValue > 0 ? (totalPnlUsd / totalInitialValue) * 100 : 0;

  return {
    totalValueUsd,
    totalFeesEarnedUsd,
    totalPnlUsd,
    totalPnlPercent,
    activePositions,
    inactivePositions,
  };
}
