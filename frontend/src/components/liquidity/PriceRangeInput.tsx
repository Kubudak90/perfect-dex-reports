'use client';

import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils/cn';
import { Info } from 'lucide-react';

interface PriceRangeInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  currentPrice?: number;
  symbol?: string;
  error?: boolean;
  helperText?: string;
  className?: string;
}

export function PriceRangeInput({
  label,
  value,
  onChange,
  currentPrice,
  symbol = '',
  error,
  helperText,
  className,
}: PriceRangeInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;

    // Allow empty, numbers, and single decimal point
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      onChange(val);
    }
  };

  const deviation = currentPrice && value
    ? ((parseFloat(value) - currentPrice) / currentPrice) * 100
    : null;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Label */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        {currentPrice && (
          <span className="text-xs text-muted-foreground">
            Current: {currentPrice.toFixed(6)}
          </span>
        )}
      </div>

      {/* Input */}
      <div className="relative">
        <Input
          type="text"
          inputMode="decimal"
          placeholder="0.0"
          value={value}
          onChange={handleChange}
          error={error}
          className="pr-20"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          {symbol}
        </div>
      </div>

      {/* Deviation from current */}
      {deviation !== null && !isNaN(deviation) && (
        <div
          className={cn(
            'text-xs',
            deviation > 0 ? 'text-green-500' : 'text-red-500'
          )}
        >
          {deviation > 0 ? '+' : ''}
          {deviation.toFixed(2)}% from current
        </div>
      )}

      {/* Helper text */}
      {helperText && (
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{helperText}</span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="text-xs text-destructive">
          Invalid price range
        </div>
      )}
    </div>
  );
}
