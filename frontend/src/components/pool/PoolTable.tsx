'use client';

import { Pool } from '@/types/pool';
import { TokenPairLogo } from '@/components/common/TokenLogo';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils/format';
import { ArrowUpDown, TrendingUp, TrendingDown } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

interface PoolTableProps {
  pools: Pool[];
  className?: string;
}

type SortField = 'tvl' | 'volume' | 'fees' | 'apr';
type SortDirection = 'asc' | 'desc';

export function PoolTable({ pools, className }: PoolTableProps) {
  const router = useRouter();
  const [sortField, setSortField] = useState<SortField>('tvl');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Sort pools
  const sortedPools = [...pools].sort((a, b) => {
    let aValue: number, bValue: number;

    switch (sortField) {
      case 'tvl':
        aValue = a.tvlUsd;
        bValue = b.tvlUsd;
        break;
      case 'volume':
        aValue = a.volume24hUsd;
        bValue = b.volume24hUsd;
        break;
      case 'fees':
        aValue = a.fees24hUsd;
        bValue = b.fees24hUsd;
        break;
      case 'apr':
        aValue = a.apr24h;
        bValue = b.apr24h;
        break;
    }

    return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleRowClick = (poolId: string) => {
    router.push(`/pools/${poolId}`);
  };

  return (
    <div className={cn('rounded-xl border border-border bg-surface overflow-hidden', className)}>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface-secondary">
              <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">
                Pool
              </th>
              <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground">
                <button
                  onClick={() => handleSort('tvl')}
                  className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                >
                  TVL
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground">
                <button
                  onClick={() => handleSort('volume')}
                  className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                >
                  Volume 24H
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground">
                <button
                  onClick={() => handleSort('fees')}
                  className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                >
                  Fees 24H
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground">
                <button
                  onClick={() => handleSort('apr')}
                  className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                >
                  APR
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedPools.map((pool) => (
              <tr
                key={pool.id}
                onClick={() => handleRowClick(pool.id)}
                className="border-b border-border last:border-0 hover:bg-surface-secondary cursor-pointer transition-colors"
              >
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <TokenPairLogo
                      token0Logo={pool.token0LogoURI}
                      token1Logo={pool.token1LogoURI}
                      token0Symbol={pool.token0Symbol}
                      token1Symbol={pool.token1Symbol}
                      size={32}
                    />
                    <div>
                      <div className="font-semibold">
                        {pool.token0Symbol}/{pool.token1Symbol}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {pool.feeTier / 10000}%
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4 text-right font-medium">
                  {formatCurrency(pool.tvlUsd)}
                </td>
                <td className="py-4 px-4 text-right font-medium">
                  {formatCurrency(pool.volume24hUsd)}
                </td>
                <td className="py-4 px-4 text-right font-medium">
                  {formatCurrency(pool.fees24hUsd)}
                </td>
                <td className="py-4 px-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {pool.apr24h > 20 ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span
                      className={cn(
                        'font-semibold',
                        pool.apr24h > 20 ? 'text-green-500' : ''
                      )}
                    >
                      {formatPercent(pool.apr24h)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden divide-y divide-border">
        {sortedPools.map((pool) => (
          <div
            key={pool.id}
            onClick={() => handleRowClick(pool.id)}
            className="p-4 hover:bg-surface-secondary cursor-pointer transition-colors"
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
              <TokenPairLogo
                token0Logo={pool.token0LogoURI}
                token1Logo={pool.token1LogoURI}
                token0Symbol={pool.token0Symbol}
                token1Symbol={pool.token1Symbol}
                size={40}
              />
              <div className="flex-1">
                <div className="font-semibold text-lg">
                  {pool.token0Symbol}/{pool.token1Symbol}
                </div>
                <div className="text-sm text-muted-foreground">
                  {pool.feeTier / 10000}% fee
                </div>
              </div>
              <div className="text-right">
                <div
                  className={cn(
                    'text-lg font-semibold',
                    pool.apr24h > 20 ? 'text-green-500' : ''
                  )}
                >
                  {formatPercent(pool.apr24h)}
                </div>
                <div className="text-xs text-muted-foreground">APR</div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground mb-0.5">TVL</div>
                <div className="font-medium">{formatCurrency(pool.tvlUsd)}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-0.5">Volume 24H</div>
                <div className="font-medium">{formatCurrency(pool.volume24hUsd)}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-0.5">Fees 24H</div>
                <div className="font-medium">{formatCurrency(pool.fees24hUsd)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {sortedPools.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          No pools found
        </div>
      )}
    </div>
  );
}
