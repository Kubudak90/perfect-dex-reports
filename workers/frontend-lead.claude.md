# BaseBook DEX - Frontend Lead Claude Configuration

## Role Definition
You are the AI assistant for the Frontend Lead Developer of BaseBook DEX. You specialize in building modern, performant, and user-friendly DeFi interfaces using Next.js 14, wagmi v2, and TailwindCSS.

## Primary Responsibilities
- Next.js 14 App Router architecture
- All page implementations (swap, pools, liquidity, portfolio, analytics, governance)
- Component library development
- wagmi v2 + wallet integration
- State management (Zustand + TanStack Query)
- Charts and data visualization
- Performance optimization
- Responsive design & accessibility

## Technology Stack
```typescript
// Framework
Next.js: 14.x (App Router)
React: 18.x
TypeScript: 5.x

// Web3
wagmi: 2.x
viem: 2.x
Wallet UI: RainbowKit or ConnectKit

// Styling
TailwindCSS: 3.x
Radix UI (primitives)
Framer Motion (animations)

// State
Zustand (client state)
TanStack Query (server state)

// Charts
TradingView Lightweight Charts
Recharts

// Forms
React Hook Form
Zod (validation)

// Testing
Vitest
React Testing Library
Playwright (E2E)
```

## Project Structure
```
frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home (redirect to /swap)
│   │   ├── providers.tsx       # All providers wrapper
│   │   │
│   │   ├── swap/
│   │   │   └── page.tsx
│   │   ├── pools/
│   │   │   ├── page.tsx
│   │   │   └── [poolId]/
│   │   │       └── page.tsx
│   │   ├── add/
│   │   │   └── [[...tokens]]/
│   │   │       └── page.tsx
│   │   ├── remove/
│   │   │   └── [tokenId]/
│   │   │       └── page.tsx
│   │   ├── positions/
│   │   │   ├── page.tsx
│   │   │   └── [tokenId]/
│   │   │       └── page.tsx
│   │   ├── analytics/
│   │   │   └── page.tsx
│   │   ├── governance/
│   │   │   ├── page.tsx
│   │   │   └── [proposalId]/
│   │   │       └── page.tsx
│   │   └── portfolio/
│   │       └── page.tsx
│   │
│   ├── components/
│   │   ├── ui/                 # Primitive components
│   │   ├── swap/               # Swap-specific
│   │   ├── pool/               # Pool-specific
│   │   ├── liquidity/          # Liquidity-specific
│   │   ├── portfolio/          # Portfolio-specific
│   │   ├── governance/         # Governance-specific
│   │   ├── analytics/          # Analytics-specific
│   │   ├── charts/             # Chart components
│   │   ├── layout/             # Layout components
│   │   ├── wallet/             # Wallet components
│   │   └── common/             # Shared components
│   │
│   ├── hooks/
│   │   ├── contracts/          # Contract interaction
│   │   ├── swap/               # Swap hooks
│   │   ├── pool/               # Pool hooks
│   │   ├── liquidity/          # Liquidity hooks
│   │   ├── token/              # Token hooks
│   │   ├── analytics/          # Analytics hooks
│   │   ├── governance/         # Governance hooks
│   │   └── common/             # Utility hooks
│   │
│   ├── lib/
│   │   ├── constants/          # Addresses, configs
│   │   ├── utils/              # Helper functions
│   │   ├── api/                # API client
│   │   ├── wagmi/              # wagmi config
│   │   └── subgraph/           # GraphQL
│   │
│   ├── stores/                 # Zustand stores
│   ├── types/                  # TypeScript types
│   └── styles/                 # Global styles
│
├── public/
├── tests/
├── package.json
├── tailwind.config.ts
├── next.config.js
└── tsconfig.json
```

## Component Guidelines

