import { useState, useEffect, useCallback } from 'react';
import { Address } from 'viem';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { POSITION_MANAGER_ADDRESSES } from '@/lib/constants/addresses';
import { POSITION_MANAGER_ABI } from '@/lib/constants/abis';
import { TICK_SPACINGS } from '@/types/pool';
import { getTicksFromPriceRange } from '@/lib/utils/tick';
import { parseTokenAmount } from '@/lib/utils/format';

// Zero address for hooks (no hooks)
const NO_HOOKS = '0x0000000000000000000000000000000000000000' as Address;

export type AddLiquidityState = 'idle' | 'approving-token0' | 'approving-token1' | 'pending' | 'confirming' | 'success' | 'error';

interface UseAddLiquidityParams {
  onSuccess?: (txHash: string, tokenId?: bigint) => void;
  onError?: (error: Error) => void;
}

interface MintParams {
  token0: Address;
  token1: Address;
  fee: number;
  tickSpacing: number;
  hookAddress?: Address;
  tickLower: number;
  tickUpper: number;
  amount0Desired: bigint;
  amount1Desired: bigint;
  amount0Min: bigint;
  amount1Min: bigint;
  recipient: Address;
  deadline: bigint;
}

/**
 * Hook to execute add liquidity (mint) transactions via PositionManager
 */
export function useAddLiquidity({ onSuccess, onError }: UseAddLiquidityParams = {}) {
  const { address, chainId } = useAccount();
  const [transactionState, setTransactionState] = useState<AddLiquidityState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    data: mintHash,
    writeContract: executeMint,
    error: mintError,
    isPending: isWritePending,
    reset: resetWrite,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    isError: isFailed,
    error: txError,
  } = useWaitForTransactionReceipt({
    hash: mintHash,
  });

  // Update transaction state based on wagmi states
  useEffect(() => {
    if (isWritePending) {
      setTransactionState('pending');
    } else if (isConfirming) {
      setTransactionState('confirming');
    } else if (isConfirmed) {
      setTransactionState('success');
    } else if (isFailed || mintError) {
      setTransactionState('error');
    }
  }, [isWritePending, isConfirming, isConfirmed, isFailed, mintError]);

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed && mintHash) {
      onSuccess?.(mintHash);
    }
  }, [isConfirmed, mintHash, onSuccess]);

  // Handle transaction error
  useEffect(() => {
    const error = txError || mintError;
    if (error) {
      const errorMsg = error instanceof Error ? error.message : 'Transaction failed';
      setErrorMessage(errorMsg);
      onError?.(error as Error);
    }
  }, [isFailed, txError, mintError, onError]);

  /**
   * Execute mint (add liquidity) to create a new position
   */
  const addLiquidity = useCallback(async ({
    token0,
    token1,
    fee,
    tickLower,
    tickUpper,
    amount0Desired,
    amount1Desired,
    amount0Min,
    amount1Min,
    slippagePercent = 0.5,
    deadlineMinutes = 20,
    hookAddress,
  }: {
    token0: Address;
    token1: Address;
    fee: number;
    tickLower: number;
    tickUpper: number;
    amount0Desired: bigint;
    amount1Desired: bigint;
    amount0Min?: bigint;
    amount1Min?: bigint;
    slippagePercent?: number;
    deadlineMinutes?: number;
    hookAddress?: Address;
  }) => {
    if (!address || !chainId) {
      throw new Error('Wallet not connected');
    }

    const positionManagerAddress = POSITION_MANAGER_ADDRESSES[chainId];
    if (!positionManagerAddress || positionManagerAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error('PositionManager not deployed on this chain');
    }

    // Reset state
    setTransactionState('pending');
    setErrorMessage(null);

    // Ensure tokens are ordered (currency0 < currency1)
    let currency0 = token0;
    let currency1 = token1;
    let amt0 = amount0Desired;
    let amt1 = amount1Desired;
    let min0 = amount0Min;
    let min1 = amount1Min;

    if (token0.toLowerCase() > token1.toLowerCase()) {
      currency0 = token1;
      currency1 = token0;
      amt0 = amount1Desired;
      amt1 = amount0Desired;
      min0 = amount1Min;
      min1 = amount0Min;
    }

    // Calculate minimums with slippage if not provided
    const slippageMultiplier = BigInt(Math.floor((1 - slippagePercent / 100) * 10000));
    const finalMin0 = min0 ?? (amt0 * slippageMultiplier / 10000n);
    const finalMin1 = min1 ?? (amt1 * slippageMultiplier / 10000n);

    // Calculate deadline timestamp
    const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineMinutes * 60);

    const tickSpacing = TICK_SPACINGS[fee] || 60;

    try {
      await executeMint({
        address: positionManagerAddress,
        abi: POSITION_MANAGER_ABI,
        functionName: 'mint',
        args: [
          {
            poolKey: {
              currency0,
              currency1,
              fee,
              tickSpacing,
              hooks: hookAddress || NO_HOOKS,
            },
            tickLower,
            tickUpper,
            amount0Desired: amt0,
            amount1Desired: amt1,
            amount0Min: finalMin0,
            amount1Min: finalMin1,
            recipient: address,
            deadline,
          },
        ],
      });
    } catch (error) {
      setTransactionState('error');
      const errorMsg = error instanceof Error ? error.message : 'Add liquidity failed';
      setErrorMessage(errorMsg);
      onError?.(error as Error);
      throw error;
    }
  }, [address, chainId, executeMint, onError]);

  /**
   * Reset the state
   */
  const reset = useCallback(() => {
    setTransactionState('idle');
    setErrorMessage(null);
    resetWrite();
  }, [resetWrite]);

  return {
    addLiquidity,
    reset,
    transactionState,
    isAdding: transactionState === 'pending' || transactionState === 'confirming',
    isPending: transactionState === 'pending',
    isConfirming: transactionState === 'confirming',
    isSuccess: transactionState === 'success',
    isError: transactionState === 'error',
    error: errorMessage,
    txHash: mintHash,
  };
}
