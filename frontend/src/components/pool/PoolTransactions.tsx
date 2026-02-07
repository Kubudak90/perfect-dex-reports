'use client';

import { PoolTransaction } from '@/lib/constants/pools';
import { Pool } from '@/types/pool';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { ArrowUpRight, ArrowDownRight, Plus, Minus, ExternalLink } from 'lucide-react';

interface PoolTransactionsProps {
  pool: Pool;
  transactions: PoolTransaction[];
  className?: string;
}

export function PoolTransactions({
  pool,
  transactions,
  className,
}: PoolTransactionsProps) {
  const getTypeIcon = (type: PoolTransaction['type']) => {
    switch (type) {
      case 'swap':
        return ArrowUpRight;
      case 'mint':
        return Plus;
      case 'burn':
        return Minus;
    }
  };

  const getTypeColor = (type: PoolTransaction['type']) => {
    switch (type) {
      case 'swap':
        return 'text-blue-500 bg-blue-500/10';
      case 'mint':
        return 'text-green-500 bg-green-500/10';
      case 'burn':
        return 'text-red-500 bg-red-500/10';
    }
  };

  const getTypeLabel = (type: PoolTransaction['type']) => {
    switch (type) {
      case 'swap':
        return 'Swap';
      case 'mint':
        return 'Add';
      case 'burn':
        return 'Remove';
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getExplorerUrl = (txHash: string) => {
    // Base mainnet explorer
    return `https://basescan.org/tx/${txHash}`;
  };

  return (
    <div className={cn('rounded-xl border border-border bg-surface', className)}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h3 className="text-lg font-semibold">Recent Transactions</h3>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface-secondary">
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                Type
              </th>
              <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                {pool.token0Symbol}
              </th>
              <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                {pool.token1Symbol}
              </th>
              <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                Value
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                Account
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                Time
              </th>
              <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">
                Tx
              </th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => {
              const Icon = getTypeIcon(tx.type);
              return (
                <tr
                  key={tx.id}
                  className="border-b border-border last:border-0 hover:bg-surface-secondary transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className={cn('p-1.5 rounded-lg', getTypeColor(tx.type))}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-medium">{getTypeLabel(tx.type)}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-sm">
                    {formatNumber(parseFloat(tx.token0Amount), 6)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-sm">
                    {formatNumber(parseFloat(tx.token1Amount), 2)}
                  </td>
                  <td className="py-3 px-4 text-right font-medium">
                    {formatCurrency(tx.amountUsd)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-sm text-muted-foreground">
                      {tx.account}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    {formatTimeAgo(tx.timestamp)}
                  </td>
                  <td className="py-3 px-4">
                    <a
                      href={getExplorerUrl(tx.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center p-1.5 rounded-lg hover:bg-surface transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden divide-y divide-border">
        {transactions.map((tx) => {
          const Icon = getTypeIcon(tx.type);
          return (
            <div key={tx.id} className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn('p-1.5 rounded-lg', getTypeColor(tx.type))}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="font-semibold">{getTypeLabel(tx.type)}</span>
                </div>
                <a
                  href={getExplorerUrl(tx.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-surface-secondary transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </a>
              </div>

              {/* Amounts */}
              <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                <div>
                  <div className="text-muted-foreground mb-0.5">
                    {pool.token0Symbol}
                  </div>
                  <div className="font-mono">
                    {formatNumber(parseFloat(tx.token0Amount), 6)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-0.5">
                    {pool.token1Symbol}
                  </div>
                  <div className="font-mono">
                    {formatNumber(parseFloat(tx.token1Amount), 2)}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between text-sm">
                <div className="font-medium">{formatCurrency(tx.amountUsd)}</div>
                <div className="text-muted-foreground">
                  {formatTimeAgo(tx.timestamp)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {transactions.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          No transactions yet
        </div>
      )}
    </div>
  );
}
