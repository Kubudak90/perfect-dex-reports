'use client';

import { Pool } from '@/types/pool';
import { TickData } from '@/lib/constants/pools';
import { formatNumber } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { Info } from 'lucide-react';

interface LiquidityChartProps {
  pool: Pool;
  tickData: TickData[];
  className?: string;
}

export function LiquidityChart({ pool, tickData, className }: LiquidityChartProps) {
  if (tickData.length === 0) {
    return (
      <div className={cn('rounded-xl border border-border bg-surface p-8', className)}>
        <div className="text-center text-muted-foreground">
          No liquidity data available
        </div>
      </div>
    );
  }

  // Find max liquidity for scaling
  const maxLiquidity = Math.max(
    ...tickData.map((t) => Number(t.liquidityGross) / 1e18)
  );

  // Current price position
  const currentTick = pool.tick;
  const minTick = Math.min(...tickData.map((t) => t.tickIdx));
  const maxTick = Math.max(...tickData.map((t) => t.tickIdx));
  const tickRange = maxTick - minTick;
  const currentPosition = ((currentTick - minTick) / tickRange) * 100;

  return (
    <div className={cn('rounded-xl border border-border bg-surface p-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold mb-1">Liquidity Distribution</h3>
          <p className="text-sm text-muted-foreground">
            Active liquidity across price ranges
          </p>
        </div>
        <button className="p-2 rounded-lg hover:bg-surface-secondary transition-colors">
          <Info className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Chart */}
      <div className="relative h-64 mb-4">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-8 w-16 flex flex-col justify-between text-xs text-muted-foreground">
          <div className="text-right pr-2">{formatNumber(maxLiquidity, 0)}</div>
          <div className="text-right pr-2">{formatNumber(maxLiquidity * 0.75, 0)}</div>
          <div className="text-right pr-2">{formatNumber(maxLiquidity * 0.5, 0)}</div>
          <div className="text-right pr-2">{formatNumber(maxLiquidity * 0.25, 0)}</div>
          <div className="text-right pr-2">0</div>
        </div>

        {/* Chart area */}
        <div className="absolute left-20 right-0 top-0 bottom-8">
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-px bg-border" />
            ))}
          </div>

          {/* Bars */}
          <div className="absolute inset-0 flex items-end gap-px">
            {tickData.map((tick, index) => {
              const height = (Number(tick.liquidityGross) / 1e18 / maxLiquidity) * 100;
              const isNearCurrent = Math.abs(tick.tickIdx - currentTick) < pool.tickSpacing * 5;

              return (
                <div
                  key={index}
                  className="flex-1 group relative"
                  style={{ height: `${height}%` }}
                >
                  <div
                    className={cn(
                      'h-full transition-colors',
                      isNearCurrent
                        ? 'bg-primary hover:bg-primary/80'
                        : 'bg-primary/30 hover:bg-primary/50'
                    )}
                  />

                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                    <div className="bg-surface-secondary border border-border rounded-lg p-2 text-xs whitespace-nowrap shadow-lg">
                      <div className="font-medium mb-1">
                        Price: {formatNumber(tick.price, 6)}
                      </div>
                      <div className="text-muted-foreground">
                        Liquidity: {formatNumber(Number(tick.liquidityGross) / 1e18, 2)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Current price indicator */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-green-500 z-10"
            style={{ left: `${currentPosition}%` }}
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <div className="bg-green-500 text-white text-xs font-medium px-2 py-1 rounded">
                Current
              </div>
            </div>
          </div>
        </div>

        {/* X-axis labels */}
        <div className="absolute left-20 right-0 bottom-0 h-8 flex justify-between items-center text-xs text-muted-foreground">
          <div>{formatNumber(tickData[0]?.price || 0, 6)}</div>
          <div>{formatNumber(tickData[Math.floor(tickData.length / 2)]?.price || 0, 6)}</div>
          <div>{formatNumber(tickData[tickData.length - 1]?.price || 0, 6)}</div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-primary" />
          <span className="text-muted-foreground">Active Range</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-primary/30" />
          <span className="text-muted-foreground">Out of Range</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-green-500" />
          <span className="text-muted-foreground">Current Price</span>
        </div>
      </div>
    </div>
  );
}
