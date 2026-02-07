import { useAccount, useBalance } from 'wagmi';
import { Address } from 'viem';
import { formatTokenAmount } from '@/lib/utils/format';

/**
 * Hook to get token balance
 * @param tokenAddress - Token address (undefined for native token)
 * @param decimals - Token decimals
 * @returns Balance data
 */
export function useTokenBalance(tokenAddress?: Address, decimals: number = 18) {
  const { address: userAddress } = useAccount();

  const { data, isLoading, error, refetch } = useBalance({
    address: userAddress,
    token: tokenAddress, // undefined = native token (ETH)
    query: {
      enabled: !!userAddress,
    },
  });

  return {
    balance: data?.value ?? 0n,
    balanceFormatted: data?.value
      ? formatTokenAmount(data.value, decimals)
      : '0',
    symbol: data?.symbol ?? '',
    decimals: data?.decimals ?? decimals,
    isLoading,
    error,
    refetch,
  };
}
