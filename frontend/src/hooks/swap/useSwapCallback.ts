import { useState, useEffect, useCallback } from 'react';
import { Address, encodePacked } from 'viem';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { SwapQuote } from '@/types/swap';
import { SWAP_ROUTER_ADDRESSES } from '@/lib/constants/addresses';
import { SWAP_ROUTER_ABI } from '@/lib/constants/abis';
import { TICK_SPACINGS } from '@/types/pool';

// No price limit (use max/min sqrtPriceX96 values)
const MIN_SQRT_PRICE_X96 = 4295128739n;
const MAX_SQRT_PRICE_X96 = 1461446703485210103287273052203988822378723970342n;

// Zero address for hooks (no hooks)
const NO_HOOKS = '0x0000000000000000000000000000000000000000' as Address;

interface UseSwapCallbackParams {
  quote?: SwapQuote | null;
  slippage?: number;
  deadline?: number; // in minutes
  onSuccess?: (txHash: string) => void;
  onError?: (error: Error) => void;
}

export type SwapTransactionState = 'idle' | 'pending' | 'confirming' | 'success' | 'error';

/**
 * Hook to execute swap transactions
 */
export function useSwapCallback({
  quote,
  slippage = 0.5,
  deadline = 20,
  onSuccess,
  onError,
}: UseSwapCallbackParams) {
  const { address, chainId } = useAccount();
  const [transactionState, setTransactionState] = useState<SwapTransactionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    data: swapHash,
    writeContract: executeSwap,
    error: swapError,
    isPending: isWritePending,
    reset: resetWrite,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    isError: isFailed,
    error: txError,
  } = useWaitForTransactionReceipt({
    hash: swapHash,
  });

  // Update transaction state based on wagmi states
  useEffect(() => {
    if (isWritePending) {
      setTransactionState('pending');
    } else if (isConfirming) {
      setTransactionState('confirming');
    } else if (isConfirmed) {
      setTransactionState('success');
    } else if (isFailed || swapError) {
      setTransactionState('error');
    }
  }, [isWritePending, isConfirming, isConfirmed, isFailed, swapError]);

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed && swapHash) {
      onSuccess?.(swapHash);
    }
  }, [isConfirmed, swapHash, onSuccess]);

  // Handle transaction error
  useEffect(() => {
    const error = txError || swapError;
    if (error) {
      const errorMsg = error instanceof Error ? error.message : 'Transaction failed';
      setErrorMessage(errorMsg);
      onError?.(error as Error);
    }
  }, [isFailed, txError, swapError, onError]);

  /**
   * Build swap parameters for single-hop swap
   */
  const buildSingleSwapParams = useCallback(() => {
    if (!address || !chainId || !quote) {
      throw new Error('Missing required parameters for swap');
    }

    const pool = quote.route.paths[0]?.pools[0];
    if (!pool) {
      throw new Error('Invalid route: no pool found');
    }

    // Determine token order (currency0 < currency1 by address)
    const tokenInLower = quote.tokenIn.toLowerCase();
    const tokenOutLower = quote.tokenOut.toLowerCase();
    const zeroForOne = tokenInLower < tokenOutLower;

    // Build pool key with proper token ordering
    const currency0 = zeroForOne ? quote.tokenIn : quote.tokenOut;
    const currency1 = zeroForOne ? quote.tokenOut : quote.tokenIn;
    const tickSpacing = TICK_SPACINGS[pool.fee] || 60;

    // Calculate deadline timestamp
    const deadlineTimestamp = BigInt(Math.floor(Date.now() / 1000) + deadline * 60);

    // Use appropriate price limit based on swap direction
    const sqrtPriceLimitX96 = zeroForOne ? MIN_SQRT_PRICE_X96 : MAX_SQRT_PRICE_X96;

    return {
      poolKey: {
        currency0,
        currency1,
        fee: pool.fee,
        tickSpacing,
        hooks: NO_HOOKS,
      },
      zeroForOne,
      amountIn: BigInt(quote.amountIn),
      amountOutMinimum: BigInt(quote.amountOutMin),
      sqrtPriceLimitX96,
      recipient: address,
      deadline: deadlineTimestamp,
    };
  }, [address, chainId, quote, deadline]);

  /**
   * Build path for multi-hop swap
   */
  const buildMultiHopPath = useCallback((): `0x${string}` => {
    if (!quote) {
      throw new Error('Missing quote for multi-hop swap');
    }

    const pools = quote.route.paths[0]?.pools;
    if (!pools || pools.length === 0) {
      throw new Error('Invalid route: no pools found');
    }

    // Path encoding: token0, fee0, token1, fee1, token2, ...
    // For each hop, encode: tokenIn (20 bytes) + fee (3 bytes)
    // Final token (20 bytes) at the end

    let pathComponents: (`0x${string}` | number)[] = [];

    for (let i = 0; i < pools.length; i++) {
      const pool = pools[i];
      pathComponents.push(pool.tokenIn as `0x${string}`);
      pathComponents.push(pool.fee);
    }
    // Add final token out
    pathComponents.push(pools[pools.length - 1].tokenOut as `0x${string}`);

    // Build types array for encodePacked
    const types: ('address' | 'uint24')[] = [];
    for (let i = 0; i < pools.length; i++) {
      types.push('address');
      types.push('uint24');
    }
    types.push('address');

    return encodePacked(types, pathComponents as any);
  }, [quote]);

  /**
   * Execute the swap
   */
  const swap = useCallback(async () => {
    if (!address || !chainId || !quote) {
      throw new Error('Missing required parameters for swap');
    }

    const swapRouterAddress = SWAP_ROUTER_ADDRESSES[chainId];
    if (!swapRouterAddress || swapRouterAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error('Swap router not deployed on this chain');
    }

    // Reset state
    setTransactionState('pending');
    setErrorMessage(null);

    try {
      const isMultiHop = quote.route.hops > 1;

      if (isMultiHop) {
        // Multi-hop swap using exactInput
        const path = buildMultiHopPath();
        const deadlineTimestamp = BigInt(Math.floor(Date.now() / 1000) + deadline * 60);

        await executeSwap({
          address: swapRouterAddress,
          abi: SWAP_ROUTER_ABI,
          functionName: 'exactInput',
          args: [
            {
              path,
              amountIn: BigInt(quote.amountIn),
              amountOutMinimum: BigInt(quote.amountOutMin),
              recipient: address,
              deadline: deadlineTimestamp,
            },
          ],
        });
      } else {
        // Single-hop swap using exactInputSingle
        const params = buildSingleSwapParams();

        await executeSwap({
          address: swapRouterAddress,
          abi: SWAP_ROUTER_ABI,
          functionName: 'exactInputSingle',
          args: [params],
        });
      }
    } catch (error) {
      setTransactionState('error');
      const errorMsg = error instanceof Error ? error.message : 'Swap execution failed';
      setErrorMessage(errorMsg);
      onError?.(error as Error);
      throw error;
    }
  }, [
    address,
    chainId,
    quote,
    deadline,
    buildSingleSwapParams,
    buildMultiHopPath,
    executeSwap,
    onError,
  ]);

  /**
   * Reset the swap state
   */
  const reset = useCallback(() => {
    setTransactionState('idle');
    setErrorMessage(null);
    resetWrite();
  }, [resetWrite]);

  return {
    swap,
    reset,
    transactionState,
    isSwapping: transactionState === 'pending' || transactionState === 'confirming',
    isPending: transactionState === 'pending',
    isConfirming: transactionState === 'confirming',
    isSuccess: transactionState === 'success',
    isError: transactionState === 'error',
    swapError: errorMessage,
    swapHash,
  };
}
