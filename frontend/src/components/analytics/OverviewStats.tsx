'use client';

import { ProtocolStats } from '@/lib/constants/analytics';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { TrendingUp, TrendingDown, Activity, Users, Droplets, DollarSign } from 'lucide-react';

interface OverviewStatsProps {
  stats: ProtocolStats;
  tvlChange?: number;
  volumeChange?: number;
  feesChange?: number;
  className?: string;
}

export function OverviewStats({
  stats,
  tvlChange = 0,
  volumeChange = 0,
  feesChange = 0,
  className,
}: OverviewStatsProps) {
  const mainStats = [
    {
      label: 'Total Value Locked',
      value: formatCurrency(stats.totalValueLockedUsd),
      change: tvlChange,
      icon: Droplets,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Volume 24H',
      value: formatCurrency(stats.volume24hUsd),
      subValue: `${formatCurrency(stats.volume7dUsd)} (7D)`,
      change: volumeChange,
      icon: Activity,
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      label: 'Fees 24H',
      value: formatCurrency(stats.fees24hUsd),
      subValue: `${formatCurrency(stats.fees7dUsd)} (7D)`,
      change: feesChange,
      icon: DollarSign,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
  ];

  const secondaryStats = [
    {
      label: 'Total Transactions',
      value: formatNumber(stats.totalTransactions, 0),
      icon: Activity,
      iconColor: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      label: 'Unique Users',
      value: formatNumber(stats.uniqueUsers, 0),
      icon: Users,
      iconColor: 'text-pink-500',
      bgColor: 'bg-pink-500/10',
    },
    {
      label: 'Active Pools',
      value: stats.poolCount.toString(),
      icon: Droplets,
      iconColor: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
    },
  ];

  return (
    <div className={cn('space-y-4', className)}>
      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {mainStats.map((stat) => {
          const Icon = stat.icon;
          const ChangeIcon = stat.change >= 0 ? TrendingUp : TrendingDown;

          return (
            <div
              key={stat.label}
              className="rounded-xl border border-border bg-surface p-6"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={cn('p-2.5 rounded-lg', stat.bgColor)}>
                  <Icon className={cn('h-5 w-5', stat.iconColor)} />
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>

              <div className="space-y-1">
                <div className="text-3xl font-bold">{stat.value}</div>

                {stat.subValue && (
                  <div className="text-xs text-muted-foreground">{stat.subValue}</div>
                )}

                {stat.change !== 0 && (
                  <div className="flex items-center gap-1">
                    <ChangeIcon
                      className={cn(
                        'h-3.5 w-3.5',
                        stat.change >= 0 ? 'text-green-500' : 'text-red-500'
                      )}
                    />
                    <span
                      className={cn(
                        'text-sm font-medium',
                        stat.change >= 0 ? 'text-green-500' : 'text-red-500'
                      )}
                    >
                      {stat.change >= 0 ? '+' : ''}
                      {stat.change.toFixed(2)}%
                    </span>
                    <span className="text-xs text-muted-foreground">(24H)</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {secondaryStats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={cn('p-2 rounded-lg', stat.bgColor)}>
                  <Icon className={cn('h-4 w-4', stat.iconColor)} />
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
              <div className="text-2xl font-bold">{stat.value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
