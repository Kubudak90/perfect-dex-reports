import { useQuery } from '@tanstack/react-query';
import { Address } from 'viem';
import { useChainId } from 'wagmi';
import { SwapQuote } from '@/types/swap';
import { getSwapQuote } from '@/lib/api/swap';
import { parseTokenAmount } from '@/lib/utils/format';

interface UseSwapQuoteParams {
  tokenIn?: Address;
  tokenOut?: Address;
  amountIn?: string; // Formatted amount (e.g., "1.5")
  decimalsIn?: number;
  slippage?: number;
  enabled?: boolean;
}

/**
 * Hook to fetch swap quote
 */
export function useSwapQuote({
  tokenIn,
  tokenOut,
  amountIn,
  decimalsIn = 18,
  slippage = 0.5,
  enabled = true,
}: UseSwapQuoteParams) {
  const chainId = useChainId();

  const {
    data: quote,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<SwapQuote, Error>({
    queryKey: [
      'swapQuote',
      chainId,
      tokenIn,
      tokenOut,
      amountIn,
      slippage,
    ],
    queryFn: async () => {
      if (!tokenIn || !tokenOut || !amountIn) {
        throw new Error('Missing required parameters');
      }

      // Parse amount to raw (wei)
      const amountInRaw = parseTokenAmount(amountIn, decimalsIn);

      if (amountInRaw === 0n) {
        throw new Error('Amount must be greater than 0');
      }

      return getSwapQuote({
        tokenIn,
        tokenOut,
        amountIn: amountInRaw.toString(),
        slippage,
        chainId,
      });
    },
    enabled:
      enabled &&
      !!tokenIn &&
      !!tokenOut &&
      !!amountIn &&
      parseFloat(amountIn) > 0,
    staleTime: 10000, // 10 seconds
    gcTime: 30000, // 30 seconds
    refetchInterval: 15000, // Refetch every 15 seconds
    retry: 2,
  });

  return {
    quote,
    isLoading,
    isFetching,
    error,
    refetch,
  };
}