### Component Template
```tsx
// components/swap/SwapWidget.tsx
'use client';

import { useState, useCallback } from 'react';
import { useSwap } from '@/hooks/swap/useSwap';
import { TokenInput } from './TokenInput';
import { SwapButton } from './SwapButton';
import { SwapDetails } from './SwapDetails';
import { cn } from '@/lib/utils';

interface SwapWidgetProps {
  className?: string;
  defaultTokenIn?: string;
  defaultTokenOut?: string;
}

export function SwapWidget({
  className,
  defaultTokenIn,
  defaultTokenOut,
}: SwapWidgetProps) {
  const {
    tokenIn,
    tokenOut,
    amountIn,
    amountOut,
    setTokenIn,
    setTokenOut,
    setAmountIn,
    switchTokens,
    quote,
    isQuoteLoading,
    swap,
    isSwapping,
    canSwap,
    buttonText,
  } = useSwap({
    defaultTokenIn,
    defaultTokenOut,
  });

  return (
    <div className={cn(
      'w-full max-w-[480px] rounded-2xl bg-surface p-4',
      'border border-border shadow-lg',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Swap</h2>
        <SwapSettings />
      </div>

      {/* Token Inputs */}
      <div className="space-y-2">
        <TokenInput
          label="You pay"
          token={tokenIn}
          amount={amountIn}
          onTokenSelect={setTokenIn}
          onAmountChange={setAmountIn}
          showBalance
        />

        {/* Switch Button */}
        <div className="flex justify-center -my-2 relative z-10">
          <button
            onClick={switchTokens}
            className="p-2 rounded-full bg-surface-secondary hover:bg-surface-tertiary transition-colors"
          >
            <ArrowDownIcon className="w-4 h-4" />
          </button>
        </div>

        <TokenInput
          label="You receive"
          token={tokenOut}
          amount={amountOut}
          onTokenSelect={setTokenOut}
          readonly
          isLoading={isQuoteLoading}
        />
      </div>

      {/* Swap Details */}
      {quote && <SwapDetails quote={quote} className="mt-4" />}

      {/* Swap Button */}
      <SwapButton
        onClick={swap}
        disabled={!canSwap}
        loading={isSwapping}
        className="mt-4 w-full"
      >
        {buttonText}
      </SwapButton>
    </div>
  );
}
```

### UI Component (Radix-based)
```tsx
// components/ui/Button.tsx
import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-input bg-transparent hover:bg-accent',
        ghost: 'hover:bg-accent',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-4 text-base',
        lg: 'h-14 px-6 text-lg',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <Spinner className="mr-2 h-4 w-4" />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);

Button.displayName = 'Button';
```

## Hook Patterns

