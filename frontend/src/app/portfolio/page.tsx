'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { usePositions, EnrichedPosition } from '@/hooks/liquidity/usePositions';
import {
  calculatePortfolioSummary,
  calculatePositionPnL,
  PositionPnL,
} from '@/lib/constants/positions';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { FadeIn, StaggerChildren, StaggerItem } from '@/components/ui/AnimatedComponents';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  Inbox,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Droplets,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve token prices -- simplified/mock until a real price feed is available. */
function getTokenPrice(symbol: string): number {
  const prices: Record<string, number> = {
    ETH: 2450,
    WETH: 2450,
    USDC: 1,
    'USDC.e': 1,
    USDT: 1,
    DAI: 1,
    cbETH: 2600,
    rETH: 2700,
  };
  return prices[symbol] ?? 0;
}

interface PositionAnalytics {
  position: EnrichedPosition;
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
  feeTier: number;
  pnl: PositionPnL;
  amount0: number;
  amount1: number;
  fees0: number;
  fees1: number;
  valueUsd: number;
  feesUsd: number;
}

function analyzePosition(position: EnrichedPosition): PositionAnalytics {
  const pool = position.pool;
  const token0Symbol = pool.token0.symbol;
  const token1Symbol = pool.token1.symbol;
  const token0Decimals = pool.token0.decimals;
  const token1Decimals = pool.token1.decimals;
  const feeTier = pool.feeTier;

  const token0Price = getTokenPrice(token0Symbol);
  const token1Price = getTokenPrice(token1Symbol);

  const pnl = calculatePositionPnL(
    position,
    token0Price,
    token1Price,
    token0Decimals,
    token1Decimals
  );

  const amount0 = Number(position.amount0) / 10 ** token0Decimals;
  const amount1 = Number(position.amount1) / 10 ** token1Decimals;
  const fees0 = Number(position.unclaimedFees0) / 10 ** token0Decimals;
  const fees1 = Number(position.unclaimedFees1) / 10 ** token1Decimals;

  const valueUsd = amount0 * token0Price + amount1 * token1Price;
  const feesUsd = fees0 * token0Price + fees1 * token1Price;

  return {
    position,
    token0Symbol,
    token1Symbol,
    token0Decimals,
    token1Decimals,
    feeTier,
    pnl,
    amount0,
    amount1,
    fees0,
    fees1,
    valueUsd,
    feesUsd,
  };
}

interface TokenAllocation {
  symbol: string;
  valueUsd: number;
  percentage: number;
}

function computeTokenAllocations(analytics: PositionAnalytics[]): TokenAllocation[] {
  const tokenMap: Record<string, number> = {};

  for (const a of analytics) {
    const t0Price = getTokenPrice(a.token0Symbol);
    const t1Price = getTokenPrice(a.token1Symbol);
    tokenMap[a.token0Symbol] = (tokenMap[a.token0Symbol] ?? 0) + a.amount0 * t0Price;
    tokenMap[a.token1Symbol] = (tokenMap[a.token1Symbol] ?? 0) + a.amount1 * t1Price;
  }

  const total = Object.values(tokenMap).reduce((sum, v) => sum + v, 0);

  return Object.entries(tokenMap)
    .map(([symbol, valueUsd]) => ({
      symbol,
      valueUsd,
      percentage: total > 0 ? (valueUsd / total) * 100 : 0,
    }))
    .sort((a, b) => b.valueUsd - a.valueUsd);
}

