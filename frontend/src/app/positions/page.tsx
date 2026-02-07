'use client';

import Link from 'next/link';
import { useAccount } from 'wagmi';
import { calculatePortfolioSummary } from '@/lib/constants/positions';
import { usePositions } from '@/hooks/liquidity/usePositions';
import { PortfolioSummary } from '@/components/portfolio/PortfolioSummary';
import { PositionCard } from '@/components/portfolio/PositionCard';
import { Button } from '@/components/ui/Button';
import { FadeIn, StaggerChildren, StaggerItem } from '@/components/ui/AnimatedComponents';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Plus, Inbox, AlertTriangle } from 'lucide-react';

export default function PositionsPage() {
  const { address, isConnected } = useAccount();
  const { positions, loading, error, refetch } = usePositions(
    isConnected ? address : undefined
  );

  const summary = calculatePortfolioSummary(positions);

  // Filter positions
  const activePositions = positions.filter((p) => p.inRange);
  const inactivePositions = positions.filter((p) => !p.inRange);

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">My Positions</h1>
              <p className="text-muted-foreground">
                View and manage your liquidity positions
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <EmptyState
              icon={Inbox}
              title="Connect your wallet"
              description="Connect your wallet to view and manage your liquidity positions"
            />
          </FadeIn>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <FadeIn>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">My Positions</h1>
              <p className="text-muted-foreground">
                View and manage your liquidity positions
              </p>
            </div>

            <Link href="/add">
              <Button size="lg" className="gap-2">
                <Plus className="h-4 w-4" />
                New Position
              </Button>
            </Link>
          </div>
        </FadeIn>

        {loading ? (
          <FadeIn delay={0.1}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-border bg-surface p-6">
                  <Skeleton variant="text" width={150} className="mb-4" />
                  <Skeleton variant="text" width={100} height={40} className="mb-2" />
                  <Skeleton variant="text" width="100%" />
                </div>
              ))}
            </div>
          </FadeIn>
        ) : error ? (
          <FadeIn delay={0.1}>
            <div className="rounded-xl border border-border bg-surface p-8 text-center">
              <AlertTriangle className="h-10 w-10 text-orange-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Failed to load positions</h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={refetch} variant="secondary">
                Try Again
              </Button>
            </div>
          </FadeIn>
        ) : positions.length === 0 ? (
          <FadeIn delay={0.1}>
            <EmptyState
              icon={Inbox}
              title="No positions yet"
              description="Create your first liquidity position to start earning fees"
              action={{
                label: 'Add Liquidity',
                onClick: () => window.location.href = '/add',
                icon: Plus,
              }}
            />
          </FadeIn>
        ) : (
          <>
            {/* Portfolio Summary */}
            <FadeIn delay={0.1}>
              <PortfolioSummary summary={summary} className="mb-8" />
            </FadeIn>

            {/* Active Positions */}
            {activePositions.length > 0 && (
              <FadeIn delay={0.2}>
                <div className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">
                    Active Positions ({activePositions.length})
                  </h2>
                  <StaggerChildren>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {activePositions.map((position) => (
                        <StaggerItem key={position.tokenId}>
                          <PositionCard position={position} poolInfo={position.pool} />
                        </StaggerItem>
                      ))}
                    </div>
                  </StaggerChildren>
                </div>
              </FadeIn>
            )}

            {/* Inactive Positions */}
            {inactivePositions.length > 0 && (
              <FadeIn delay={0.3}>
                <div>
                  <h2 className="text-xl font-semibold mb-4">
                    Out of Range ({inactivePositions.length})
                  </h2>
                  <StaggerChildren>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {inactivePositions.map((position) => (
                        <StaggerItem key={position.tokenId}>
                          <PositionCard position={position} poolInfo={position.pool} />
                        </StaggerItem>
                      ))}
                    </div>
                  </StaggerChildren>
                </div>
              </FadeIn>
            )}

            {/* Info Section */}
            <div className="mt-8 rounded-xl border border-border bg-surface p-6">
              <h3 className="font-semibold mb-3">Managing Your Positions</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Active positions are earning fees from trades. Keep an eye on
                  your positions as price moves may take them out of range.
                </p>
                <p>
                  Out of range positions are not earning fees. You can remove
                  liquidity or wait for the price to return to your range.
                </p>
                <p className="text-orange-500">
                  <strong>Note:</strong> Always consider gas costs when
                  collecting fees or adjusting positions.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