### useSwap Hook
```tsx
// hooks/swap/useSwap.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { useDebounce } from '@/hooks/common/useDebounce';
import { useSwapQuote } from './useSwapQuote';
import { useSwapCallback } from './useSwapCallback';
import { useTokenApproval } from '@/hooks/token/useTokenApproval';
import { useSwapStore } from '@/stores/useSwapStore';
import type { Token, SwapQuote } from '@/types';

interface UseSwapConfig {
  defaultTokenIn?: string;
  defaultTokenOut?: string;
  onSuccess?: (txHash: string) => void;
  onError?: (error: Error) => void;
}

interface UseSwapReturn {
  // State
  tokenIn: Token | null;
  tokenOut: Token | null;
  amountIn: string;
  amountOut: string;
  isExactIn: boolean;
  
  // Quote
  quote: SwapQuote | null;
  isQuoteLoading: boolean;
  isQuoteFetching: boolean;
  quoteError: Error | null;
  
  // Pricing
  priceImpact: number;
  priceImpactSeverity: 'low' | 'medium' | 'high' | 'severe';
  
  // Approval
  isApprovalNeeded: boolean;
  isApproving: boolean;
  approve: () => Promise<void>;
  
  // Swap
  swap: () => Promise<void>;
  isSwapping: boolean;
  
  // Actions
  setTokenIn: (token: Token) => void;
  setTokenOut: (token: Token) => void;
  setAmountIn: (amount: string) => void;
  switchTokens: () => void;
  reset: () => void;
  
  // Validation
  insufficientBalance: boolean;
  insufficientLiquidity: boolean;
  canSwap: boolean;
  buttonText: string;
}

export function useSwap(config: UseSwapConfig = {}): UseSwapReturn {
  const { address } = useAccount();
  const store = useSwapStore();
  
  const {
    tokenIn,
    tokenOut,
    amountIn,
    slippageTolerance,
    setTokenIn: setTokenInStore,
    setTokenOut: setTokenOutStore,
    setAmountIn: setAmountInStore,
    switchTokens: switchTokensStore,
    reset: resetStore,
  } = store;
  
  // Debounce amount for quote fetching
  const debouncedAmountIn = useDebounce(amountIn, 300);
  
  // Parse amount to raw
  const amountInRaw = useMemo(() => {
    if (!tokenIn || !amountIn) return 0n;
    try {
      return parseUnits(amountIn, tokenIn.decimals);
    } catch {
      return 0n;
    }
  }, [amountIn, tokenIn]);
  
  // Fetch quote
  const {
    data: quote,
    isLoading: isQuoteLoading,
    isFetching: isQuoteFetching,
    error: quoteError,
  } = useSwapQuote({
    tokenIn: tokenIn?.address,
    tokenOut: tokenOut?.address,
    amountIn: debouncedAmountIn,
    enabled: !!tokenIn && !!tokenOut && amountInRaw > 0n,
  });
  
  // Format amount out
  const amountOut = useMemo(() => {
    if (!quote || !tokenOut) return '';
    return formatUnits(BigInt(quote.amountOut), tokenOut.decimals);
  }, [quote, tokenOut]);
  
  // Check balance
  const { data: balance } = useBalance({
    address,
    token: tokenIn?.isNative ? undefined : tokenIn?.address,
  });
  
  const insufficientBalance = useMemo(() => {
    if (!balance || amountInRaw === 0n) return false;
    return amountInRaw > balance.value;
  }, [balance, amountInRaw]);
  
  // Approval
  const {
    isApprovalNeeded,
    isApproving,
    approve,
  } = useTokenApproval({
    token: tokenIn?.address,
    amount: amountInRaw,
    spender: SWAP_ROUTER_ADDRESS,
    enabled: !!tokenIn && !tokenIn.isNative,
  });
  
  // Swap callback
  const {
    swap: executeSwap,
    isSwapping,
  } = useSwapCallback({
    quote,
    slippage: slippageTolerance,
    onSuccess: config.onSuccess,
    onError: config.onError,
  });
  
  // Price impact
  const priceImpact = quote?.priceImpact ?? 0;
  const priceImpactSeverity = useMemo(() => {
    if (priceImpact < 1) return 'low';
    if (priceImpact < 3) return 'medium';
    if (priceImpact < 5) return 'high';
    return 'severe';
  }, [priceImpact]);
  
  // Validation
  const insufficientLiquidity = quoteError?.message?.includes('insufficient liquidity') ?? false;
  
  const canSwap = useMemo(() => {
    return (
      !!address &&
      !!tokenIn &&
      !!tokenOut &&
      amountInRaw > 0n &&
      !!quote &&
      !insufficientBalance &&
      !insufficientLiquidity &&
      !isApprovalNeeded &&
      !isSwapping
    );
  }, [
    address,
    tokenIn,
    tokenOut,
    amountInRaw,
    quote,
    insufficientBalance,
    insufficientLiquidity,
    isApprovalNeeded,
    isSwapping,
  ]);
  
  // Button text
  const buttonText = useMemo(() => {
    if (!address) return 'Connect Wallet';
    if (!tokenIn || !tokenOut) return 'Select Token';
    if (!amountIn || amountInRaw === 0n) return 'Enter Amount';
    if (insufficientBalance) return 'Insufficient Balance';
    if (isQuoteLoading) return 'Getting Quote...';
    if (insufficientLiquidity) return 'Insufficient Liquidity';
    if (isApprovalNeeded) return `Approve ${tokenIn.symbol}`;
    if (isApproving) return 'Approving...';
    if (isSwapping) return 'Swapping...';
    return 'Swap';
  }, [
    address,
    tokenIn,
    tokenOut,
    amountIn,
    amountInRaw,
    insufficientBalance,
    isQuoteLoading,
    insufficientLiquidity,
    isApprovalNeeded,
    isApproving,
    isSwapping,
  ]);
  
  // Actions
  const swap = useCallback(async () => {
    if (isApprovalNeeded) {
      await approve();
    } else {
      await executeSwap();
    }
  }, [isApprovalNeeded, approve, executeSwap]);
  
  return {
    // State
    tokenIn,
    tokenOut,
    amountIn,
    amountOut,
    isExactIn: true,
    
    // Quote
    quote,
    isQuoteLoading,
    isQuoteFetching,
    quoteError,
    
    // Pricing
    priceImpact,
    priceImpactSeverity,
    
    // Approval
    isApprovalNeeded,
    isApproving,
    approve,
    
    // Swap
    swap,
    isSwapping,
    
    // Actions
    setTokenIn: setTokenInStore,
    setTokenOut: setTokenOutStore,
    setAmountIn: setAmountInStore,
    switchTokens: switchTokensStore,
    reset: resetStore,
    
    // Validation
    insufficientBalance,
    insufficientLiquidity,
    canSwap,
    buttonText,
  };
}
```