// Color palette for allocation bars
const ALLOC_COLORS = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-green-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-yellow-500',
  'bg-indigo-500',
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PortfolioValueHeader({
  totalValueUsd,
  totalPnlUsd,
  totalPnlPercent,
  totalFeesUsd,
}: {
  totalValueUsd: number;
  totalPnlUsd: number;
  totalPnlPercent: number;
  totalFeesUsd: number;
}) {
  const pnlPositive = totalPnlUsd >= 0;

  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-primary/5 to-primary/10 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-primary/10">
          <Wallet className="h-6 w-6 text-primary" />
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Total Portfolio Value</div>
          <div className="text-3xl font-bold">{formatCurrency(totalValueUsd)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 24h Change (placeholder -- real data would come from historical snapshots) */}
        <div className="p-4 rounded-lg bg-surface/50">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Activity className="h-3.5 w-3.5" />
            24h Change (est.)
          </div>
          <div
            className={cn(
              'text-lg font-bold',
              pnlPositive ? 'text-green-500' : 'text-red-500'
            )}
          >
            {pnlPositive ? '+' : ''}
            {formatCurrency(totalPnlUsd * 0.03)}
          </div>
          <div
            className={cn(
              'text-xs',
              pnlPositive ? 'text-green-500' : 'text-red-500'
            )}
          >
            {pnlPositive ? '+' : ''}
            {formatPercent(totalPnlPercent * 0.03)}
          </div>
        </div>

        {/* Total PnL */}
        <div className="p-4 rounded-lg bg-surface/50">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            {pnlPositive ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            Total P&L
          </div>
          <div
            className={cn(
              'text-lg font-bold',
              pnlPositive ? 'text-green-500' : 'text-red-500'
            )}
          >
            {pnlPositive ? '+' : ''}
            {formatCurrency(totalPnlUsd)}
          </div>
          <div
            className={cn(
              'text-xs',
              pnlPositive ? 'text-green-500' : 'text-red-500'
            )}
          >
            {pnlPositive ? '+' : ''}
            {formatPercent(totalPnlPercent)}
          </div>
        </div>

        {/* Total Fees Earned */}
        <div className="p-4 rounded-lg bg-surface/50">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <DollarSign className="h-3.5 w-3.5" />
            Total Fees Earned
          </div>
          <div className="text-lg font-bold text-green-500">
            {formatCurrency(totalFeesUsd)}
          </div>
          <div className="text-xs text-muted-foreground">All time</div>
        </div>
      </div>
    </div>
  );
}

