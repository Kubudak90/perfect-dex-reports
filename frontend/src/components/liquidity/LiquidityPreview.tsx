'use client';

import { Token } from '@/types/token';
import { TokenPairLogo } from '@/components/common/TokenLogo';
import { cn } from '@/lib/utils/cn';
import { formatNumber, formatCurrency } from '@/lib/utils/format';
import { TrendingUp, Droplets, DollarSign } from 'lucide-react';

interface LiquidityPreviewProps {
  token0: Token;
  token1: Token;
  amount0: string;
  amount1: string;
  totalValueUsd?: number;
  shareOfPool?: number;
  estimatedApr?: number;
  priceLower: number;
  priceUpper: number;
  currentPrice: number;
  inRange: boolean;
  className?: string;
}

export function LiquidityPreview({
  token0,
  token1,
  amount0,
  amount1,
  totalValueUsd = 0,
  shareOfPool = 0,
  estimatedApr = 0,
  priceLower,
  priceUpper,
  currentPrice,
  inRange,
  className,
}: LiquidityPreviewProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface-secondary p-4 space-y-4',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Position Preview</h3>
        <TokenPairLogo
          token0Logo={token0.logoURI}
          token1Logo={token1.logoURI}
          token0Symbol={token0.symbol}
          token1Symbol={token1.symbol}
          size={32}
        />
      </div>

      {/* Deposited Amounts */}
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">Deposited</div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm">{token0.symbol}</span>
            <span className="font-medium">
              {amount0 || '0'} {token0.symbol}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">{token1.symbol}</span>
            <span className="font-medium">
              {amount1 || '0'} {token1.symbol}
            </span>
          </div>
        </div>
      </div>

      {/* Total Value */}
      {totalValueUsd > 0 && (
        <div className="flex items-center justify-between py-2 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            Total Value
          </div>
          <span className="font-semibold text-lg">
            {formatCurrency(totalValueUsd)}
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {/* Share of Pool */}
        <div className="rounded-lg bg-surface p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Droplets className="h-3 w-3" />
            Share of Pool
          </div>
          <div className="font-semibold">
            {shareOfPool > 0 ? `${shareOfPool.toFixed(4)}%` : '0%'}
          </div>
        </div>

        {/* APR */}
        <div className="rounded-lg bg-surface p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <TrendingUp className="h-3 w-3" />
            Est. APR
          </div>
          <div className="font-semibold text-green-500">
            {estimatedApr > 0 ? `${estimatedApr.toFixed(2)}%` : 'N/A'}
          </div>
        </div>
      </div>

      {/* Price Range */}
      <div className="space-y-2 pt-2 border-t border-border">
        <div className="text-sm text-muted-foreground">Selected Range</div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg bg-surface p-2 text-center">
            <div className="text-muted-foreground mb-1">Min Price</div>
            <div className="font-medium">{formatNumber(priceLower, 6)}</div>
          </div>
          <div className="rounded-lg bg-surface p-2 text-center">
            <div className="text-muted-foreground mb-1">Current</div>
            <div className="font-medium">{formatNumber(currentPrice, 6)}</div>
          </div>
          <div className="rounded-lg bg-surface p-2 text-center">
            <div className="text-muted-foreground mb-1">Max Price</div>
            <div className="font-medium">{formatNumber(priceUpper, 6)}</div>
          </div>
        </div>

        {/* In Range Status */}
        <div
          className={cn(
            'flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium',
            inRange
              ? 'bg-green-500/10 text-green-500'
              : 'bg-orange-500/10 text-orange-500'
          )}
        >
          <div
            className={cn(
              'h-2 w-2 rounded-full',
              inRange ? 'bg-green-500' : 'bg-orange-500'
            )}
          />
          {inRange ? 'In Range' : 'Out of Range'}
        </div>
      </div>

      {/* Warning for out of range */}
      {!inRange && (
        <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs text-orange-500">
          Your position will not earn fees until the price moves into your selected range.
        </div>
      )}
    </div>
  );
}
