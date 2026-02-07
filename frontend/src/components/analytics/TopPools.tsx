'use client';

import { TopPoolData } from '@/lib/constants/analytics';
import { formatCurrency } from '@/lib/utils/format';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { TrendingUp } from 'lucide-react';

interface TopPoolsProps {
  pools: TopPoolData[];
  className?: string;
}

export function TopPools({ pools, className }: TopPoolsProps) {
  const router = useRouter();

  return (
    <div className={cn('rounded-xl border border-border bg-surface', className)}>
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="text-lg font-semibold">Top Pools by Volume</h3>
        <TrendingUp className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="divide-y divide-border">
        {pools.map((pool, index) => (
          <div
            key={pool.poolId}
            onClick={() => router.push(`/pools/${pool.poolId}`)}
            className="p-4 hover:bg-surface-secondary cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="text-lg font-bold text-muted-foreground w-6">
                  #{index + 1}
                </div>
                <div>
                  <div className="font-semibold">
                    {pool.token0Symbol}/{pool.token1Symbol}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {pool.feeTier / 10000}% fee
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-semibold">{formatCurrency(pool.volumeUsd)}</div>
                <div className="text-sm text-muted-foreground">Volume 24H</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">TVL: </span>
                <span className="font-medium">{formatCurrency(pool.tvlUsd)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Fees: </span>
                <span className="font-medium text-green-500">
                  {formatCurrency(pool.feesUsd)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {pools.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          No pools available
        </div>
      )}
    </div>
  );
}
