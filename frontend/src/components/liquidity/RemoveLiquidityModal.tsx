'use client';

import { useState, useMemo, useCallback } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { Position } from '@/types/pool';
import { Pool } from '@/types/pool';
import { Token } from '@/types/token';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { TokenPairLogo } from '@/components/common/TokenLogo';
import { useRemoveLiquidity } from '@/hooks/liquidity/useRemoveLiquidity';
import { useToast } from '@/hooks/common/useToast';
import { useTransactionStore } from '@/stores/useTransactionStore';
import { BLOCK_EXPLORERS } from '@/lib/constants/chains';
import { formatNumber, formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { AlertTriangle, Check, Loader2, ArrowDown, Percent } from 'lucide-react';

interface RemoveLiquidityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: Position;
  pool: Pool;
  onSuccess?: () => void;
}

const PERCENTAGE_PRESETS = [25, 50, 75, 100] as const;

export function RemoveLiquidityModal({
  open,
  onOpenChange,
  position,
  pool,
  onSuccess,
}: RemoveLiquidityModalProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { toast } = useToast();
  const { addTransaction, updateTransaction } = useTransactionStore();

  const [percentage, setPercentage] = useState(100);
  const [customPercentage, setCustomPercentage] = useState('');
  const [txStep, setTxStep] = useState<'idle' | 'removing' | 'confirming' | 'success' | 'error'>('idle');

  // Remove liquidity hook
  const {
    removeLiquidity,
    isRemoving,
    isSuccess,
    error: removeError,
    decreaseTxHash,
    reset: resetRemove,
  } = useRemoveLiquidity({
    onSuccess: (txHash) => {
      setTxStep('success');
      updateTransaction(txHash, { status: 'confirmed' });
      toast({
        variant: 'success',
        title: 'Liquidity removed successfully!',
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
      onSuccess?.();
    },
    onError: (error) => {
      setTxStep('error');
      toast({
        variant: 'error',
        title: 'Remove liquidity failed',
        description: error.message,
      });
    },
  });

  // Calculate amounts to receive based on percentage
  const liquidityToRemove = useMemo(() => {
    return (BigInt(position.liquidity) * BigInt(percentage)) / 100n;
  }, [position.liquidity, percentage]);

  const amount0ToReceive = useMemo(() => {
    const raw = (BigInt(position.amount0) * BigInt(percentage)) / 100n;
    return Number(raw) / 10 ** pool.token0Decimals;
  }, [position.amount0, percentage, pool.token0Decimals]);

  const amount1ToReceive = useMemo(() => {
    const raw = (BigInt(position.amount1) * BigInt(percentage)) / 100n;
    return Number(raw) / 10 ** pool.token1Decimals;
  }, [position.amount1, percentage, pool.token1Decimals]);

  // Calculate fees to collect
  const fees0 = useMemo(() => {
    return Number(position.unclaimedFees0) / 10 ** pool.token0Decimals;
  }, [position.unclaimedFees0, pool.token0Decimals]);

  const fees1 = useMemo(() => {
    return Number(position.unclaimedFees1) / 10 ** pool.token1Decimals;
  }, [position.unclaimedFees1, pool.token1Decimals]);

  // Calculate total USD value to receive
  const totalUsdToReceive = useMemo(() => {
    const token0Price = pool.token0Symbol === 'ETH' || pool.token0Symbol === 'WETH' ? 2450 : 1;
    const token1Price = pool.token1Symbol === 'ETH' || pool.token1Symbol === 'WETH' ? 2450 : 1;
    return (amount0ToReceive * token0Price) + (amount1ToReceive * token1Price) + (fees0 * token0Price) + (fees1 * token1Price);
  }, [amount0ToReceive, amount1ToReceive, fees0, fees1, pool]);

  // Handle percentage change
  const handlePercentageChange = (value: number) => {
    setPercentage(value);
    setCustomPercentage('');
  };

  const handleCustomPercentageChange = (value: string) => {
    setCustomPercentage(value);
    const num = parseInt(value);
    if (!isNaN(num) && num >= 1 && num <= 100) {
      setPercentage(num);
    }
  };

  // Handle remove liquidity
  const handleRemove = async () => {
    if (!address) return;

    try {
      setTxStep('removing');

      // Add pending transaction
      const tempHash = ('0x' + Math.random().toString(16).slice(2)) as `0x${string}`;
      addTransaction({
        hash: tempHash,
        type: 'removeLiquidity',
        chainId,
        summary: `Remove ${percentage}% liquidity from ${pool.token0Symbol}/${pool.token1Symbol}`,
      });

      toast({
        variant: 'loading',
        title: 'Removing liquidity',
        description: 'Confirm the transaction in your wallet',
      });

      await removeLiquidity({
        tokenId: BigInt(position.tokenId),
        liquidity: liquidityToRemove,
      });
    } catch (error: any) {
      console.error('Remove liquidity error:', error);
      setTxStep('error');

      if (error.message?.includes('not deployed')) {
        toast({
          variant: 'error',
          title: 'Not available yet',
          description: 'Smart contracts are not yet deployed on this network.',
        });
      } else if (!error.message?.includes('User rejected')) {
        toast({
          variant: 'error',
          title: 'Failed to remove liquidity',
          description: error.message || 'An unexpected error occurred',
        });
      }
    }
  };

  // Handle close
  const handleClose = () => {
    if (!isRemoving) {
      setPercentage(100);
      setCustomPercentage('');
      setTxStep('idle');
      resetRemove();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-0 gap-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-3">
            <TokenPairLogo
              token0Logo={pool.token0LogoURI}
              token1Logo={pool.token1LogoURI}
              token0Symbol={pool.token0Symbol}
              token1Symbol={pool.token1Symbol}
              size={32}
            />
            <span>Remove Liquidity</span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          {txStep === 'success' ? (
            /* Success State */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
                <Check className="h-10 w-10 text-green-500 mx-auto mb-3" />
                <h3 className="font-semibold text-green-500 mb-1">Liquidity Removed!</h3>
                <p className="text-sm text-muted-foreground">
                  {percentage}% of your liquidity has been removed.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
                <div className="text-sm text-muted-foreground mb-2">You received</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">{pool.token0Symbol}</span>
                  <span className="font-medium">{formatNumber(amount0ToReceive, 6)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">{pool.token1Symbol}</span>
                  <span className="font-medium">{formatNumber(amount1ToReceive, 2)}</span>
                </div>
                {(fees0 > 0 || fees1 > 0) && (
                  <>
                    <div className="border-t border-border my-2" />
                    <div className="text-sm text-muted-foreground mb-1">Fees collected</div>
                    <div className="flex items-center justify-between text-green-500">
                      <span className="text-sm">{pool.token0Symbol}</span>
                      <span className="font-medium">{formatNumber(fees0, 6)}</span>
                    </div>
                    <div className="flex items-center justify-between text-green-500">
                      <span className="text-sm">{pool.token1Symbol}</span>
                      <span className="font-medium">{formatNumber(fees1, 2)}</span>
                    </div>
                  </>
                )}
              </div>

              {decreaseTxHash && (
                <a
                  href={`${BLOCK_EXPLORERS[chainId]}/tx/${decreaseTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-sm text-primary hover:underline"
                >
                  View on Explorer
                </a>
              )}

              <Button onClick={handleClose} variant="secondary" size="lg" className="w-full">
                Close
              </Button>
            </div>
          ) : (
            /* Remove Form */
            <>
              {/* Percentage Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Remove Amount</h4>
                  <span className="text-2xl font-bold">{percentage}%</span>
                </div>

                {/* Slider */}
                <div className="relative">
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={percentage}
                    onChange={(e) => handlePercentageChange(parseInt(e.target.value))}
                    className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  {/* Track fill */}
                  <div
                    className="absolute top-0 left-0 h-2 bg-primary rounded-lg pointer-events-none"
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                {/* Preset buttons */}
                <div className="grid grid-cols-4 gap-2">
                  {PERCENTAGE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handlePercentageChange(preset)}
                      className={cn(
                        'py-2 rounded-lg text-sm font-medium transition-all',
                        percentage === preset
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-surface-secondary hover:bg-surface-tertiary text-muted-foreground'
                      )}
                    >
                      {preset}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Arrow divider */}
              <div className="flex justify-center">
                <div className="p-2 rounded-full bg-surface-secondary">
                  <ArrowDown className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              {/* Preview - tokens to receive */}
              <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
                <div className="text-sm text-muted-foreground">You will receive</div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {pool.token0LogoURI && (
                        <img src={pool.token0LogoURI} alt={pool.token0Symbol} className="w-5 h-5 rounded-full" />
                      )}
                      <span className="font-medium">{pool.token0Symbol}</span>
                    </div>
                    <span className="font-semibold">{formatNumber(amount0ToReceive, 6)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {pool.token1LogoURI && (
                        <img src={pool.token1LogoURI} alt={pool.token1Symbol} className="w-5 h-5 rounded-full" />
                      )}
                      <span className="font-medium">{pool.token1Symbol}</span>
                    </div>
                    <span className="font-semibold">{formatNumber(amount1ToReceive, 2)}</span>
                  </div>
                </div>

                {/* Fees */}
                {(fees0 > 0 || fees1 > 0) && (
                  <div className="pt-2 border-t border-border">
                    <div className="text-sm text-muted-foreground mb-2">+ Unclaimed Fees</div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm text-green-500">
                        <span>{pool.token0Symbol}</span>
                        <span>+{formatNumber(fees0, 6)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-green-500">
                        <span>{pool.token1Symbol}</span>
                        <span>+{formatNumber(fees1, 2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Total USD */}
                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estimated Value</span>
                  <span className="font-bold text-lg">{formatCurrency(totalUsdToReceive)}</span>
                </div>
              </div>

              {/* Position info */}
              <div className="rounded-xl border border-border bg-surface-secondary p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Position</span>
                  <span className="font-medium">#{position.tokenId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Fee Tier</span>
                  <span className="font-medium">{pool.feeTier / 10000}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className={cn(
                    'font-medium',
                    position.inRange ? 'text-green-500' : 'text-orange-500'
                  )}>
                    {position.inRange ? 'In Range' : 'Out of Range'}
                  </span>
                </div>
              </div>

              {/* Warning for 100% removal */}
              {percentage === 100 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-orange-500">
                    Removing 100% will close this position entirely. You can create a new one anytime.
                  </p>
                </div>
              )}

              {/* Error Message */}
              {removeError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{removeError}</p>
                </div>
              )}

              {/* Remove Button */}
              <Button
                onClick={handleRemove}
                disabled={isRemoving || percentage === 0}
                loading={isRemoving}
                size="lg"
                variant={percentage === 100 ? 'destructive' : 'default'}
                className="w-full"
              >
                {isRemoving
                  ? 'Removing Liquidity...'
                  : percentage === 100
                    ? 'Remove All Liquidity'
                    : `Remove ${percentage}% Liquidity`}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
