'use client';

import { useState, useCallback } from 'react';
import { Token } from '@/types/token';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { TokenLogo } from '@/components/common/TokenLogo';
import { useTokenSearch } from '@/hooks/token/useTokenSearch';
import { useTokenBalance } from '@/hooks/token/useTokenBalance';
import { cn } from '@/lib/utils/cn';
import { Search, Star } from 'lucide-react';
import { POPULAR_TOKENS, isNativeToken } from '@/lib/constants/tokens';
import { useAccount } from 'wagmi';

interface TokenSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectToken: (token: Token) => void;
  selectedToken?: Token | null;
  otherToken?: Token | null; // To filter out already selected token
}

export function TokenSelector({
  open,
  onOpenChange,
  onSelectToken,
  selectedToken,
  otherToken,
}: TokenSelectorProps) {
  const { isConnected } = useAccount();
  const { searchQuery, setSearchQuery, filteredTokens } = useTokenSearch();

  const handleSelectToken = useCallback(
    (token: Token) => {
      onSelectToken(token);
      onOpenChange(false);
      setSearchQuery(''); // Reset search
    },
    [onSelectToken, onOpenChange, setSearchQuery]
  );

  // Filter out other token
  const availableTokens = filteredTokens.filter(
    (token) => token.address !== otherToken?.address
  );

  // Popular tokens
  const popularTokens = availableTokens.filter((token) =>
    POPULAR_TOKENS.includes(token.symbol as any)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0">
        {/* Header */}
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>Select a token</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="px-6 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search name, symbol or address"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>
        </div>

        {/* Popular Tokens */}
        {!searchQuery && popularTokens.length > 0 && (
          <div className="px-6 pb-4">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Popular tokens
            </div>
            <div className="flex flex-wrap gap-2">
              {popularTokens.map((token) => (
                <button
                  key={token.address}
                  onClick={() => handleSelectToken(token)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg',
                    'border border-border bg-surface-secondary',
                    'hover:bg-surface-tertiary transition-colors',
                    selectedToken?.address === token.address &&
                      'border-primary bg-primary/10'
                  )}
                >
                  <TokenLogo
                    src={token.logoURI}
                    alt={token.symbol}
                    symbol={token.symbol}
                    size={20}
                  />
                  <span className="font-medium text-sm">{token.symbol}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Token List */}
        <div className="max-h-[400px] overflow-y-auto">
          {availableTokens.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No tokens found
            </div>
          ) : (
            <div className="pb-2">
              {availableTokens.map((token) => (
                <TokenRow
                  key={token.address}
                  token={token}
                  onClick={() => handleSelectToken(token)}
                  selected={selectedToken?.address === token.address}
                  showBalance={isConnected}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Token row component
 */
interface TokenRowProps {
  token: Token;
  onClick: () => void;
  selected: boolean;
  showBalance: boolean;
}

function TokenRow({ token, onClick, selected, showBalance }: TokenRowProps) {
  const { balance, balanceFormatted, isLoading } = useTokenBalance(
    !isNativeToken(token) ? token.address : undefined,
    token.decimals
  );

  const hasBalance = balance > 0n;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-6 py-3',
        'hover:bg-surface-secondary transition-colors',
        selected && 'bg-surface-secondary'
      )}
    >
      {/* Logo */}
      <TokenLogo
        src={token.logoURI}
        alt={token.symbol}
        symbol={token.symbol}
        size={36}
      />

      {/* Token Info */}
      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{token.symbol}</span>
          {token.isVerified && (
            <div className="h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-primary text-[10px]">✓</span>
            </div>
          )}
        </div>
        <div className="text-sm text-muted-foreground">{token.name}</div>
      </div>

      {/* Balance */}
      {showBalance && (
        <div className="text-right">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">...</div>
          ) : hasBalance ? (
            <div className="font-medium">{balanceFormatted}</div>
          ) : (
            <div className="text-sm text-muted-foreground">0</div>
          )}
        </div>
      )}
    </button>
  );
}
