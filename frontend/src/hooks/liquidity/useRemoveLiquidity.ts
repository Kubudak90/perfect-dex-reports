import { useState, useEffect, useCallback } from 'react';
import { Address } from 'viem';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { POSITION_MANAGER_ADDRESSES } from '@/lib/constants/addresses';
import { POSITION_MANAGER_ABI } from '@/lib/constants/abis';

export type RemoveLiquidityState = 'idle' | 'pending' | 'confirming' | 'success' | 'error';

interface UseRemoveLiquidityParams {
  onSuccess?: (txHash: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook to execute remove liquidity (decreaseLiquidity) and collect fees via PositionManager
 */
export function useRemoveLiquidity({ onSuccess, onError }: UseRemoveLiquidityParams = {}) {
  const { address, chainId } = useAccount();
  const [transactionState, setTransactionState] = useState<RemoveLiquidityState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // For decrease liquidity
  const {
    data: decreaseHash,
    writeContract: executeDecrease,
    error: decreaseError,
    isPending: isDecreasePending,
    reset: resetDecrease,
  } = useWriteContract();

  const {
    isLoading: isDecreaseConfirming,
    isSuccess: isDecreaseConfirmed,
    isError: isDecreaseFailed,
    error: decreaseTxError,
  } = useWaitForTransactionReceipt({
    hash: decreaseHash,
  });

  // For collect fees
  const {
    data: collectHash,
    writeContract: executeCollect,
    error: collectError,
    isPending: isCollectPending,
    reset: resetCollect,
  } = useWriteContract();

  const {
    isLoading: isCollectConfirming,
    isSuccess: isCollectConfirmed,
    isError: isCollectFailed,
    error: collectTxError,
  } = useWaitForTransactionReceipt({
    hash: collectHash,
  });

  // Update transaction state for decrease
  useEffect(() => {
    if (isDecreasePending) {
      setTransactionState('pending');
    } else if (isDecreaseConfirming) {
      setTransactionState('confirming');
    } else if (isDecreaseConfirmed) {
      setTransactionState('success');
    } else if (isDecreaseFailed || decreaseError) {
      setTransactionState('error');
    }
  }, [isDecreasePending, isDecreaseConfirming, isDecreaseConfirmed, isDecreaseFailed, decreaseError]);

  // Handle decrease confirmation
  useEffect(() => {
    if (isDecreaseConfirmed && decreaseHash) {
      onSuccess?.(decreaseHash);
    }
  }, [isDecreaseConfirmed, decreaseHash, onSuccess]);

  // Handle collect confirmation
  useEffect(() => {
    if (isCollectConfirmed && collectHash) {
      onSuccess?.(collectHash);
    }
  }, [isCollectConfirmed, collectHash, onSuccess]);

  // Handle errors
  useEffect(() => {
    const error = decreaseTxError || decreaseError || collectTxError || collectError;
    if (error) {
      const errorMsg = error instanceof Error ? error.message : 'Transaction failed';
      setErrorMessage(errorMsg);
      onError?.(error as Error);
    }
  }, [decreaseTxError, decreaseError, collectTxError, collectError, onError]);

  /**
   * Remove liquidity from a position (decrease liquidity + collect tokens)
   */
  const removeLiquidity = useCallback(async ({
    tokenId,
    liquidity,
    amount0Min = 0n,
    amount1Min = 0n,
    slippagePercent = 0.5,
    deadlineMinutes = 20,
    collectFees = true,
  }: {
    tokenId: bigint;
    liquidity: bigint;
    amount0Min?: bigint;
    amount1Min?: bigint;
    slippagePercent?: number;
    deadlineMinutes?: number;
    collectFees?: boolean;
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

    // Calculate deadline timestamp
    const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineMinutes * 60);

    try {
      await executeDecrease({
        address: positionManagerAddress,
        abi: POSITION_MANAGER_ABI,
        functionName: 'decreaseLiquidity',
        args: [
          {
            tokenId,
            liquidity: BigInt(liquidity) as unknown as bigint & { readonly __tag: 'uint128' },
            amount0Min,
            amount1Min,
            deadline,
          },
        ],
      });
    } catch (error) {
      setTransactionState('error');
      const errorMsg = error instanceof Error ? error.message : 'Remove liquidity failed';
      setErrorMessage(errorMsg);
      onError?.(error as Error);
      throw error;
    }
  }, [address, chainId, executeDecrease, onError]);

  /**
   * Collect unclaimed fees from a position
   */
  const collectFees = useCallback(async ({
    tokenId,
    amount0Max,
    amount1Max,
  }: {
    tokenId: bigint;
    amount0Max?: bigint;
    amount1Max?: bigint;
  }) => {
    if (!address || !chainId) {
      throw new Error('Wallet not connected');
    }

    const positionManagerAddress = POSITION_MANAGER_ADDRESSES[chainId];
    if (!positionManagerAddress || positionManagerAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error('PositionManager not deployed on this chain');
    }

    // Max uint128 to collect all fees
    const MAX_UINT128 = BigInt('0xffffffffffffffffffffffffffffffff');

    setTransactionState('pending');
    setErrorMessage(null);

    try {
      await executeCollect({
        address: positionManagerAddress,
        abi: POSITION_MANAGER_ABI,
        functionName: 'collect',
        args: [
          {
            tokenId,
            recipient: address,
            amount0Max: (amount0Max ?? MAX_UINT128) as unknown as bigint & { readonly __tag: 'uint128' },
            amount1Max: (amount1Max ?? MAX_UINT128) as unknown as bigint & { readonly __tag: 'uint128' },
          },
        ],
      });
    } catch (error) {
      setTransactionState('error');
      const errorMsg = error instanceof Error ? error.message : 'Collect fees failed';
      setErrorMessage(errorMsg);
      onError?.(error as Error);
      throw error;
    }
  }, [address, chainId, executeCollect, onError]);

  /**
   * Reset the state
   */
  const reset = useCallback(() => {
    setTransactionState('idle');
    setErrorMessage(null);
    resetDecrease();
    resetCollect();
  }, [resetDecrease, resetCollect]);

  return {
    removeLiquidity,
    collectFees,
    reset,
    transactionState,
    isRemoving: transactionState === 'pending' || transactionState === 'confirming',
    isCollecting: isCollectPending || isCollectConfirming,
    isPending: transactionState === 'pending',
    isConfirming: transactionState === 'confirming',
    isSuccess: transactionState === 'success',
    isError: transactionState === 'error',
    error: errorMessage,
    decreaseTxHash: decreaseHash,
    collectTxHash: collectHash,
  };
}