## Zustand Store

### Swap Store
```typescript
// stores/useSwapStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Token } from '@/types';

interface SwapState {
  // Token selection
  tokenIn: Token | null;
  tokenOut: Token | null;
  
  // Amounts
  amountIn: string;
  isExactIn: boolean;
  
  // Settings
  slippageTolerance: number;
  deadline: number;
  expertMode: boolean;
  multihopEnabled: boolean;
  
  // Recent tokens
  recentTokens: Token[];
}

interface SwapActions {
  setTokenIn: (token: Token) => void;
  setTokenOut: (token: Token) => void;
  setAmountIn: (amount: string) => void;
  switchTokens: () => void;
  setSlippage: (value: number) => void;
  setDeadline: (value: number) => void;
  setExpertMode: (value: boolean) => void;
  addRecentToken: (token: Token) => void;
  reset: () => void;
}

const initialState: SwapState = {
  tokenIn: null,
  tokenOut: null,
  amountIn: '',
  isExactIn: true,
  slippageTolerance: 0.5,
  deadline: 20,
  expertMode: false,
  multihopEnabled: true,
  recentTokens: [],
};

export const useSwapStore = create<SwapState & SwapActions>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      setTokenIn: (token) => {
        const { tokenOut, addRecentToken } = get();
        // If same token selected, switch
        if (tokenOut?.address === token.address) {
          set({ tokenIn: token, tokenOut: get().tokenIn });
        } else {
          set({ tokenIn: token });
        }
        addRecentToken(token);
      },
      
      setTokenOut: (token) => {
        const { tokenIn, addRecentToken } = get();
        if (tokenIn?.address === token.address) {
          set({ tokenOut: token, tokenIn: get().tokenOut });
        } else {
          set({ tokenOut: token });
        }
        addRecentToken(token);
      },
      
      setAmountIn: (amount) => set({ amountIn: amount }),
      
      switchTokens: () => set((state) => ({
        tokenIn: state.tokenOut,
        tokenOut: state.tokenIn,
        amountIn: '',
      })),
      
      setSlippage: (value) => set({ slippageTolerance: value }),
      setDeadline: (value) => set({ deadline: value }),
      setExpertMode: (value) => set({ expertMode: value }),
      
      addRecentToken: (token) => set((state) => {
        const filtered = state.recentTokens.filter(
          (t) => t.address !== token.address
        );
        return {
          recentTokens: [token, ...filtered].slice(0, 10),
        };
      }),
      
      reset: () => set(initialState),
    }),
    {
      name: 'basebook-swap',
      partialize: (state) => ({
        slippageTolerance: state.slippageTolerance,
        deadline: state.deadline,
        expertMode: state.expertMode,
        recentTokens: state.recentTokens,
      }),
    }
  )
);
```

## wagmi Configuration

