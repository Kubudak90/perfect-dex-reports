'use client';

import { useCallback, ChangeEvent } from 'react';
import { Token } from '@/types/token';
import { TokenLogo } from '@/components/common/TokenLogo';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';
import { formatNumber, formatCurrency } from '@/lib/utils/format';
import { useTokenBalance } from '@/hooks/token/useTokenBalance';
import { useAccount } from 'wagmi';
import { ChevronDown, Loader2 } from 'lucide-react';
import { isNativeToken } from '@/lib/constants/tokens';

interface TokenInputProps {
  label: string;
  token: Token | null;
  amount: string;
  onTokenSelect: () => void;
  onAmountChange?: (amount: string) => void;
  showBalance?: boolean;
  showMaxButton?: boolean;
  readonly?: boolean;
  isLoading?: boolean;
  error?: boolean;
  priceUsd?: number;
  isPriceLoading?: boolean;
  className?: string;
}

export function TokenInput({
  label,
  token,
  amount,
  onTokenSelect,
  onAmountChange,
  showBalance = false,
  showMaxButton = false,
  readonly = false,
  isLoading = false,
  error = false,
  priceUsd,
  isPriceLoading = false,
  className,
}: TokenInputProps) {
  const { isConnected } = useAccount();

  // Get token balance
  const {
    balance,
    balanceFormatted,
    isLoading: isBalanceLoading,
  } = useTokenBalance(
    token && !isNativeToken(token) ? token.address : undefined,
    token?.decimals ?? 18
  );

  // Handle amount change
  const handleAmountChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (readonly) return;

      const value = e.target.value;

      // Allow empty string
      if (value === '') {
        onAmountChange?.('');
        return;
      }

      // Only allow numbers and single decimal point
      if (!/^\d*\.?\d*$/.test(value)) {
        return;
      }

      onAmountChange?.(value);
    },
    [onAmountChange, readonly]
  );

  // Handle max button click
  const handleMaxClick = useCallback(() => {
    if (!token || balance === 0n) return;

    // For native token, leave a bit for gas
    const maxAmount = isNativeToken(token)
      ? balance - BigInt(5e15) // Leave 0.005 ETH for gas
      : balance;

    if (maxAmount <= 0n) {
      onAmountChange?.('0');
      return;
    }

    const formatted = formatNumber(
      Number(maxAmount) / 10 ** token.decimals,
      token.decimals
    );

    onAmountChange?.(formatted);
  }, [token, balance, onAmountChange]);

  return (
    <div
      className={cn(
        'rounded-xl bg-surface-secondary p-4 transition-colors',
        'border border-transparent',
        error && 'border-destructive',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{label}</span>

        {/* Balance */}
        {showBalance && isConnected && token && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isBalanceLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <span>Balance: {balanceFormatted}</span>
                {showMaxButton && !readonly && balance > 0n && (
                  <button
                    onClick={handleMaxClick}
                    className="text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    MAX
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Input Row */}
      <div className="flex items-center gap-3">
        {/* Amount Input */}
        <div className="flex-1">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={handleAmountChange}
            disabled={readonly || isLoading}
            className={cn(
              'w-full bg-transparent text-3xl font-semibold outline-none',
              'placeholder:text-muted-foreground/50',
              'disabled:cursor-not-allowed'
            )}
          />
        </div>

        {/* Token Selector */}
        <Button
          onClick={onTokenSelect}
          variant="secondary"
          size="md"
          className={cn(
            'shrink-0 gap-2 min-w-[140px]',
            !token && 'bg-primary text-primary-foreground hover:bg-primary/90'
          )}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : token ? (
            <>
              <TokenLogo
                src={token.logoURI}
                alt={token.symbol}
                symbol={token.symbol}
                size={24}
              />
              <span className="font-semibold">{token.symbol}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </>
          ) : (
            <>
              <span className="font-semibold">Select token</span>
              <ChevronDown className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      {/* USD Value */}
      {token && amount && parseFloat(amount) > 0 && (
        <div className="mt-2 text-sm text-muted-foreground">
          {isPriceLoading ? (
            <span className="inline-block h-4 w-16 animate-pulse rounded bg-muted-foreground/20" />
          ) : priceUsd && priceUsd > 0 ? (
            <span>~{formatCurrency(parseFloat(amount) * priceUsd)}</span>
          ) : (
            <span>~$0.00</span>
          )}
        </div>
      )}
    </div>
  );
}
