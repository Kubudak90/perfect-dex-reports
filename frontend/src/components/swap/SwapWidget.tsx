'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, RefreshCw } from 'lucide-react';
import { Token } from '@/types/token';
import { TokenInput } from './TokenInput';
import { TokenSelector } from './TokenSelector';
import { SwapSettings } from './SwapSettings';
import { SwapDetails } from './SwapDetails';
import { SwapButton } from './SwapButton';
import { useSwapStore } from '@/stores/useSwapStore';
import { useSwapQuote } from '@/hooks/swap/useSwapQuote';
import { useTokenBalance } from '@/hooks/token/useTokenBalance';
import { useTokenApproval } from '@/hooks/token/useTokenApproval';
import { useSwapCallback } from '@/hooks/swap/useSwapCallback';
import { useDebounce } from '@/hooks/common/useDebounce';
import { useTransactionStore } from '@/stores/useTransactionStore';
import { useToast } from '@/hooks/common/useToast';
import { cn } from '@/lib/utils/cn';
import { isNativeToken } from '@/lib/constants/tokens';
import { formatTokenAmount, parseTokenAmount } from '@/lib/utils/format';
import { getPriceImpactSeverity } from '@/lib/api/swap';
import { BLOCK_EXPLORERS } from '@/lib/constants/chains';
import { apiClient } from '@/lib/api/client';
import { API_CONFIG } from '@/lib/config/api';

/**
 * Fetch token price from API
 */
async function fetchTokenPrice(address: string, chainId: number): Promise<number> {
  try {
    const response = await apiClient.get<{ priceUsd: number }>(
      API_CONFIG.endpoints.tokenPrice(address),
      { chainId: chainId.toString() }
    );
    return response.priceUsd;
  } catch (error) {
    console.warn(`Failed to fetch price for ${address}:`, error);
    return 0;
  }
}

interface SwapWidgetProps {
  className?: string;
}