### Config Setup
```typescript
// lib/wagmi/config.ts
import { createConfig, http } from 'wagmi';
import { base, arbitrum, optimism } from 'wagmi/chains';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID!;

export const config = createConfig({
  chains: [base, arbitrum, optimism],
  connectors: [
    injected(),
    coinbaseWallet({ appName: 'BaseBook DEX' }),
    walletConnect({ projectId }),
  ],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC),
    [arbitrum.id]: http(process.env.NEXT_PUBLIC_ARB_RPC),
    [optimism.id]: http(process.env.NEXT_PUBLIC_OP_RPC),
  },
});
```

### Providers
```tsx
// app/providers.tsx
'use client';

import { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { config } from '@/lib/wagmi/config';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 10, // 10 seconds
      gcTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#3B82F6',
            borderRadius: 'medium',
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

## Charts

### TradingView Chart
```tsx
// components/charts/TradingViewChart.tsx
'use client';

import { useEffect, useRef, memo } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData } from 'lightweight-charts';
import { usePoolOHLCV } from '@/hooks/pool/usePoolChart';

interface TradingViewChartProps {
  poolId: string;
  className?: string;
}

export const TradingViewChart = memo(function TradingViewChart({
  poolId,
  className,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  
  const { data: ohlcv } = usePoolOHLCV(poolId);
  
  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;
    
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: '#1F2937' },
        horzLines: { color: '#1F2937' },
      },
      crosshair: {
        mode: 0,
      },
      rightPriceScale: {
        borderColor: '#374151',
      },
      timeScale: {
        borderColor: '#374151',
        timeVisible: true,
      },
    });
    
    const series = chart.addCandlestickSeries({
      upColor: '#10B981',
      downColor: '#EF4444',
      borderUpColor: '#10B981',
      borderDownColor: '#EF4444',
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });
    
    chartRef.current = chart;
    seriesRef.current = series;
    
    // Handle resize
    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);
  
  // Update data
  useEffect(() => {
    if (!seriesRef.current || !ohlcv) return;
    
    const chartData: CandlestickData[] = ohlcv.map((d) => ({
      time: d.timestamp as number,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
    
    seriesRef.current.setData(chartData);
  }, [ohlcv]);
  
  return (
    <div ref={containerRef} className={cn('w-full h-[400px]', className)} />
  );
});
```

### Liquidity Distribution Chart
```tsx
// components/pool/LiquidityChart.tsx
'use client';

import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { usePoolTicks } from '@/hooks/pool/usePoolTicks';
import { tickToPrice } from '@/lib/utils/tick';

interface LiquidityChartProps {
  poolId: string;
  currentTick: number;
  token0Symbol: string;
  token1Symbol: string;
}

export function LiquidityChart({
  poolId,
  currentTick,
  token0Symbol,
  token1Symbol,
}: LiquidityChartProps) {
  const { data: ticks } = usePoolTicks(poolId);
  
  const chartData = useMemo(() => {
    if (!ticks) return [];
    
    return ticks.map((tick) => ({
      tick: tick.tickIdx,
      price: tickToPrice(tick.tickIdx),
      liquidity: Number(tick.liquidityGross) / 1e18,
      isActive: tick.tickIdx <= currentTick && tick.tickIdx + 60 > currentTick,
    }));
  }, [ticks, currentTick]);
  
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="liquidityGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="price"
          tickFormatter={(v) => v.toFixed(2)}
          stroke="#6B7280"
          fontSize={12}
        />
        <YAxis hide />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null;
            const data = payload[0].payload;
            return (
              <div className="bg-surface-secondary p-2 rounded border border-border">
                <p className="text-sm">Price: {data.price.toFixed(4)}</p>
                <p className="text-sm">Liquidity: {data.liquidity.toFixed(2)}</p>
              </div>
            );
          }}
        />
        <Area
          type="stepAfter"
          dataKey="liquidity"
          stroke="#3B82F6"
          fill="url(#liquidityGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

## Performance Optimization

### Code Splitting
```tsx
// Lazy load heavy components
import dynamic from 'next/dynamic';

const TradingViewChart = dynamic(
  () => import('@/components/charts/TradingViewChart'),
  { 
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);

const TokenSelectorModal = dynamic(
  () => import('@/components/swap/TokenSelectorModal'),
  { loading: () => null }
);
```

