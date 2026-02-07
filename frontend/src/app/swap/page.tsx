'use client';

import { SwapWidget } from '@/components/swap/SwapWidget';
import { FadeIn, StaggerChildren, StaggerItem } from '@/components/ui/AnimatedComponents';

export default function SwapPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col items-center justify-center min-h-[600px]">
        <div className="w-full max-w-[480px]">
          <FadeIn>
            <h1 className="text-3xl font-bold text-center mb-8">Swap</h1>
          </FadeIn>

          {/* Swap Widget */}
          <FadeIn delay={0.1}>
            <SwapWidget />
          </FadeIn>

          {/* Info Cards */}
          <FadeIn delay={0.2}>
            <StaggerChildren>
              <div className="mt-8 grid grid-cols-2 gap-4">
                <StaggerItem>
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <p className="text-sm text-muted-foreground mb-1">24h Volume</p>
                    <p className="text-xl font-semibold">$0.00</p>
                  </div>
                </StaggerItem>
                <StaggerItem>
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <p className="text-sm text-muted-foreground mb-1">Total Swaps</p>
                    <p className="text-xl font-semibold">0</p>
                  </div>
                </StaggerItem>
              </div>
            </StaggerChildren>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}
