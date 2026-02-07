'use client';

import { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { Position, Pool } from '@/types/pool';
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
import { Check, DollarSign } from 'lucide-react';

interface CollectFeesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: Position;
  pool: Pool;
  onSuccess?: () => void;
}

export function CollectFeesModal({
  open,
  onOpenChange,
  position,
  pool,
  onSuccess,
}: CollectFeesModalProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { toast } = useToast();
  const { addTransaction, updateTransaction } = useTransactionStore();

  const [txStep, setTxStep] = useState<'idle' | 'collecting' | 'success' | 'error'>('idle');

  const {
    collectFees,
    isCollecting,
    error: collectError,
    collectTxHash,
    reset: resetCollect,
  } = useRemoveLiquidity({
    onSuccess: (txHash) => {
      setTxStep('success');
      updateTransaction(txHash, { status: 'confirmed' });
      toast({
        variant: 'success',
        title: 'Fees collected successfully!',
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
        title: 'Collect fees failed',
        description: error.message,
      });
    },
  });

  // Calculate fees
  const fees0 = Number(position.unclaimedFees0) / 10 ** pool.token0Decimals;
  const fees1 = Number(position.unclaimedFees1) / 10 ** pool.token1Decimals;

  const token0Price = pool.token0Symbol === 'ETH' || pool.token0Symbol === 'WETH' ? 2450 : 1;
  const token1Price = pool.token1Symbol === 'ETH' || pool.token1Symbol === 'WETH' ? 2450 : 1;
  const totalFeesUsd = (fees0 * token0Price) + (fees1 * token1Price);

  const hasFees = fees0 > 0 || fees1 > 0;

  // Handle collect
  const handleCollect = async () => {
    if (!address) return;

    try {
      setTxStep('collecting');

      const tempHash = ('0x' + Math.random().toString(16).slice(2)) as `0x${string}`;
      addTransaction({
        hash: tempHash,
        type: 'collect',
        chainId,
        summary: `Collect fees from ${pool.token0Symbol}/${pool.token1Symbol} #${position.tokenId}`,
      });

      toast({
        variant: 'loading',
        title: 'Collecting fees',
        description: 'Confirm the transaction in your wallet',
      });

      await collectFees({
        tokenId: BigInt(position.tokenId),
      });
    } catch (error: any) {
      console.error('Collect fees error:', error);
      setTxStep('error');

      if (!error.message?.includes('User rejected')) {
        toast({
          variant: 'error',
          title: 'Failed to collect fees',
          description: error.message || 'An unexpected error occurred',
        });
      }
    }
  };

  // Handle close
  const handleClose = () => {
    if (!isCollecting) {
      setTxStep('idle');
      resetCollect();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm p-0 gap-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <DollarSign className="h-5 w-5 text-green-500" />
            </div>
            <span>Collect Fees</span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          {txStep === 'success' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
                <Check className="h-10 w-10 text-green-500 mx-auto mb-3" />
                <h3 className="font-semibold text-green-500 mb-1">Fees Collected!</h3>
                <p className="text-sm text-muted-foreground">
                  Your earned fees have been sent to your wallet.
                </p>
              </div>

              {collectTxHash && (
                <a
                  href={`${BLOCK_EXPLORERS[chainId]}/tx/${collectTxHash}`}
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
            <>
              {/* Position info */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-secondary">
                <TokenPairLogo
                  token0Logo={pool.token0LogoURI}
                  token1Logo={pool.token1LogoURI}
                  token0Symbol={pool.token0Symbol}
                  token1Symbol={pool.token1Symbol}
                  size={28}
                />
                <div>
                  <div className="font-medium text-sm">{pool.token0Symbol}/{pool.token1Symbol}</div>
                  <div className="text-xs text-muted-foreground">Position #{position.tokenId}</div>
                </div>
              </div>

              {/* Fee amounts */}
              <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
                <div className="text-sm text-muted-foreground">Unclaimed Fees</div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {pool.token0LogoURI && (
                        <img src={pool.token0LogoURI} alt={pool.token0Symbol} className="w-5 h-5 rounded-full" />
                      )}
                      <span>{pool.token0Symbol}</span>
                    </div>
                    <span className="font-semibold text-green-500">{formatNumber(fees0, 6)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {pool.token1LogoURI && (
                        <img src={pool.token1LogoURI} alt={pool.token1Symbol} className="w-5 h-5 rounded-full" />
                      )}
                      <span>{pool.token1Symbol}</span>
                    </div>
                    <span className="font-semibold text-green-500">{formatNumber(fees1, 2)}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Value</span>
                  <span className="font-bold text-lg text-green-500">{formatCurrency(totalFeesUsd)}</span>
                </div>
              </div>

              {!hasFees && (
                <div className="p-3 rounded-lg bg-surface-secondary text-center text-sm text-muted-foreground">
                  No fees to collect at this time.
                </div>
              )}

              {/* Error Message */}
              {collectError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{collectError}</p>
                </div>
              )}

              {/* Collect Button */}
              <Button
                onClick={handleCollect}
                disabled={isCollecting || !hasFees}
                loading={isCollecting}
                size="lg"
                className="w-full"
              >
                {isCollecting ? 'Collecting Fees...' : hasFees ? 'Collect Fees' : 'No Fees to Collect'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