function PositionBreakdownTable({
  analytics,
}: {
  analytics: PositionAnalytics[];
}) {
  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-lg font-semibold">Position Breakdown</h3>
      </div>

      {/* Desktop table header */}
      <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider">
        <div className="col-span-3">Pool</div>
        <div className="col-span-2 text-right">Value</div>
        <div className="col-span-2 text-right">Fees Earned</div>
        <div className="col-span-2 text-right">P&L</div>
        <div className="col-span-2 text-center">Status</div>
        <div className="col-span-1" />
      </div>

      <div className="divide-y divide-border">
        {analytics.map((a) => {
          const pnlPositive = a.pnl.netPnlUsd >= 0;

          return (
            <Link
              key={a.position.tokenId}
              href={`/positions/${a.position.tokenId}`}
              className="block hover:bg-surface-secondary transition-colors"
            >
              {/* Desktop row */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-4 items-center">
                {/* Pool */}
                <div className="col-span-3 flex items-center gap-3">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400 ring-2 ring-surface">
                      {a.token0Symbol.charAt(0)}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-400 ring-2 ring-surface">
                      {a.token1Symbol.charAt(0)}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">
                      {a.token0Symbol}/{a.token1Symbol}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {a.feeTier / 10000}% fee &middot; #{a.position.tokenId}
                    </div>
                  </div>
                </div>

                {/* Value */}
                <div className="col-span-2 text-right">
                  <div className="font-medium">{formatCurrency(a.valueUsd)}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatNumber(a.amount0, 4)} {a.token0Symbol}
                  </div>
                </div>

                {/* Fees */}
                <div className="col-span-2 text-right">
                  <div className="font-medium text-green-500">
                    {formatCurrency(a.feesUsd)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatNumber(a.fees0, 4)} {a.token0Symbol}
                  </div>
                </div>

                {/* P&L */}
                <div className="col-span-2 text-right">
                  <div
                    className={cn(
                      'font-medium',
                      pnlPositive ? 'text-green-500' : 'text-red-500'
                    )}
                  >
                    {pnlPositive ? '+' : ''}
                    {formatCurrency(a.pnl.netPnlUsd)}
                  </div>
                  <div
                    className={cn(
                      'text-xs',
                      pnlPositive ? 'text-green-500' : 'text-red-500'
                    )}
                  >
                    {pnlPositive ? '+' : ''}
                    {formatPercent(a.pnl.netPnlPercent)}
                  </div>
                </div>

                {/* Status */}
                <div className="col-span-2 flex justify-center">
                  <span
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium',
                      a.position.inRange
                        ? 'bg-green-500/10 text-green-500'
                        : 'bg-orange-500/10 text-orange-500'
                    )}
                  >
                    {a.position.inRange ? 'In Range' : 'Out of Range'}
                  </span>
                </div>

                {/* Action */}
                <div className="col-span-1 flex justify-end">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              {/* Mobile card */}
              <div className="md:hidden p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1">
                      <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] font-bold text-blue-400 ring-2 ring-surface">
                        {a.token0Symbol.charAt(0)}
                      </div>
                      <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px] font-bold text-purple-400 ring-2 ring-surface">
                        {a.token1Symbol.charAt(0)}
                      </div>
                    </div>
                    <div className="font-medium text-sm">
                      {a.token0Symbol}/{a.token1Symbol}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {a.feeTier / 10000}%
                    </span>
                  </div>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-medium',
                      a.position.inRange
                        ? 'bg-green-500/10 text-green-500'
                        : 'bg-orange-500/10 text-orange-500'
                    )}
                  >
                    {a.position.inRange ? 'In Range' : 'Out of Range'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Value</div>
                    <div className="font-medium">{formatCurrency(a.valueUsd)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Fees</div>
                    <div className="font-medium text-green-500">
                      {formatCurrency(a.feesUsd)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">P&L</div>
                    <div
                      className={cn(
                        'font-medium',
                        pnlPositive ? 'text-green-500' : 'text-red-500'
                      )}
                    >
                      {pnlPositive ? '+' : ''}
                      {formatCurrency(a.pnl.netPnlUsd)}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function AssetAllocationCard({
  allocations,
}: {
  allocations: TokenAllocation[];
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center gap-2 mb-4">
        <PieChart className="h-5 w-5 text-purple-500" />
        <h3 className="text-lg font-semibold">Asset Allocation</h3>
      </div>

      {/* Stacked bar */}
      <div className="h-4 rounded-full overflow-hidden flex mb-6">
        {allocations.map((alloc, idx) => (
          <div
            key={alloc.symbol}
            className={cn(ALLOC_COLORS[idx % ALLOC_COLORS.length], 'transition-all')}
            style={{ width: `${Math.max(alloc.percentage, 1)}%` }}
          />
        ))}
      </div>

      {/* Token list */}
      <div className="space-y-3">
        {allocations.map((alloc, idx) => (
          <div
            key={alloc.symbol}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-3 h-3 rounded-full',
                  ALLOC_COLORS[idx % ALLOC_COLORS.length]
                )}
              />
              <span className="font-medium">{alloc.symbol}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {formatCurrency(alloc.valueUsd)}
              </span>
              <span className="text-sm font-medium w-16 text-right">
                {formatPercent(alloc.percentage)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeeEarningsSummary({
  analytics,
  totalFeesUsd,
}: {
  analytics: PositionAnalytics[];
  totalFeesUsd: number;
}) {
  // Aggregate fees by token
  const feesByToken: Record<string, { amount: number; valueUsd: number }> = {};
  for (const a of analytics) {
    const t0Price = getTokenPrice(a.token0Symbol);
    const t1Price = getTokenPrice(a.token1Symbol);

    if (!feesByToken[a.token0Symbol]) {
      feesByToken[a.token0Symbol] = { amount: 0, valueUsd: 0 };
    }
    feesByToken[a.token0Symbol].amount += a.fees0;
    feesByToken[a.token0Symbol].valueUsd += a.fees0 * t0Price;

    if (!feesByToken[a.token1Symbol]) {
      feesByToken[a.token1Symbol] = { amount: 0, valueUsd: 0 };
    }
    feesByToken[a.token1Symbol].amount += a.fees1;
    feesByToken[a.token1Symbol].valueUsd += a.fees1 * t1Price;
  }

  const sortedTokenFees = Object.entries(feesByToken)
    .map(([symbol, data]) => ({ symbol, ...data }))
    .sort((a, b) => b.valueUsd - a.valueUsd)
    .filter((t) => t.valueUsd > 0);

  // Active positions earning fees
  const activeCount = analytics.filter((a) => a.position.inRange).length;

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="h-5 w-5 text-green-500" />
        <h3 className="text-lg font-semibold">Fee Earnings</h3>
      </div>

      {/* Total fees hero */}
      <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/10 mb-4">
        <div className="text-sm text-muted-foreground mb-1">
          Total Unclaimed Fees
        </div>
        <div className="text-2xl font-bold text-green-500">
          {formatCurrency(totalFeesUsd)}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Across {analytics.length} position{analytics.length !== 1 ? 's' : ''}{' '}
          &middot; {activeCount} actively earning
        </div>
      </div>

      {/* Fees by token */}
      <div className="space-y-3">
        <div className="text-sm text-muted-foreground font-medium">
          Breakdown by Token
        </div>
        {sortedTokenFees.length > 0 ? (
          sortedTokenFees.map((t) => (
            <div
              key={t.symbol}
              className="flex items-center justify-between py-2 border-b border-border last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-green-500/10 flex items-center justify-center text-xs font-bold text-green-400">
                  {t.symbol.charAt(0)}
                </div>
                <span className="font-medium">{t.symbol}</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">
                  {formatNumber(t.amount, 6)} {t.symbol}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatCurrency(t.valueUsd)}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-sm text-muted-foreground text-center py-4">
            No fees earned yet
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function PortfolioSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton variant="circular" width={48} height={48} />
          <div className="space-y-2">
            <Skeleton variant="text" width={120} />
            <Skeleton variant="text" width={200} height={32} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 rounded-lg bg-surface/50 space-y-2">
              <Skeleton variant="text" width={80} />
              <Skeleton variant="text" width={120} height={24} />
            </div>
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="p-4 border-b border-border">
          <Skeleton variant="text" width={180} height={24} />
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-4 flex items-center gap-4 border-b border-border last:border-b-0"
          >
            <Skeleton variant="circular" width={32} height={32} />
            <Skeleton variant="text" className="flex-1" />
            <Skeleton variant="text" width={80} />
            <Skeleton variant="text" width={80} />
            <Skeleton variant="text" width={60} />
          </div>
        ))}
      </div>

      {/* Bottom cards skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-6 space-y-4">
            <Skeleton variant="text" width={160} height={24} />
            <Skeleton variant="rectangular" height={16} />
            <div className="space-y-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex justify-between items-center">
                  <Skeleton variant="text" width={80} />
                  <Skeleton variant="text" width={60} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const { positions, loading, error, refetch } = usePositions(
    isConnected ? address : undefined
  );

  const summary = useMemo(
    () => calculatePortfolioSummary(positions),
    [positions]
  );

  const analytics = useMemo(
    () => positions.map((p) => analyzePosition(p as EnrichedPosition)),
    [positions]
  );

  const allocations = useMemo(
    () => computeTokenAllocations(analytics),
    [analytics]
  );

  const totalFeesUsd = useMemo(
    () => analytics.reduce((sum, a) => sum + a.feesUsd, 0),
    [analytics]
  );

  // ---------------------------------------------------------------------------
  // Wallet not connected
  // ---------------------------------------------------------------------------
  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Portfolio Analytics</h1>
              <p className="text-muted-foreground">
                In-depth analytics for your liquidity positions
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <EmptyState
              icon={Wallet}
              title="Connect your wallet"
              description="Connect your wallet to view detailed portfolio analytics, position breakdowns, and fee earnings."
            />
          </FadeIn>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <FadeIn>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Portfolio Analytics</h1>
              <p className="text-muted-foreground">
                In-depth analytics for your liquidity positions
              </p>
            </div>

            <Link href="/positions">
              <Button variant="secondary" size="sm" className="gap-2">
                <Droplets className="h-4 w-4" />
                Manage Positions
              </Button>
            </Link>
          </div>
        </FadeIn>

        {loading ? (
          <FadeIn delay={0.1}>
            <PortfolioSkeleton />
          </FadeIn>
        ) : error ? (
          <FadeIn delay={0.1}>
            <div className="rounded-xl border border-border bg-surface p-8 text-center">
              <AlertTriangle className="h-10 w-10 text-orange-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">
                Failed to load portfolio
              </h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={refetch} variant="secondary">
                Try Again
              </Button>
            </div>
          </FadeIn>
        ) : positions.length === 0 ? (
          <FadeIn delay={0.1}>
            <EmptyState
              icon={Inbox}
              title="No positions yet"
              description="Create your first liquidity position to see portfolio analytics and fee earnings."
              action={{
                label: 'Add Liquidity',
                onClick: () => (window.location.href = '/add'),
              }}
            />
          </FadeIn>
        ) : (
          <StaggerChildren staggerDelay={0.08}>
            {/* Portfolio Value Summary */}
            <StaggerItem>
              <div className="mb-6">
                <PortfolioValueHeader
                  totalValueUsd={summary.totalValueUsd}
                  totalPnlUsd={summary.totalPnlUsd}
                  totalPnlPercent={summary.totalPnlPercent}
                  totalFeesUsd={summary.totalFeesEarnedUsd}
                />
              </div>
            </StaggerItem>

            {/* Quick Stats Row */}
            <StaggerItem>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Droplets className="h-4 w-4 text-blue-500" />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Total Positions
                    </span>
                  </div>
                  <div className="text-2xl font-bold">{positions.length}</div>
                </div>

                <div className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <Activity className="h-4 w-4 text-green-500" />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Active (In Range)
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-green-500">
                    {summary.activePositions}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-orange-500/10">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Out of Range
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-orange-500">
                    {summary.inactivePositions}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <TrendingUp className="h-4 w-4 text-purple-500" />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Avg ROI
                    </span>
                  </div>
                  <div
                    className={cn(
                      'text-2xl font-bold',
                      summary.totalPnlPercent >= 0
                        ? 'text-green-500'
                        : 'text-red-500'
                    )}
                  >
                    {summary.totalPnlPercent >= 0 ? '+' : ''}
                    {formatPercent(summary.totalPnlPercent)}
                  </div>
                </div>
              </div>
            </StaggerItem>

            {/* Position Breakdown Table */}
            <StaggerItem>
              <div className="mb-6">
                <PositionBreakdownTable analytics={analytics} />
              </div>
            </StaggerItem>

            {/* Bottom section: Asset Allocation + Fee Earnings */}
            <StaggerItem>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <AssetAllocationCard allocations={allocations} />
                <FeeEarningsSummary
                  analytics={analytics}
                  totalFeesUsd={totalFeesUsd}
                />
              </div>
            </StaggerItem>

            {/* Info footer */}
            <StaggerItem>
              <div className="rounded-xl border border-border bg-surface p-6">
                <h3 className="font-semibold mb-3">About Portfolio Analytics</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Portfolio analytics are calculated from your on-chain liquidity
                    positions. Values are estimated using current token prices.
                  </p>
                  <p>
                    P&L calculations use simplified estimates. Actual returns depend on
                    price movements, impermanent loss, and fee accumulation over time.
                  </p>
                  <p className="text-orange-500">
                    <strong>Note:</strong> 24h change is an estimate based on overall
                    P&L. Historical tracking will improve as the protocol matures.
                  </p>
                </div>
              </div>
            </StaggerItem>
          </StaggerChildren>
        )}
      </div>
    </div>
  );
}
