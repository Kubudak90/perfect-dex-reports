'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils/cn';

interface TokenLogoProps {
  src?: string;
  alt: string;
  size?: number;
  className?: string;
  symbol?: string;
}

/**
 * Token logo component with fallback
 */
export function TokenLogo({
  src,
  alt,
  size = 32,
  className,
  symbol,
}: TokenLogoProps) {
  const [error, setError] = useState(false);

  // Show fallback if no src or error
  if (!src || error) {
    return (
      <div
        className={cn(
          'rounded-full bg-gradient-to-br from-primary/20 to-blue-600/20 flex items-center justify-center text-muted-foreground font-semibold',
          className
        )}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {symbol ? symbol.slice(0, 2).toUpperCase() : '?'}
      </div>
    );
  }

  return (
    <div
      className={cn('rounded-full overflow-hidden bg-surface-secondary', className)}
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        className="rounded-full"
        onError={() => setError(true)}
        loading="lazy"
      />
    </div>
  );
}

/**
 * Token pair logo (overlapping)
 */
interface TokenPairLogoProps {
  token0Logo?: string;
  token1Logo?: string;
  token0Symbol?: string;
  token1Symbol?: string;
  size?: number;
  className?: string;
}

export function TokenPairLogo({
  token0Logo,
  token1Logo,
  token0Symbol,
  token1Symbol,
  size = 32,
  className,
}: TokenPairLogoProps) {
  return (
    <div className={cn('flex items-center', className)}>
      <TokenLogo
        src={token0Logo}
        alt={token0Symbol || 'Token 0'}
        symbol={token0Symbol}
        size={size}
        className="z-10"
      />
      <TokenLogo
        src={token1Logo}
        alt={token1Symbol || 'Token 1'}
        symbol={token1Symbol}
        size={size}
        className="-ml-2"
      />
    </div>
  );
}
