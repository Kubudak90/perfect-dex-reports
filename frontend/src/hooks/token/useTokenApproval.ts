import { useState, useEffect, useCallback } from 'react';
import { Address, erc20Abi } from 'viem';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { SWAP_ROUTER_ADDRESSES } from '@/lib/constants/addresses';

const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

/** Default buffer percentage added to exact approval amounts (5%) */
const APPROVAL_BUFFER_BPS = 500n; // 5% in basis points (500 / 10000)
const BPS_DENOMINATOR = 10000n;

/**
 * Adds a percentage buffer to an amount to account for price fluctuations.
 * For example, with a 5% buffer, 100 tokens becomes 105 tokens.
 * The result is capped at MAX_UINT256 to prevent overflow.
 */
function addApprovalBuffer(amount: bigint, bufferBps: bigint = APPROVAL_BUFFER_BPS): bigint {
  const buffered = amount + (amount * bufferBps) / BPS_DENOMINATOR;
  return buffered > MAX_UINT256 ? MAX_UINT256 : buffered;
}

interface UseTokenApprovalParams {
  token?: Address;
  amount?: bigint;
  spender?: Address;
  enabled?: boolean;
}

export type ApprovalState = 'approved' | 'not-approved' | 'pending' | 'unknown';

/**
 * Hook to manage token approval.
 *
 * Security: By default, approves only the exact amount needed (plus a small
 * buffer for price changes) rather than unlimited (MAX_UINT256). This limits
 * exposure if the spender contract is ever compromised.
 *
 * - `approve(amount)` -- approves the given amount plus a 5% buffer (default: the `amount` param)
 * - `approveUnlimited()` -- opt-in unlimited approval (MAX_UINT256)
 */
export function useTokenApproval({
  token,
  amount = 0n,
  spender,
  enabled = true,
}: UseTokenApprovalParams) {
  const { address, chainId } = useAccount();
  const [approvalState, setApprovalState] = useState<ApprovalState>('unknown');

  // Get spender address (default to swap router)
  const spenderAddress = spender || (chainId ? SWAP_ROUTER_ADDRESSES[chainId] : undefined);

  // Read current allowance
  const {
    data: allowance,
    isLoading: isLoadingAllowance,
    refetch: refetchAllowance,
  } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && spenderAddress ? [address, spenderAddress] : undefined,
    query: {
      enabled: enabled && !!token && !!address && !!spenderAddress,
    },
  });

  // Write approval
  const {
    data: approvalHash,
    writeContract: approveToken,
    isPending: isApproving,
    error: approvalError,
  } = useWriteContract();

  // Wait for approval transaction
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: approvalHash,
    });

  // Update approval state based on allowance
  useEffect(() => {
    if (!enabled || !token || !amount || amount === 0n) {
      setApprovalState('unknown');
      return;
    }

    if (isLoadingAllowance) {
      setApprovalState('unknown');
      return;
    }

    if (isApproving || isConfirming) {
      setApprovalState('pending');
      return;
    }

    if (allowance !== undefined) {
      if (allowance >= amount) {
        setApprovalState('approved');
      } else {
        setApprovalState('not-approved');
      }
    }
  }, [enabled, token, amount, allowance, isLoadingAllowance, isApproving, isConfirming]);

  // Refetch allowance after confirmation
  useEffect(() => {
    if (isConfirmed) {
      refetchAllowance();
    }
  }, [isConfirmed, refetchAllowance]);

  /**
   * Approve an exact amount of tokens (plus a 5% buffer for price fluctuations).
   * If no `approvalAmount` is provided, falls back to the hook's `amount` param.
   * This is the recommended default -- it limits the spender's allowance to only
   * what is needed for the current transaction.
   */
  const approve = useCallback(async (approvalAmount?: bigint) => {
    if (!token || !spenderAddress) {
      throw new Error('Token or spender address not set');
    }

    const baseAmount = approvalAmount ?? amount;
    if (baseAmount === 0n) {
      throw new Error('Approval amount must be greater than zero');
    }

    const bufferedAmount = addApprovalBuffer(baseAmount);

    try {
      await approveToken({
        address: token,
        abi: erc20Abi,
        functionName: 'approve',
        args: [spenderAddress, bufferedAmount],
      });
    } catch (error) {
      console.error('Approval error:', error);
      throw error;
    }
  }, [token, spenderAddress, amount, approveToken]);

  /**
   * Opt-in unlimited approval (MAX_UINT256).
   * WARNING: If the spender contract is compromised, ALL approved tokens
   * can be drained. Only use this when the user explicitly opts in.
   */
  const approveUnlimited = useCallback(async () => {
    if (!token || !spenderAddress) {
      throw new Error('Token or spender address not set');
    }

    try {
      await approveToken({
        address: token,
        abi: erc20Abi,
        functionName: 'approve',
        args: [spenderAddress, MAX_UINT256],
      });
    } catch (error) {
      console.error('Unlimited approval error:', error);
      throw error;
    }
  }, [token, spenderAddress, approveToken]);

  return {
    approvalState,
    currentAllowance: allowance ?? 0n,
    isApprovalNeeded: approvalState === 'not-approved',
    isApproving: isApproving || isConfirming,
    approve,
    approveUnlimited,
    approvalError,
    refetchAllowance,
  };
}
