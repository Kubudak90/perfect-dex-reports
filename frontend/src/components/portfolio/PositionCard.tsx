'use client';

import { Position } from '@/types/pool';
import { getMockPoolById } from '@/lib/constants/pools';
import { calculatePositionPnL } from '@/lib/constants/positions';
import { TokenPairLogo } from '@/components/common/TokenLogo';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { useRouter } from 'next/navigation';
import { TrendingUp, TrendingDown, DollarSign, Droplets } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { ApiPositionPool } from '@/hooks/liquidity/usePositions';

/**
 * Pool display info that PositionCard needs for rendering.
 * Can be supplied directly from the API (poolInfo prop) or
 * looked up from legacy mock data as a fallback.
 */
interface PoolDisplayInfo {
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
  token0LogoURI?: string;
  token1LogoURI?: string;
  feeTier: number;
}

interface PositionCardProps {
  position: Position;
  /** Pool info from the API. When provided, the card skips the mock pool lookup. */
  poolInfo?: ApiPositionPool;
  className?: string;
}

function resolvePoolDisplay(
  position: Position,
  poolInfo?: ApiPositionPool
): PoolDisplayInfo | null {
  if (poolInfo) {
    return {
      token0Symbol: poolInfo.token0.symbol,
      token1Symbol: poolInfo.token1.symbol,
      token0Decimals: poolInfo.token0.decimals,
      token1Decimals: poolInfo.token1.decimals,
      feeTier: poolInfo.feeTier,
      // The positions API does not include logo URIs; leave undefined
      token0LogoURI: undefined,
      token1LogoURI: undefined,
    };
  }
  // Fallback: legacy mock pool lookup (for callers that haven't migrated yet)
  const mockPool = getMockPoolById(position.poolId);
  if (!mockPool) return null;
  return {
    token0Symbol: mockPool.token0Symbol,
    token1Symbol: mockPool.token1Symbol,
    token0Decimals: mockPool.token0Decimals,
    token1Decimals: mockPool.token1Decimals,
    token0LogoURI: mockPool.token0LogoURI,
    token1LogoURI: mockPool.token1LogoURI,
    feeTier: mockPool.feeTier,
  };
}

export function PositionCard({ position, poolInfo, className }: PositionCardProps) {
  const router = useRouter();
  const pool = resolvePoolDisplay(position, poolInfo);

  if (!pool) {
    return null;
  }

  // Calculate PnL (using mock prices)
  const pnl = calculatePositionPnL(
    position,
    pool.token0Symbol === 'ETH' ? 2450 : 1, // Mock price
    pool.token1Symbol === 'USDC' ? 1 : 1, // Mock price
    pool.token0Decimals,
    pool.token1Decimals
  );

  const handleClick = () => {
    router.push(`/positions/${position.tokenId}`);
  };

  const amount0Formatted = formatNumber(
    Number(position.amount0) / 10 ** pool.token0Decimals,
    6
  );
  const amount1Formatted = formatNumber(
    Number(position.amount1) / 10 ** pool.token1Decimals,
    2
  );

  const fees0Formatted = formatNumber(
    Number(position.unclaimedFees0) / 10 ** pool.token0Decimals,
    6
  );
  const fees1Formatted = formatNumber(
    Number(position.unclaimedFees1) / 10 ** pool.token1Decimals,
    2
  );

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface hover:bg-surface-secondary transition-all cursor-pointer',
        className
      )}
      onClick={handleClick}
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <TokenPairLogo
              token0Logo={pool.token0LogoURI}
              token1Logo={pool.token1LogoURI}
              token0Symbol={pool.token0Symbol}
              token1Symbol={pool.token1Symbol}
              size={40}
            />
            <div>
              <div className="font-semibold text-lg">
                {pool.token0Symbol}/{pool.token1Symbol}
              </div>
              <div className="text-sm text-muted-foreground">
                {pool.feeTier / 10000}% • #{position.tokenId}
              </div>
            </div>
          </div>

          <div
            className={cn(
              'px-3 py-1 rounded-full text-sm font-medium',
              position.inRange
                ? 'bg-green-500/10 text-green-500'
                : 'bg-orange-500/10 text-orange-500'
            )}
          >
            {position.inRange ? 'In Range' : 'Out of Range'}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 space-y-4">
        {/* Value & PnL */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
              <Droplets className="h-3.5 w-3.5" />
              Total Value
            </div>
            <div className="text-xl font-bold">
              {formatCurrency(pnl.currentValueUsd)}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
              {pnl.netPnlUsd >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              Net PnL
            </div>
            <div
              className={cn(
                'text-xl font-bold',
                pnl.netPnlUsd >= 0 ? 'text-green-500' : 'text-red-500'
              )}
            >
              {pnl.netPnlUsd >= 0 ? '+' : ''}
              {formatCurrency(pnl.netPnlUsd)}
            </div>
            <div
              className={cn(
                'text-xs',
                pnl.netPnlPercent >= 0 ? 'text-green-500' : 'text-red-500'
              )}
            >
              {pnl.netPnlPercent >= 0 ? '+' : ''}
              {formatPercent(pnl.netPnlPercent)}
            </div>
          </div>
        </div>

        {/* Amounts */}
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="text-sm text-muted-foreground mb-1">Deposited</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-sm">
              <span className="font-medium">{amount0Formatted}</span>{' '}
              <span className="text-muted-foreground">{pool.token0Symbol}</span>
            </div>
            <div className="text-sm">
              <span className="font-medium">{amount1Formatted}</span>{' '}
              <span className="text-muted-foreground">{pool.token1Symbol}</span>
            </div>
          </div>
        </div>

        {/* Fees */}
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5" />
              Unclaimed Fees
            </div>
            <div className="text-sm font-semibold text-green-500">
              {formatCurrency(pnl.feesEarnedUsd)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>
              {fees0Formatted} {pool.token0Symbol}
            </div>
            <div>
              {fees1Formatted} {pool.token1Symbol}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 border-t border-border">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/positions/${position.tokenId}`);
            }}
            variant="secondary"
            size="sm"
            className="w-full"
          >
            Manage Position
          </Button>
        </div>
      </div>
    </div>
  );
}
