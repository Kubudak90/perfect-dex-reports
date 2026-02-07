'use client';

import { useState } from 'react';
import {
  getProtocolStats,
  getTVLData,
  getVolumeData,
  getFeesData,
  getTopPools,
  getTopTokens,
  get24hChange,
} from '@/lib/constants/analytics';
import { OverviewStats } from '@/components/analytics/OverviewStats';
import { TopPools } from '@/components/analytics/TopPools';
import { TopTokens } from '@/components/analytics/TopTokens';
import { AreaChart } from '@/components/charts/AreaChart';
import { BarChart } from '@/components/charts/BarChart';
import { Button } from '@/components/ui/Button';
import { FadeIn, StaggerChildren, StaggerItem } from '@/components/ui/AnimatedComponents';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format';

type TimeRange = '7D' | '30D' | '90D';

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30D');

  // Get data based on time range
  const days = timeRange === '7D' ? 7 : timeRange === '30D' ? 30 : 90;
  const tvlData = getTVLData(days);
  const volumeData = getVolumeData(days);
  const feesData = getFeesData(days);

  // Get protocol stats
  const stats = getProtocolStats();
  const topPools = getTopPools(5);
  const topTokens = getTopTokens(5);

  // Calculate 24h changes
  const tvlChange = get24hChange(tvlData);
  const volumeChange = get24hChange(volumeData);
  const feesChange = get24hChange(feesData);

  const timeRangeOptions: TimeRange[] = ['7D', '30D', '90D'];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <FadeIn>
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Analytics</h1>
            <p className="text-muted-foreground">
              Explore protocol metrics and statistics
            </p>
          </div>
        </FadeIn>

        {/* Overview Stats */}
        <FadeIn delay={0.1}>
          <OverviewStats
            stats={stats}
            tvlChange={tvlChange}
            volumeChange={volumeChange}
            feesChange={feesChange}
            className="mb-8"
          />
        </FadeIn>

        {/* Time Range Selector */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Charts</h2>
          <div className="flex items-center gap-2">
            {timeRangeOptions.map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setTimeRange(range)}
              >
                {range}
              </Button>
            ))}
          </div>
        </div>

        {/* Charts */}
        <FadeIn delay={0.2}>
          <StaggerChildren>
            <div className="space-y-6 mb-8">
              {/* TVL Chart */}
              <StaggerItem>
                <div className="rounded-xl border border-border bg-surface p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-1">Total Value Locked</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold">
                        {formatCurrency(tvlData[tvlData.length - 1].value)}
                      </span>
                      <span
                        className={cn(
                          'text-sm font-medium',
                          tvlChange >= 0 ? 'text-green-500' : 'text-red-500'
                        )}
                      >
                        {tvlChange >= 0 ? '+' : ''}
                        {tvlChange.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <AreaChart
                    data={tvlData}
                    height={300}
                    color="rgb(59, 130, 246)"
                    valueFormatter={(value) =>
                      value >= 1000000
                        ? `$${(value / 1000000).toFixed(1)}M`
                        : formatCurrency(value)
                    }
                  />
                </div>
              </StaggerItem>

              {/* Volume Chart */}
              <StaggerItem>
                <div className="rounded-xl border border-border bg-surface p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-1">Volume</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold">
                        {formatCurrency(volumeData[volumeData.length - 1].value)}
                      </span>
                      <span
                        className={cn(
                          'text-sm font-medium',
                          volumeChange >= 0 ? 'text-green-500' : 'text-red-500'
                        )}
                      >
                        {volumeChange >= 0 ? '+' : ''}
                        {volumeChange.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <BarChart
                    data={volumeData}
                    height={300}
                    color="rgb(139, 92, 246)"
                    valueFormatter={(value) =>
                      value >= 1000000
                        ? `$${(value / 1000000).toFixed(1)}M`
                        : formatCurrency(value)
                    }
                  />
                </div>
              </StaggerItem>

              {/* Fees Chart */}
              <StaggerItem>
                <div className="rounded-xl border border-border bg-surface p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-1">Fees</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold">
                        {formatCurrency(feesData[feesData.length - 1].value)}
                      </span>
                      <span
                        className={cn(
                          'text-sm font-medium',
                          feesChange >= 0 ? 'text-green-500' : 'text-red-500'
                        )}
                      >
                        {feesChange >= 0 ? '+' : ''}
                        {feesChange.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <AreaChart
                    data={feesData}
                    height={300}
                    color="rgb(34, 197, 94)"
                    valueFormatter={(value) =>
                      value >= 1000
                        ? `$${(value / 1000).toFixed(1)}K`
                        : formatCurrency(value)
                    }
                  />
                </div>
              </StaggerItem>
            </div>
          </StaggerChildren>
        </FadeIn>

        {/* Top Pools & Tokens */}
        <FadeIn delay={0.3}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TopPools pools={topPools} />
            <TopTokens tokens={topTokens} />
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
