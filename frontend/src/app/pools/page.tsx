'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PoolTable } from '@/components/pool/PoolTable';
import { getMockPools } from '@/lib/constants/pools';
import { Button } from '@/components/ui/Button';
import { SkeletonTable, Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { FadeIn, StaggerChildren, StaggerItem } from '@/components/ui/AnimatedComponents';
import { Plus, TrendingUp } from 'lucide-react';

export default function PoolsPage() {
  const [pools, setPools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Simulate API call
    const loadPools = async () => {
      try {
        setLoading(true);
        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 800));
        const data = getMockPools();
        setPools(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadPools();
  }, []);

  // Calculate protocol stats
  const totalTVL = pools.reduce((sum, pool) => sum + pool.tvlUsd, 0);
  const totalVolume24h = pools.reduce((sum, pool) => sum + pool.volume24hUsd, 0);
  const totalFees24h = pools.reduce((sum, pool) => sum + pool.fees24hUsd, 0);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <FadeIn>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Liquidity Pools</h1>
              <p className="text-muted-foreground">
                Browse all pools and earn fees by providing liquidity
              </p>
            </div>

            <Link href="/add">
              <Button size="lg" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Liquidity
              </Button>
            </Link>
          </div>
        </FadeIn>

        {/* Protocol Stats */}
        {loading ? (
          <FadeIn delay={0.1}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-border bg-surface p-6">
                  <Skeleton variant="text" width={150} className="mb-2" />
                  <Skeleton variant="text" width={100} height={40} />
                </div>
              ))}
            </div>
          </FadeIn>
        ) : (
          <FadeIn delay={0.1}>
            <StaggerChildren>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <StaggerItem>
                  <div className="rounded-xl border border-border bg-surface p-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <TrendingUp className="h-4 w-4" />
                      Total Value Locked
                    </div>
                    <div className="text-3xl font-bold">
                      ${(totalTVL / 1e6).toFixed(2)}M
                    </div>
                  </div>
                </StaggerItem>

                <StaggerItem>
                  <div className="rounded-xl border border-border bg-surface p-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <TrendingUp className="h-4 w-4" />
                      Volume 24H
                    </div>
                    <div className="text-3xl font-bold">
                      ${(totalVolume24h / 1e6).toFixed(2)}M
                    </div>
                  </div>
                </StaggerItem>

                <StaggerItem>
                  <div className="rounded-xl border border-border bg-surface p-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <TrendingUp className="h-4 w-4" />
                      Fees 24H
                    </div>
                    <div className="text-3xl font-bold">
                      ${(totalFees24h / 1e3).toFixed(1)}K
                    </div>
                  </div>
                </StaggerItem>
              </div>
            </StaggerChildren>
          </FadeIn>
        )}

        {/* Pool Table */}
        {loading ? (
          <FadeIn delay={0.2}>
            <SkeletonTable rows={8} />
          </FadeIn>
        ) : error ? (
          <FadeIn delay={0.2}>
            <ErrorState
              title="Failed to load pools"
              message={error.message}
              onRetry={() => window.location.reload()}
            />
          </FadeIn>
        ) : (
          <FadeIn delay={0.2}>
            <PoolTable pools={pools} />
          </FadeIn>
        )}

        {/* Info Section */}
        <div className="mt-8 rounded-xl border border-border bg-surface p-6">
          <h3 className="font-semibold mb-3">About Liquidity Pools</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Liquidity pools are the foundation of BaseBook DEX. When you provide
              liquidity, you earn a share of trading fees proportional to your
              contribution to the pool.
            </p>
            <p>
              BaseBook uses concentrated liquidity (Uniswap v3 style), allowing you
              to provide liquidity within custom price ranges for increased capital
              efficiency.
            </p>
            <p className="text-orange-500">
              <strong>Note:</strong> Providing liquidity involves impermanent loss
              risk. Make sure you understand the risks before adding liquidity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
