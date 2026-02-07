'use client';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';
import { AlertTriangle } from 'lucide-react';

interface SwapButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  text: string;
  warning?: boolean;
  className?: string;
}

export function SwapButton({
  onClick,
  disabled,
  loading,
  text,
  warning,
  className,
}: SwapButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      loading={loading}
      size="lg"
      className={cn(
        'w-full',
        warning &&
          !disabled &&
          'bg-orange-500 hover:bg-orange-600 text-white',
        className
      )}
    >
      {warning && !loading && (
        <AlertTriangle className="h-4 w-4 mr-2" />
      )}
      {text}
    </Button>
  );
}