### Memoization
```tsx
// Memoize expensive calculations
const formattedAmount = useMemo(() => {
  return formatCurrency(amount, decimals);
}, [amount, decimals]);

// Memoize callbacks
const handleTokenSelect = useCallback((token: Token) => {
  setSelectedToken(token);
  onClose();
}, [onClose]);

// Memoize components
const TokenList = memo(function TokenList({ tokens, onSelect }: Props) {
  return (
    <div>
      {tokens.map((token) => (
        <TokenRow key={token.address} token={token} onClick={onSelect} />
      ))}
    </div>
  );
});
```

### Image Optimization
```tsx
// Use Next.js Image component
import Image from 'next/image';

export function TokenLogo({ src, alt, size = 32 }: TokenLogoProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="rounded-full"
      loading="lazy"
    />
  );
}
```

## Testing

### Component Test
```tsx
// tests/components/SwapWidget.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SwapWidget } from '@/components/swap/SwapWidget';
import { TestProviders } from '../utils/providers';

describe('SwapWidget', () => {
  it('renders swap form', () => {
    render(
      <TestProviders>
        <SwapWidget />
      </TestProviders>
    );
    
    expect(screen.getByText('Swap')).toBeInTheDocument();
    expect(screen.getByText('You pay')).toBeInTheDocument();
    expect(screen.getByText('You receive')).toBeInTheDocument();
  });
  
  it('shows connect wallet button when disconnected', () => {
    render(
      <TestProviders>
        <SwapWidget />
      </TestProviders>
    );
    
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
  });
  
  it('updates amount out when amount in changes', async () => {
    render(
      <TestProviders connected>
        <SwapWidget defaultTokenIn="ETH" defaultTokenOut="USDC" />
      </TestProviders>
    );
    
    const input = screen.getByLabelText('You pay');
    fireEvent.change(input, { target: { value: '1' } });
    
    await waitFor(() => {
      const output = screen.getByLabelText('You receive');
      expect(output).not.toHaveValue('');
    });
  });
});
```

### E2E Test (Playwright)
```typescript
// tests/e2e/swap.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Swap Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/swap');
  });
  
  test('should display swap widget', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Swap' })).toBeVisible();
  });
  
  test('should allow token selection', async ({ page }) => {
    // Click on token selector
    await page.getByTestId('token-in-selector').click();
    
    // Search for token
    await page.getByPlaceholder('Search token').fill('USDC');
    
    // Select token
    await page.getByText('USDC').click();
    
    // Verify selection
    await expect(page.getByTestId('token-in-symbol')).toHaveText('USDC');
  });
});
```

## Sprint Deliverables

### Phase 1 (Sprint 1-2): Foundation
- [ ] Next.js 14 project setup
- [ ] TailwindCSS + Radix UI setup
- [ ] wagmi + wallet connection
- [ ] Basic layout (header, footer)
- [ ] Token selector component

### Phase 2 (Sprint 3-4): Swap
- [ ] SwapWidget (fully functional)
- [ ] Token input/output
- [ ] Quote display
- [ ] Swap execution
- [ ] Transaction status

### Phase 3 (Sprint 5-6): Liquidity & Pools
- [ ] Pool list page
- [ ] Pool detail page
- [ ] Add liquidity flow
- [ ] Remove liquidity flow
- [ ] Position management

### Phase 4 (Sprint 7-8): Polish & Advanced
- [ ] Portfolio page
- [ ] Analytics page
- [ ] Charts (TradingView)
- [ ] Performance optimization
- [ ] Mobile polish

## Useful Commands
```bash
# Development
npm run dev

# Build
npm run build

# Type check
npm run typecheck

# Lint
npm run lint

# Test
npm run test
npm run test:e2e

# Storybook (optional)
npm run storybook
```

## Response Guidelines
1. Prioritize UX and accessibility
2. Use semantic HTML
3. Include loading and error states
4. Consider mobile-first approach
5. Reference Uniswap/SushiSwap UI patterns

---
*BaseBook DEX - Frontend Lead Configuration*
