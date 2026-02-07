'use client';

import Link from 'next/link';
import { AddLiquidityForm } from '@/components/liquidity/AddLiquidityForm';
import { FadeIn } from '@/components/ui/AnimatedComponents';
import { ArrowLeft, Info } from 'lucide-react';

export default function AddLiquidityPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <FadeIn>
          <div className="mb-8">
            <Link
              href="/pools"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Pools
            </Link>

            <h1 className="text-3xl font-bold mb-2">Add Liquidity</h1>
            <p className="text-muted-foreground">
              Provide liquidity to earn trading fees
            </p>
          </div>
        </FadeIn>

        {/* Info Banner */}
        <FadeIn delay={0.1}>
          <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="space-y-1">
                <h3 className="font-semibold text-primary">
                  Concentrated Liquidity
                </h3>
                <p className="text-sm text-muted-foreground">
                  Choose a price range to concentrate your liquidity and maximize
                  fee earnings. Your position will only earn fees when the price is
                  within your selected range.
                </p>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Form */}
        <FadeIn delay={0.2}>
          <AddLiquidityForm />
        </FadeIn>

        {/* Additional Info */}
        <FadeIn delay={0.3}>
          <div className="mt-8 space-y-4">
            <div className="rounded-xl border border-border bg-surface p-4">
              <h3 className="font-semibold mb-3">How it works</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>
                    Select a token pair and fee tier based on expected volatility
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>
                    Choose a price range where you want to provide liquidity
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>
                    Deposit both tokens in the ratio determined by your range
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>
                    Earn fees proportional to your share when trades occur in your range
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <h3 className="font-semibold mb-3">Important Notes</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-orange-500">⚠</span>
                  <span>
                    <strong>Impermanent Loss:</strong> You may lose value compared
                    to holding tokens if prices change significantly
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-500">⚠</span>
                  <span>
                    <strong>Active Management:</strong> Concentrated positions may
                    need rebalancing as prices move
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-500">⚠</span>
                  <span>
                    <strong>Gas Costs:</strong> Consider gas fees when adding,
                    removing, or collecting fees from positions
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
