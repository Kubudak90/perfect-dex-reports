'use client';

import { cn } from '@/lib/utils/cn';
import { formatPrice } from '@/lib/utils/tick';

interface RangePreset {
  label: string;
  priceLower: number;
  priceUpper: number;
  tickLower: number;
  tickUpper: number;
  width: number;
}

interface RangePresetsProps {
  presets: RangePreset[];
  selectedPreset: string | null;
  currentPrice: number;
  onSelectPreset: (preset: RangePreset) => void;
  className?: string;
}

export function RangePresets({
  presets,
  selectedPreset,
  currentPrice,
  onSelectPreset,
  className,
}: RangePresetsProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Select Range</span>
        <span className="text-xs text-muted-foreground">
          Current: {formatPrice(currentPrice, 4)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {presets.map((preset) => {
          const isSelected = selectedPreset === preset.label;
          const isFullRange = preset.label === 'Full Range';

          return (
            <button
              key={preset.label}
              onClick={() => onSelectPreset(preset)}
              className={cn(
                'p-3 rounded-xl border-2 transition-all text-left',
                'hover:border-primary/50',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-surface-secondary'
              )}
            >
              <div className="flex items-start justify-between mb-1">
                <span className="font-semibold text-sm">{preset.label}</span>
                {!isFullRange && (
                  <span className="text-xs text-muted-foreground">
                    ±{preset.width.toFixed(0)}%
                  </span>
                )}
              </div>

              <div className="space-y-0.5 text-xs text-muted-foreground">
                {isFullRange ? (
                  <div>0 ↔ ∞</div>
                ) : (
                  <>
                    <div>
                      Min: {formatPrice(preset.priceLower, 4)}
                    </div>
                    <div>
                      Max: {formatPrice(preset.priceUpper, 4)}
                    </div>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selectedPreset && (
        <div className="p-3 rounded-lg bg-surface-secondary text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-muted-foreground">Selected Range:</span>
            <span className="font-medium">{selectedPreset}</span>
          </div>
          {selectedPreset !== 'Full Range' && (
            <p className="text-muted-foreground mt-1">
              Your liquidity will be active between the min and max prices.
              Narrower ranges = higher fee concentration but higher risk of going out of range.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
