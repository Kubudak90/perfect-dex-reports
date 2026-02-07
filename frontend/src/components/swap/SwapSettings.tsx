'use client';

import { useState } from 'react';
import { Settings, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils/cn';
import { useSwapStore } from '@/stores/useSwapStore';

const SLIPPAGE_PRESETS = [0.1, 0.5, 1.0];

export function SwapSettings() {
  const {
    slippageTolerance,
    deadline,
    expertMode,
    multihopEnabled,
    setSlippage,
    setDeadline,
    setExpertMode,
    setMultihopEnabled,
  } = useSwapStore();

  const [customSlippage, setCustomSlippage] = useState('');
  const [customDeadline, setCustomDeadline] = useState('');

  const handleSlippagePreset = (value: number) => {
    setSlippage(value);
    setCustomSlippage('');
  };

  const handleCustomSlippage = (value: string) => {
    setCustomSlippage(value);
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0 && num <= 50) {
      setSlippage(num);
    }
  };

  const handleCustomDeadline = (value: string) => {
    setCustomDeadline(value);
    const num = parseInt(value);
    if (!isNaN(num) && num > 0 && num <= 4320) {
      // Max 3 days
      setDeadline(num);
    }
  };

  const isCustomSlippage = !SLIPPAGE_PRESETS.includes(slippageTolerance);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="p-2 rounded-lg hover:bg-surface-secondary transition-colors"
          aria-label="Swap settings"
        >
          <Settings className="h-5 w-5 text-muted-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="end">
        <div className="space-y-4">
          {/* Header */}
          <div>
            <h3 className="font-semibold mb-1">Settings</h3>
            <p className="text-sm text-muted-foreground">
              Customize your swap preferences
            </p>
          </div>

          {/* Slippage Tolerance */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm font-medium">Slippage tolerance</label>
              <Info className="h-3 w-3 text-muted-foreground" />
            </div>

            <div className="flex gap-2 mb-2">
              {SLIPPAGE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleSlippagePreset(preset)}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    slippageTolerance === preset && !isCustomSlippage
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface-secondary hover:bg-surface-tertiary'
                  )}
                >
                  {preset}%
                </button>
              ))}
            </div>

            <div className="relative">
              <Input
                type="text"
                placeholder="Custom"
                value={customSlippage || (isCustomSlippage ? slippageTolerance : '')}
                onChange={(e) => handleCustomSlippage(e.target.value)}
                className={cn(
                  'text-right pr-8',
                  isCustomSlippage && 'border-primary'
                )}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                %
              </span>
            </div>

            {slippageTolerance > 5 && (
              <p className="text-xs text-destructive mt-1">
                High slippage tolerance may result in unfavorable rates
              </p>
            )}
          </div>

          {/* Transaction Deadline */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm font-medium">Transaction deadline</label>
              <Info className="h-3 w-3 text-muted-foreground" />
            </div>

            <div className="relative">
              <Input
                type="text"
                placeholder="20"
                value={customDeadline || deadline}
                onChange={(e) => handleCustomDeadline(e.target.value)}
                className="text-right pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                minutes
              </span>
            </div>
          </div>

          {/* Multihop */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Multihop</div>
              <div className="text-xs text-muted-foreground">
                Allow multi-hop routes
              </div>
            </div>
            <button
              onClick={() => setMultihopEnabled(!multihopEnabled)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                multihopEnabled ? 'bg-primary' : 'bg-surface-secondary'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                  multihopEnabled ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>

          {/* Expert Mode */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Expert mode</div>
              <div className="text-xs text-muted-foreground">
                Bypass confirmation prompts
              </div>
            </div>
            <button
              onClick={() => setExpertMode(!expertMode)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                expertMode ? 'bg-primary' : 'bg-surface-secondary'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                  expertMode ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>

          {expertMode && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-xs text-destructive">
                Expert mode is enabled. Use with caution.
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
