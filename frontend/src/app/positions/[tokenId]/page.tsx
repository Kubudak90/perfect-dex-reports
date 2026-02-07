'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { getMockPositionById, getMockPositionHistory, calculatePositionPnL, PositionHistoryItem } from '@/lib/constants/positions';
import { getMockPoolById } from '@/lib/constants/pools';
import { Position, Pool } from '@/types/pool';
import { TokenPairLogo } from '@/components/common/TokenLogo';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { RemoveLiquidityModal } from '@/components/liquidity/RemoveLiquidityModal';
import { CollectFeesModal } from '@/components/liquidity/CollectFeesModal';
import { FadeIn } from '@/components/ui/AnimatedComponents';
import { formatNumber, formatCurrency, formatPercent, formatTimeAgo } from '@/lib/utils/format';
import { tickToPrice } from '@/lib/utils/tick';
import { cn } from '@/lib/utils/cn';
import {
  ArrowLeft,
  Plus,
  Minus,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Droplets,
  Activity,
  Clock,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';

export default function PositionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isConnected } = useAccount();

  const tokenId = Number(params.tokenId);

  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState<Position | null>(null);
  const [pool, setPool] = useState<Pool | null>(null);
  const [history, setHistory] = useState<PositionHistoryItem[]>([]);

  // Modal states
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [copiedTokenId, setCopiedTokenId] = useState(false);

  // Load position data
  useEffect(() => {
    const loadPosition = async () => {
      try {
        setLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 400));

        const posData = getMockPositionById(tokenId);
        if (posData) {
          setPosition(posData);
          const poolData = getMockPoolById(posData.poolId);
          if (poolData) {
            setPool(poolData);
          }
          const histData = getMockPositionHistory(tokenId);
          setHistory(histData);
        }
      } finally {
        setLoading(false);
      }
    };

    loadPosition();
  }, [tokenId]);

  // Calculate PnL
  const pnl = useMemo(() => {
    if (!position || !pool) return null;

    const token0Price = pool.token0Symbol === 'ETH' || pool.token0Symbol === 'WETH' ? 2450 : 1;
    const token1Price = pool.token1Symbol === 'ETH' || pool.token1Symbol === 'WETH' ? 2450 : 1;

    return calculatePositionPnL(
      position,
      token0Price,
      token1Price,
      pool.token0Decimals,
      pool.token1Decimals
    );
  }, [position, pool]);

  // Calculated values
  const amount0Formatted = pool && position
    ? formatNumber(Number(position.amount0) / 10 ** pool.token0Decimals, 6)
    : '0';
  const amount1Formatted = pool && position
    ? formatNumber(Number(position.amount1) / 10 ** pool.token1Decimals, 2)
    : '0';

  const fees0Formatted = pool && position
    ? formatNumber(Number(position.unclaimedFees0) / 10 ** pool.token0Decimals, 6)
    : '0';
  const fees1Formatted = pool && position
    ? formatNumber(Number(position.unclaimedFees1) / 10 ** pool.token1Decimals, 2)
    : '0';

  const priceLower = position ? tickToPrice(position.tickLower) : 0;
  const priceUpper = position ? tickToPrice(position.tickUpper) : 0;
  const currentPrice = pool ? pool.token0Price : 0;

  const handleCopyTokenId = () => {
    navigator.clipboard.writeText(tokenId.toString());
    setCopiedTokenId(true);
    setTimeout(() => setCopiedTokenId(false), 2000);
  };

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Skeleton variant="text" width={200} className="mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-xl border border-border bg-surface p-6">
                <Skeleton variant="text" width={300} className="mb-4" />
                <Skeleton variant="text" width="100%" height={80} />
              </div>
            </div>
            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-surface p-6">
                <Skeleton variant="text" width={150} className="mb-4" />
                <Skeleton variant="text" width="100%" height={40} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not found
  if (!position || !pool) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center py-16">
          <h1 className="text-2xl font-bold mb-4">Position Not Found</h1>
          <p className="text-muted-foreground mb-6">
            Position #{tokenId} does not exist or you do not own it.
          </p>
          <Link href="/positions">
            <Button>Back to Positions</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <FadeIn>
          <div className="mb-8">
            <Link
              href="/positions"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Positions
            </Link>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <TokenPairLogo
                  token0Logo={pool.token0LogoURI}
                  token1Logo={pool.token1LogoURI}
                  token0Symbol={pool.token0Symbol}
                  token1Symbol={pool.token1Symbol}
                  size={48}
                />
                <div>
                  <h1 className="text-2xl font-bold">
                    {pool.token0Symbol}/{pool.token1Symbol}
                  </h1>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{pool.feeTier / 10000}% fee</span>
                    <span>|</span>
                    <button
                      onClick={handleCopyTokenId}
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      #{tokenId}
                      {copiedTokenId ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                    <span>|</span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1',
                        position.inRange ? 'text-green-500' : 'text-orange-500'
                      )}
                    >
                      <div
                        className={cn(
                          'h-2 w-2 rounded-full',
                          position.inRange ? 'bg-green-500' : 'bg-orange-500'
                        )}
                      />
                      {position.inRange ? 'In Range' : 'Out of Range'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <Link href="/add">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    Add More
                  </Button>
                </Link>
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setShowRemoveModal(true)}
                >
                  <Minus className="h-4 w-4" />
                  Remove
                </Button>
              </div>
            </div>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Value & PnL */}
            <FadeIn delay={0.1}>
              <div className="rounded-xl border border-border bg-surface p-6">
                <h3 className="font-semibold mb-4">Position Value</h3>

                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
                      <Droplets className="h-3.5 w-3.5" />
                      Current Value
                    </div>
                    <div className="text-3xl font-bold">
                      {pnl ? formatCurrency(pnl.currentValueUsd) : '$0.00'}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
                      {pnl && pnl.netPnlUsd >= 0 ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" />
                      )}
                      Net PnL
                    </div>
                    <div
                      className={cn(
                        'text-3xl font-bold',
                        pnl && pnl.netPnlUsd >= 0 ? 'text-green-500' : 'text-red-500'
                      )}
                    >
                      {pnl ? (
                        <>
                          {pnl.netPnlUsd >= 0 ? '+' : ''}
                          {formatCurrency(pnl.netPnlUsd)}
                        </>
                      ) : (
                        '$0.00'
                      )}
                    </div>
                    {pnl && (
                      <div
                        className={cn(
                          'text-sm',
                          pnl.netPnlPercent >= 0 ? 'text-green-500' : 'text-red-500'
                        )}
                      >
                        {pnl.netPnlPercent >= 0 ? '+' : ''}
                        {formatPercent(pnl.netPnlPercent)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Deposited amounts */}
                <div className="border-t border-border pt-4 space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Deposited</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-secondary">
                      {pool.token0LogoURI && (
                        <img src={pool.token0LogoURI} alt={pool.token0Symbol} className="w-8 h-8 rounded-full" />
                      )}
                      <div>
                        <div className="font-semibold">{amount0Formatted}</div>
                        <div className="text-sm text-muted-foreground">{pool.token0Symbol}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-secondary">
                      {pool.token1LogoURI && (
                        <img src={pool.token1LogoURI} alt={pool.token1Symbol} className="w-8 h-8 rounded-full" />
                      )}
                      <div>
                        <div className="font-semibold">{amount1Formatted}</div>
                        <div className="text-sm text-muted-foreground">{pool.token1Symbol}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* Price Range */}
            <FadeIn delay={0.2}>
              <div className="rounded-xl border border-border bg-surface p-6">
                <h3 className="font-semibold mb-4">Price Range</h3>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="p-4 rounded-xl bg-surface-secondary text-center">
                    <div className="text-sm text-muted-foreground mb-1">Min Price</div>
                    <div className="text-lg font-bold">{formatNumber(priceLower, 4)}</div>
                    <div className="text-xs text-muted-foreground">
                      {pool.token1Symbol} per {pool.token0Symbol}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-center">
                    <div className="text-sm text-muted-foreground mb-1">Current Price</div>
                    <div className="text-lg font-bold text-primary">{formatNumber(currentPrice, 4)}</div>
                    <div className="text-xs text-muted-foreground">
                      {pool.token1Symbol} per {pool.token0Symbol}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-surface-secondary text-center">
                    <div className="text-sm text-muted-foreground mb-1">Max Price</div>
                    <div className="text-lg font-bold">{formatNumber(priceUpper, 4)}</div>
                    <div className="text-xs text-muted-foreground">
                      {pool.token1Symbol} per {pool.token0Symbol}
                    </div>
                  </div>
                </div>

                {/* Range visualization bar */}
                <div className="relative h-3 bg-surface-secondary rounded-full overflow-hidden">
                  {(() => {
                    // Calculate relative position of current price within range
                    const rangeWidth = priceUpper - priceLower;
                    if (rangeWidth <= 0) return null;
                    const pricePosition = ((currentPrice - priceLower) / rangeWidth) * 100;
                    const clampedPosition = Math.max(0, Math.min(100, pricePosition));

                    return (
                      <>
                        <div
                          className={cn(
                            'absolute top-0 left-0 h-full rounded-full',
                            position.inRange ? 'bg-green-500/30' : 'bg-orange-500/30'
                          )}
                          style={{ width: '100%' }}
                        />
                        <div
                          className={cn(
                            'absolute top-0 h-full w-1 rounded-full',
                            position.inRange ? 'bg-green-500' : 'bg-orange-500'
                          )}
                          style={{ left: `${clampedPosition}%`, transform: 'translateX(-50%)' }}
                        />
                      </>
                    );
                  })()}
                </div>

                <div
                  className={cn(
                    'mt-3 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium',
                    position.inRange
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-orange-500/10 text-orange-500'
                  )}
                >
                  <div
                    className={cn(
                      'h-2 w-2 rounded-full',
                      position.inRange ? 'bg-green-500' : 'bg-orange-500'
                    )}
                  />
                  {position.inRange ? 'Currently In Range - Earning Fees' : 'Currently Out of Range'}
                </div>
              </div>
            </FadeIn>

            {/* Transaction History */}
            <FadeIn delay={0.3}>
              <div className="rounded-xl border border-border bg-surface p-6">
                <h3 className="font-semibold mb-4">Transaction History</h3>

                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No transaction history found
                  </p>
                ) : (
                  <div className="space-y-3">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 p-3 rounded-lg hover:bg-surface-secondary transition-colors"
                      >
                        <div className={cn(
                          'p-2 rounded-lg',
                          item.type === 'mint' ? 'bg-green-500/10' :
                          item.type === 'burn' ? 'bg-red-500/10' :
                          item.type === 'collect' ? 'bg-blue-500/10' :
                          item.type === 'increase' ? 'bg-green-500/10' :
                          'bg-orange-500/10'
                        )}>
                          {item.type === 'mint' || item.type === 'increase' ? (
                            <Plus className={cn('h-4 w-4', 'text-green-500')} />
                          ) : item.type === 'burn' || item.type === 'decrease' ? (
                            <Minus className={cn('h-4 w-4', 'text-red-500')} />
                          ) : (
                            <DollarSign className={cn('h-4 w-4', 'text-blue-500')} />
                          )}
                        </div>

                        <div className="flex-1">
                          <div className="font-medium text-sm capitalize">
                            {item.type === 'mint' ? 'Added Liquidity' :
                             item.type === 'burn' ? 'Removed Liquidity' :
                             item.type === 'collect' ? 'Collected Fees' :
                             item.type === 'increase' ? 'Increased Liquidity' :
                             item.type === 'decrease' ? 'Decreased Liquidity' :
                             item.type}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTimeAgo(item.timestamp)}
                          </div>
                        </div>

                        <div className="text-right text-sm">
                          {item.amount0 && (
                            <div>
                              {formatNumber(Number(item.amount0) / 10 ** pool.token0Decimals, 6)} {pool.token0Symbol}
                            </div>
                          )}
                          {item.amount1 && (
                            <div>
                              {formatNumber(Number(item.amount1) / 10 ** pool.token1Decimals, 2)} {pool.token1Symbol}
                            </div>
                          )}
                          {item.fees0 && (
                            <div className="text-green-500">
                              +{formatNumber(Number(item.fees0) / 10 ** pool.token0Decimals, 6)} {pool.token0Symbol}
                            </div>
                          )}
                          {item.fees1 && (
                            <div className="text-green-500">
                              +{formatNumber(Number(item.fees1) / 10 ** pool.token1Decimals, 2)} {pool.token1Symbol}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </FadeIn>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Unclaimed Fees */}
            <FadeIn delay={0.15}>
              <div className="rounded-xl border border-border bg-surface p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Unclaimed Fees</h3>
                  <div className="p-1.5 rounded-lg bg-green-500/10">
                    <DollarSign className="h-4 w-4 text-green-500" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {pool.token0LogoURI && (
                        <img src={pool.token0LogoURI} alt={pool.token0Symbol} className="w-5 h-5 rounded-full" />
                      )}
                      <span className="text-sm">{pool.token0Symbol}</span>
                    </div>
                    <span className="font-medium text-green-500">{fees0Formatted}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {pool.token1LogoURI && (
                        <img src={pool.token1LogoURI} alt={pool.token1Symbol} className="w-5 h-5 rounded-full" />
                      )}
                      <span className="text-sm">{pool.token1Symbol}</span>
                    </div>
                    <span className="font-medium text-green-500">{fees1Formatted}</span>
                  </div>

                  <div className="pt-2 border-t border-border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-muted-foreground">Total</span>
                      <span className="font-bold text-lg text-green-500">
                        {pnl ? formatCurrency(pnl.feesEarnedUsd) : '$0.00'}
                      </span>
                    </div>

                    <Button
                      onClick={() => setShowCollectModal(true)}
                      variant="outline"
                      size="sm"
                      className="w-full gap-1.5"
                    >
                      <DollarSign className="h-4 w-4" />
                      Collect Fees
                    </Button>
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* Pool Info */}
            <FadeIn delay={0.25}>
              <div className="rounded-xl border border-border bg-surface p-6">
                <h3 className="font-semibold mb-4">Pool Info</h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">TVL</span>
                    <span className="font-medium">{formatCurrency(pool.tvlUsd, true)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Volume (24h)</span>
                    <span className="font-medium">{formatCurrency(pool.volume24hUsd, true)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Fees (24h)</span>
                    <span className="font-medium">{formatCurrency(pool.fees24hUsd, true)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">APR (24h)</span>
                    <span className="font-medium text-green-500">{formatPercent(pool.apr24h)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Fee Tier</span>
                    <span className="font-medium">{pool.feeTier / 10000}%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tick Spacing</span>
                    <span className="font-medium">{pool.tickSpacing}</span>
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* Quick Actions */}
            <FadeIn delay={0.35}>
              <div className="rounded-xl border border-border bg-surface p-6">
                <h3 className="font-semibold mb-4">Actions</h3>

                <div className="space-y-2">
                  <Link href="/add" className="block">
                    <Button variant="outline" size="sm" className="w-full gap-1.5 justify-start">
                      <Plus className="h-4 w-4" />
                      Add Liquidity
                    </Button>
                  </Link>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 justify-start"
                    onClick={() => setShowRemoveModal(true)}
                  >
                    <Minus className="h-4 w-4" />
                    Remove Liquidity
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 justify-start"
                    onClick={() => setShowCollectModal(true)}
                  >
                    <DollarSign className="h-4 w-4" />
                    Collect Fees
                  </Button>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>

        {/* Remove Liquidity Modal */}
        {position && pool && (
          <RemoveLiquidityModal
            open={showRemoveModal}
            onOpenChange={setShowRemoveModal}
            position={position}
            pool={pool}
            onSuccess={() => {
              // Reload position data after successful removal
              const posData = getMockPositionById(tokenId);
              if (posData) setPosition(posData);
            }}
          />
        )}

        {/* Collect Fees Modal */}
        {position && pool && (
          <CollectFeesModal
            open={showCollectModal}
            onOpenChange={setShowCollectModal}
            position={position}
            pool={pool}
            onSuccess={() => {
              const posData = getMockPositionById(tokenId);
              if (posData) setPosition(posData);
            }}
          />
        )}
      </div>
    </div>
  );
}
