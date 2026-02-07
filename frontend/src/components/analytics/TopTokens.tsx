'use client';

import { TopTokenData } from '@/lib/constants/analytics';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { TrendingUp, TrendingDown, Star } from 'lucide-react';

interface TopTokensProps {
  tokens: TopTokenData[];
  className?: string;
}

export function TopTokens({ tokens, className }: TopTokensProps) {
  return (
    <div className={cn('rounded-xl border border-border bg-surface', className)}>
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="text-lg font-semibold">Top Tokens by Volume</h3>
        <Star className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="divide-y divide-border">
        {tokens.map((token, index) => {
          const ChangeIcon = token.priceChange24h >= 0 ? TrendingUp : TrendingDown;

          return (
            <div
              key={token.symbol}
              className="p-4 hover:bg-surface-secondary transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="text-lg font-bold text-muted-foreground w-6">
                    #{index + 1}
                  </div>
                  <div>
                    <div className="font-semibold">{token.symbol}</div>
                    <div className="text-sm text-muted-foreground">{token.name}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-semibold">{formatCurrency(token.priceUsd)}</div>
                  <div
                    className={cn(
                      'flex items-center gap-1 text-sm',
                      token.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'
                    )}
                  >
                    <ChangeIcon className="h-3 w-3" />
                    {token.priceChange24h >= 0 ? '+' : ''}
                    {token.priceChange24h.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Volume: </span>
                  <span className="font-medium">{formatCurrency(token.volumeUsd)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">TVL: </span>
                  <span className="font-medium">{formatCurrency(token.tvlUsd)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {tokens.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          No tokens available
        </div>
      )}
    </div>
  );
}