export function SwapWidget({ className }: SwapWidgetProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { toast } = useToast();
  const { addTransaction, updateTransaction } = useTransactionStore();

  const {
    tokenIn,
    tokenOut,
    amountIn,
    slippageTolerance,
    deadline,
    setTokenIn,
    setTokenOut,
    setAmountIn,
    switchTokens,
  } = useSwapStore();

  const [selectingToken, setSelectingToken] = useState<'in' | 'out' | null>(null);

  // Debounce amount for quote fetching
  const debouncedAmountIn = useDebounce(amountIn, 500);

  // Get token balance
  const { balance: balanceIn } = useTokenBalance(
    tokenIn && !isNativeToken(tokenIn) ? tokenIn.address : undefined,
    tokenIn?.decimals ?? 18
  );

  // Fetch token prices for USD display
  const { data: tokenInPrice = 0, isLoading: isTokenInPriceLoading } = useQuery({
    queryKey: ['tokenPrice', tokenIn?.address, chainId],
    queryFn: () => fetchTokenPrice(tokenIn!.address, chainId),
    enabled: !!tokenIn?.address,
    staleTime: 30000,
  });

  const { data: tokenOutPrice = 0, isLoading: isTokenOutPriceLoading } = useQuery({
    queryKey: ['tokenPrice', tokenOut?.address, chainId],
    queryFn: () => fetchTokenPrice(tokenOut!.address, chainId),
    enabled: !!tokenOut?.address,
    staleTime: 30000,
  });

  // Fetch quote
  const {
    quote,
    isLoading: isQuoteLoading,
    isFetching: isQuoteFetching,
    error: quoteError,
    refetch,
  } = useSwapQuote({
    tokenIn: tokenIn?.address,
    tokenOut: tokenOut?.address,
    amountIn: debouncedAmountIn,
    decimalsIn: tokenIn?.decimals,
    slippage: slippageTolerance,
  });

  // Parse amount for approval check
  const amountInRaw = tokenIn && amountIn
    ? parseTokenAmount(amountIn, tokenIn.decimals)
    : 0n;

  // Token approval (skip for native tokens)
  // Uses exact approval (with 5% buffer) instead of unlimited to limit risk
  const {
    isApprovalNeeded,
    isApproving,
    approve: approveExact,
    approvalError,
  } = useTokenApproval({
    token: tokenIn && !isNativeToken(tokenIn) ? tokenIn.address : undefined,
    amount: amountInRaw,
    enabled: !!tokenIn && !isNativeToken(tokenIn) && amountInRaw > 0n,
  });

  // Swap execution
  const {
    swap: executeSwap,
    isSwapping,
    swapError,
  } = useSwapCallback({
    quote,
    slippage: slippageTolerance,
    deadline,
    onSuccess: (txHash) => {
      // Update transaction status
      updateTransaction(txHash, { status: 'confirmed' });

      // Show success toast
      toast({
        variant: 'success',
        title: 'Swap successful!',
        description: (
          <a
            href={`${BLOCK_EXPLORERS[chainId]}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            View on explorer
          </a>
        ),
      });

      // Reset form
      setAmountIn('');
    },
    onError: (error) => {
      toast({
        variant: 'error',
        title: 'Swap failed',
        description: error.message,
      });
    },
  });

  // Calculate output amount
  const amountOut = quote
    ? formatTokenAmount(BigInt(quote.amountOut), tokenOut?.decimals ?? 18, 6)
    : '';

  // Handle switch tokens
  const handleSwitchTokens = useCallback(() => {
    switchTokens();
  }, [switchTokens]);

  // Handle approval -- approves only the exact swap amount (plus 5% buffer)
  const handleApprove = async () => {
    if (!tokenIn) return;

    try {
      toast({
        variant: 'loading',
        title: 'Approval pending',
        description: `Approve ${tokenIn.symbol} for trading`,
      });

      await approveExact(amountInRaw);

      toast({
        variant: 'success',
        title: 'Approval successful',
        description: `${tokenIn.symbol} approved for trading`,
      });
    } catch (error: any) {
      console.error('Approval error:', error);
      toast({
        variant: 'error',
        title: 'Approval failed',
        description: error.message || 'Failed to approve token',
      });
    }
  };

  // Handle swap
  const handleSwap = async () => {
    if (!tokenIn || !tokenOut || !quote || !address) return;

    // If approval needed, approve first
    if (isApprovalNeeded) {
      await handleApprove();
      return;
    }

    try {
      // Add pending transaction
      const txHash = '0x' + Math.random().toString(16).slice(2); // Temporary hash
      addTransaction({
        hash: txHash as any,
        type: 'swap',
        chainId,
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        amountIn,
        amountOut,
        summary: `Swap ${amountIn} ${tokenIn.symbol} for ${amountOut} ${tokenOut.symbol}`,
      });

      toast({
        variant: 'loading',
        title: 'Swap pending',
        description: 'Confirm the transaction in your wallet',
      });

      await executeSwap();
    } catch (error: any) {
      console.error('Swap error:', error);

      // Show user-friendly error
      if (error.message.includes('not yet implemented')) {
        toast({
          variant: 'error',
          title: 'Swap not available',
          description: 'Smart contracts are not yet deployed. Coming in Sprint 5-6!',
        });
      }
    }
  };

  // Validation
  const amountInParsed = parseFloat(amountIn);
  const hasAmount = amountIn && amountInParsed > 0;
  const insufficientBalance =
    hasAmount && tokenIn && balanceIn < BigInt(amountInParsed * 10 ** tokenIn.decimals);
  const insufficientLiquidity = quoteError?.message?.includes('insufficient liquidity');
  const priceImpactTooHigh = quote && getPriceImpactSeverity(quote.priceImpact) === 'severe';

  // Button state
  const getButtonState = useCallback(() => {
    if (!isConnected) {
      return { text: 'Connect Wallet', disabled: false, warning: false };
    }

    if (!tokenIn || !tokenOut) {
      return { text: 'Select tokens', disabled: true, warning: false };
    }

    if (!hasAmount) {
      return { text: 'Enter amount', disabled: true, warning: false };
    }

    if (insufficientBalance) {
      return { text: 'Insufficient balance', disabled: true, warning: false };
    }

    if (isQuoteLoading) {
      return { text: 'Getting quote...', disabled: true, warning: false };
    }

    if (insufficientLiquidity) {
      return { text: 'Insufficient liquidity', disabled: true, warning: false };
    }

    if (!quote) {
      return { text: 'No quote available', disabled: true, warning: false };
    }

    if (isApprovalNeeded) {
      return {
        text: `Approve ${tokenIn.symbol}`,
        disabled: false,
        warning: false,
      };
    }

    if (isApproving) {
      return { text: 'Approving...', disabled: true, warning: false };
    }

    if (isSwapping) {
      return { text: 'Swapping...', disabled: true, warning: false };
    }

    if (priceImpactTooHigh) {
      return { text: 'Swap anyway', disabled: false, warning: true };
    }

    return { text: 'Swap', disabled: false, warning: false };
  }, [
    isConnected,
    tokenIn,
    tokenOut,
    hasAmount,
    insufficientBalance,
    isQuoteLoading,
    insufficientLiquidity,
    quote,
    isApprovalNeeded,
    isApproving,
    isSwapping,
    priceImpactTooHigh,
  ]);

  const buttonState = getButtonState();

  return (
    <div
      className={cn(
        'w-full max-w-[480px] rounded-2xl bg-surface p-4',
        'border border-border shadow-lg',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Swap</h2>
        <div className="flex items-center gap-2">
          {/* Refresh Quote */}
          {quote && (
            <button
              onClick={() => refetch()}
              disabled={isQuoteFetching}
              className="p-2 rounded-lg hover:bg-surface-secondary transition-colors disabled:opacity-50"
              aria-label="Refresh quote"
            >
              <RefreshCw
                className={cn(
                  'h-4 w-4 text-muted-foreground',
                  isQuoteFetching && 'animate-spin'
                )}
              />
            </button>
          )}

          {/* Settings */}
          <SwapSettings />
        </div>
      </div>

      {/* Token Inputs */}
      <div className="space-y-2">
        {/* Token In */}
        <TokenInput
          label="You pay"
          token={tokenIn}
          amount={amountIn}
          onTokenSelect={() => setSelectingToken('in')}
          onAmountChange={setAmountIn}
          showBalance
          showMaxButton
          error={!!insufficientBalance}
          priceUsd={tokenInPrice}
          isPriceLoading={isTokenInPriceLoading}
        />

        {/* Switch Button */}
        <div className="flex justify-center -my-2 relative z-10">
          <button
            onClick={handleSwitchTokens}
            className="p-2 rounded-full bg-surface-secondary hover:bg-surface-tertiary border-4 border-surface transition-colors"
            aria-label="Switch tokens"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>

        {/* Token Out */}
        <TokenInput
          label="You receive"
          token={tokenOut}
          amount={amountOut}
          onTokenSelect={() => setSelectingToken('out')}
          readonly
          isLoading={isQuoteLoading || isQuoteFetching}
          showBalance
          priceUsd={tokenOutPrice}
          isPriceLoading={isTokenOutPriceLoading}
        />
      </div>

      {/* Swap Details */}
      {quote && tokenIn && tokenOut && (
        <SwapDetails
          quote={quote}
          tokenIn={tokenIn}
          tokenOut={tokenOut}
          className="mt-4"
        />
      )}

      {/* Error Message */}
      {(quoteError && !insufficientLiquidity) || approvalError || swapError ? (
        <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive">
            {quoteError?.message || approvalError?.message || swapError || 'An error occurred'}
          </p>
        </div>
      ) : null}

      {/* Swap Button */}
      <SwapButton
        onClick={handleSwap}
        disabled={buttonState.disabled}
        loading={isApproving || isSwapping}
        text={buttonState.text}
        warning={buttonState.warning}
        className="mt-4"
      />

      {/* Token Selector Modals */}
      <TokenSelector
        open={selectingToken === 'in'}
        onOpenChange={(open) => !open && setSelectingToken(null)}
        onSelectToken={(token) => {
          setTokenIn(token);
          setSelectingToken(null);
        }}
        selectedToken={tokenIn}
        otherToken={tokenOut}
      />

      <TokenSelector
        open={selectingToken === 'out'}
        onOpenChange={(open) => !open && setSelectingToken(null)}
        onSelectToken={(token) => {
          setTokenOut(token);
          setSelectingToken(null);
        }}
        selectedToken={tokenOut}
        otherToken={tokenIn}
      />
    </div>
  );
}
