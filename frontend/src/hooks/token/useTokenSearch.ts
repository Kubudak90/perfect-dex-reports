import { useMemo, useState } from 'react';
import { Token } from '@/types/token';
import { getDefaultTokens } from '@/lib/constants/tokens';
import { useChainId } from 'wagmi';

/**
 * Hook to search tokens
 * @param tokens - List of tokens to search from
 * @returns Search state and functions
 */
export function useTokenSearch(tokens?: Token[]) {
  const chainId = useChainId();
  const [searchQuery, setSearchQuery] = useState('');

  // Use provided tokens or default tokens for current chain
  const tokenList = tokens ?? getDefaultTokens(chainId);

  // Filter tokens based on search query
  const filteredTokens = useMemo(() => {
    if (!searchQuery.trim()) {
      return tokenList;
    }

    const query = searchQuery.toLowerCase();

    return tokenList.filter((token) => {
      return (
        token.symbol.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query) ||
        token.address.toLowerCase().includes(query)
      );
    });
  }, [tokenList, searchQuery]);

  return {
    searchQuery,
    setSearchQuery,
    filteredTokens,
    allTokens: tokenList,
  };
}
