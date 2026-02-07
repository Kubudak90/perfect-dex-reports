'use client';

import { Pool } from '@/types/pool';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils/format';
import { Droplets, TrendingUp, DollarSign, Activity } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface PoolStatsProps {
  pool: Pool;
  className?: string;
}

export function PoolStats({ pool, className }: PoolStatsProps) {
  const stats = [
    {
      label: 'Total Value Locked',
      value: formatCurrency(pool.tvlUsd),
      icon: Droplets,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Volume 24H',
      value: formatCurrency(pool.volume24hUsd),
      icon: Activity,
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      label: 'Fees 24H',
      value: formatCurrency(pool.fees24hUsd),
      icon: DollarSign,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      label: 'APR',
      value: formatPercent(pool.apr24h),
      icon: TrendingUp,
      iconColor: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ];

  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4', className)}>
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={cn('p-2 rounded-lg', stat.bgColor)}>
                <Icon className={cn('h-5 w-5', stat.iconColor)} />
              </div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
            <div className="text-2xl font-bold">{stat.value}</div>
          </div>
        );
      })}
    </div>
  );
}
