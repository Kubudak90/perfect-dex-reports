'use client';

import { PortfolioSummary as PortfolioSummaryType } from '@/lib/constants/positions';
import { formatCurrency, formatPercent } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { Wallet, TrendingUp, DollarSign, Activity, Droplets } from 'lucide-react';

interface PortfolioSummaryProps {
  summary: PortfolioSummaryType;
  className?: string;
}

export function PortfolioSummary({ summary, className }: PortfolioSummaryProps) {
  const stats = [
    {
      label: 'Total Value',
      value: formatCurrency(summary.totalValueUsd),
      icon: Wallet,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Total PnL',
      value: formatCurrency(summary.totalPnlUsd),
      subValue: `${summary.totalPnlPercent >= 0 ? '+' : ''}${formatPercent(summary.totalPnlPercent)}`,
      icon: TrendingUp,
      iconColor: summary.totalPnlUsd >= 0 ? 'text-green-500' : 'text-red-500',
      bgColor: summary.totalPnlUsd >= 0 ? 'bg-green-500/10' : 'bg-red-500/10',
      valueColor: summary.totalPnlUsd >= 0 ? 'text-green-500' : 'text-red-500',
    },
    {
      label: 'Fees Earned',
      value: formatCurrency(summary.totalFeesEarnedUsd),
      icon: DollarSign,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      label: 'Active Positions',
      value: summary.activePositions.toString(),
      subValue: `${summary.inactivePositions} out of range`,
      icon: Droplets,
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
  ];

  return (
    <div className={cn('space-y-4', className)}>
      {/* Hero Card */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-primary/5 to-primary/10 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-primary/10">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Total Portfolio Value</div>
            <div className="text-3xl font-bold">{formatCurrency(summary.totalValueUsd)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-surface/50">
            <div className="text-xs text-muted-foreground mb-1">Total PnL</div>
            <div
              className={cn(
                'text-lg font-bold',
                summary.totalPnlUsd >= 0 ? 'text-green-500' : 'text-red-500'
              )}
            >
              {summary.totalPnlUsd >= 0 ? '+' : ''}
              {formatCurrency(summary.totalPnlUsd)}
            </div>
            <div
              className={cn(
                'text-xs',
                summary.totalPnlPercent >= 0 ? 'text-green-500' : 'text-red-500'
              )}
            >
              {summary.totalPnlPercent >= 0 ? '+' : ''}
              {formatPercent(summary.totalPnlPercent)}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-surface/50">
            <div className="text-xs text-muted-foreground mb-1">Fees Earned</div>
            <div className="text-lg font-bold text-green-500">
              {formatCurrency(summary.totalFeesEarnedUsd)}
            </div>
            <div className="text-xs text-muted-foreground">All time</div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.slice(1).map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={cn('p-2 rounded-lg', stat.bgColor)}>
                  <Icon className={cn('h-4 w-4', stat.iconColor)} />
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
              <div className={cn('text-2xl font-bold', stat.valueColor)}>
                {stat.value}
              </div>
              {stat.subValue && (
                <div className="text-xs text-muted-foreground mt-1">
                  {stat.subValue}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
