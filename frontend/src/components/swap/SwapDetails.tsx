'use client';

import { useState } from 'react';
import { ChevronDown, AlertTriangle, Info } from 'lucide-react';
import { SwapQuote } from '@/types/swap';
import { Token } from '@/types/token';
import { cn } from '@/lib/utils/cn';
import { formatNumber, formatCurrency, formatTokenAmount } from '@/lib/utils/format';
import { buildRouteString, getPriceImpactSeverity } from '@/lib/api/swap';

interface SwapDetailsProps {
  quote: SwapQuote;
  tokenIn: Token;
  tokenOut: Token;
  className?: string;
}

export function SwapDetails({
  quote,
  tokenIn,
  tokenOut,
  className,
}: SwapDetailsProps) {
  const [expanded, setExpanded] = useState(false);

  const priceImpactSeverity = getPriceImpactSeverity(quote.priceImpact);
  const routeString = buildRouteString(quote, tokenIn.symbol, tokenOut.symbol);

  const amountOutFormatted = formatTokenAmount(
    BigInt(quote.amountOut),
    tokenOut.decimals
  );

  const amountOutMinFormatted = formatTokenAmount(
    BigInt(quote.amountOutMin),
    tokenOut.decimals
  );

  return (
    <div
      className={cn(
        'rounded-xl bg-surface-secondary border border-border p-3 space-y-2',
        className
      )}
    >
      {/* Rate (always visible) */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
      >
        <span className="text-sm text-muted-foreground">Rate</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            1 {tokenIn.symbol} = {formatNumber(quote.executionPrice, 4)}{' '}
            {tokenOut.symbol}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              expanded && 'rotate-180'
            )}
          />
        </div>
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="space-y-2 pt-2 border-t border-border">
          {/* Expected Output */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Expected output</span>
            <span className="font-medium">
              {amountOutFormatted} {tokenOut.symbol}
            </span>
          </div>

          {/* Minimum received */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Minimum received</span>
              <Info className="h-3 w-3 text-muted-foreground" />
            </div>
            <span className="font-medium">
              {amountOutMinFormatted} {tokenOut.symbol}
            </span>
          </div>

          {/* Price Impact */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Price impact</span>
              {priceImpactSeverity !== 'low' && (
                <AlertTriangle
                  className={cn(
                    'h-3 w-3',
                    priceImpactSeverity === 'medium' && 'text-yellow-500',
                    priceImpactSeverity === 'high' && 'text-orange-500',
                    priceImpactSeverity === 'severe' && 'text-destructive'
                  )}
                />
              )}
            </div>
            <span
              className={cn(
                'font-medium',
                priceImpactSeverity === 'medium' && 'text-yellow-500',
                priceImpactSeverity === 'high' && 'text-orange-500',
                priceImpactSeverity === 'severe' && 'text-destructive'
              )}
            >
              {quote.priceImpact < 0.01 ? '<0.01' : formatNumber(quote.priceImpact, 2)}%
            </span>
          </div>

          {/* Route */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Route</span>
            <span className="font-medium text-xs">{routeString}</span>
          </div>

          {/* Gas Estimate */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Network fee</span>
            <span className="font-medium">
              {quote.gasEstimateUsd
                ? formatCurrency(quote.gasEstimateUsd)
                : '~$0.50'}
            </span>
          </div>

          {/* Hops & Splits */}
          {(quote.route.hops > 1 || quote.route.splits > 1) && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
              {quote.route.hops > 1 && (
                <span>{quote.route.hops} hops</span>
              )}
              {quote.route.splits > 1 && (
                <span>{quote.route.splits} splits</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Price Impact Warning */}
      {priceImpactSeverity === 'high' && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
          <div className="text-xs text-orange-500">
            High price impact. You may receive significantly less than expected.
          </div>
        </div>
      )}

      {priceImpactSeverity === 'severe' && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div className="text-xs text-destructive">
            Very high price impact. Consider reducing the amount or try again later.
          </div>
        </div>
      )}
    </div>
  );
}
