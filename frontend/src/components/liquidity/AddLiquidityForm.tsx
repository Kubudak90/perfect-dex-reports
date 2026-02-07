'use client';

import { useState, useMemo, useCallback } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { Address, erc20Abi } from 'viem';
import { Token } from '@/types/token';
import { Pool, FEE_TIERS, TICK_SPACINGS } from '@/types/pool';
import { TokenInput } from '@/components/swap/TokenInput';
import { TokenSelector } from '@/components/swap/TokenSelector';
import { Button } from '@/components/ui/Button';
import { RangePresets } from './RangePresets';
import { PriceRangeInput } from './PriceRangeInput';
import { LiquidityPreview } from './LiquidityPreview';
import { cn } from '@/lib/utils/cn';
import { getSuggestedRanges, getTicksFromPriceRange, isInRange } from '@/lib/utils/tick';
import { parseTokenAmount } from '@/lib/utils/format';
import { apiClient } from '@/lib/api/client';
import { API_CONFIG } from '@/lib/config/api';
import { useAddLiquidity } from '@/hooks/liquidity/useAddLiquidity';
import { useTokenApproval } from '@/hooks/token/useTokenApproval';
import { useToast } from '@/hooks/common/useToast';
import { useTransactionStore } from '@/stores/useTransactionStore';
import { POSITION_MANAGER_ADDRESSES } from '@/lib/constants/addresses';
import { BLOCK_EXPLORERS } from '@/lib/constants/chains';
import { isNativeToken } from '@/lib/constants/tokens';
import { Settings, Loader2, Check, ArrowRight } from 'lucide-react';

interface AddLiquidityFormProps {
  className?: string;
}

/**
 * Fetch token price from API
 */
async function fetchTokenPrice(address: string, chainId: number): Promise<number> {
  try {
    const response = await apiClient.get<{ priceUsd: number }>(
      API_CONFIG.endpoints.tokenPrice(address),
      { chainId: chainId.toString() }
    );
    return response.priceUsd;
  } catch (error) {
    console.warn(`Failed to fetch price for ${address}:`, error);
    return 0;
  }
}

/**
 * Fetch pool data from API
 */
async function fetchPoolData(
  token0Address: string,
  token1Address: string,
  feeTier: number,
  chainId: number
): Promise<Pool | null> {
  try {
    const response = await apiClient.get<{ pools: Pool[] }>(API_CONFIG.endpoints.pools, {
      token0: token0Address,
      token1: token1Address,
      fee: feeTier.toString(),
      chainId: chainId.toString(),
    });
    return response.pools?.[0] || null;
  } catch (error) {
    console.warn('Failed to fetch pool data:', error);
    return null;
  }
}

/**
 * Calculate USD value from token amounts and prices
 */
function calculateTotalValueUsd(
  amount0: string,
  amount1: string,
  price0Usd: number,
  price1Usd: number
): number {
  const amt0 = parseFloat(amount0) || 0;
  const amt1 = parseFloat(amount1) || 0;

  return amt0 * price0Usd + amt1 * price1Usd;
}

/**
 * Calculate share of pool based on liquidity
 */
function calculatePoolShare(
  amount0: string,
  amount1: string,
  price0Usd: number,
  price1Usd: number,
  poolTvlUsd: number
): number {
  if (poolTvlUsd <= 0) {
    return 100;
  }

  const userValueUsd = calculateTotalValueUsd(amount0, amount1, price0Usd, price1Usd);
  if (userValueUsd <= 0) return 0;

  const sharePercent = (userValueUsd / (poolTvlUsd + userValueUsd)) * 100;
  return sharePercent;
}

/**
 * Estimate APR based on pool fees and volume
 */
function estimateApr(
  poolFees24hUsd: number,
  poolTvlUsd: number,
  currentPrice: number,
  priceLower: number,
  priceUpper: number
): number {
  if (poolTvlUsd <= 0 || poolFees24hUsd <= 0) return 0;

  const baseApr = (poolFees24hUsd * 365 / poolTvlUsd) * 100;

  if (priceLower <= 0 || priceUpper <= 0 || priceLower >= priceUpper) {
    return baseApr;
  }

  const sqrtPriceLower = Math.sqrt(priceLower);
  const sqrtPriceUpper = Math.sqrt(priceUpper);
  const sqrtCurrentPrice = Math.sqrt(currentPrice);

  const rangeWidth = (priceUpper - priceLower) / currentPrice;
  const fullRangeWidth = 9.9;

  let concentrationFactor = fullRangeWidth / rangeWidth;
  concentrationFactor = Math.min(concentrationFactor, 100);

  const isCurrentPriceInRange =
    sqrtCurrentPrice >= sqrtPriceLower && sqrtCurrentPrice <= sqrtPriceUpper;

  if (!isCurrentPriceInRange) {
    return 0;
  }

  return baseApr * concentrationFactor;
}

type TxStep = 'idle' | 'approve-token0' | 'approve-token1' | 'adding' | 'confirming' | 'success' | 'error';

export function AddLiquidityForm({ className }: AddLiquidityFormProps) {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { toast } = useToast();
  const { addTransaction, updateTransaction } = useTransactionStore();

  // Token selection
  const [token0, setToken0] = useState<Token | null>(null);
  const [token1, setToken1] = useState<Token | null>(null);
  const [selectingToken, setSelectingToken] = useState<'token0' | 'token1' | null>(null);

  // Fee tier
  const [selectedFeeTier, setSelectedFeeTier] = useState(3000); // 0.3% default

  // Amounts
  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');

  // Price range
  const [priceLower, setPriceLower] = useState('');
  const [priceUpper, setPriceUpper] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  // Transaction step tracking
  const [txStep, setTxStep] = useState<TxStep>('idle');

  // Get the PositionManager address for approvals
  const positionManagerAddress = chainId ? POSITION_MANAGER_ADDRESSES[chainId] : undefined;

  // Parse amounts for contract calls
  const amount0Raw = token0 && amount0 ? parseTokenAmount(amount0, token0.decimals) : 0n;
  const amount1Raw = token1 && amount1 ? parseTokenAmount(amount1, token1.decimals) : 0n;

  // Token0 approval -- uses exact amount (plus 5% buffer) instead of unlimited
  const {
    isApprovalNeeded: isToken0ApprovalNeeded,
    isApproving: isToken0Approving,
    approve: approveToken0Exact,
    approvalError: token0ApprovalError,
  } = useTokenApproval({
    token: token0 && !isNativeToken(token0) ? token0.address : undefined,
    amount: amount0Raw,
    spender: positionManagerAddress,
    enabled: !!token0 && !isNativeToken(token0) && amount0Raw > 0n,
  });

  // Token1 approval -- uses exact amount (plus 5% buffer) instead of unlimited
  const {
    isApprovalNeeded: isToken1ApprovalNeeded,
    isApproving: isToken1Approving,
    approve: approveToken1Exact,
    approvalError: token1ApprovalError,
  } = useTokenApproval({
    token: token1 && !isNativeToken(token1) ? token1.address : undefined,
    amount: amount1Raw,
    spender: positionManagerAddress,
    enabled: !!token1 && !isNativeToken(token1) && amount1Raw > 0n,
  });

  // Add liquidity hook
  const {
    addLiquidity: executeAddLiquidity,
    isAdding,
    isSuccess: isMintSuccess,
    isError: isMintError,
    error: mintError,
    txHash: mintTxHash,
    reset: resetMint,
  } = useAddLiquidity({
    onSuccess: (txHash) => {
      setTxStep('success');
      updateTransaction(txHash, { status: 'confirmed' });
      toast({
        variant: 'success',
        title: 'Liquidity added successfully!',
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
    },
    onError: (error) => {
      setTxStep('error');
      toast({
        variant: 'error',
        title: 'Add liquidity failed',
        description: error.message,
      });
    },
  });

  // Fetch token prices
  const { data: token0Price = 0 } = useQuery({
    queryKey: ['tokenPrice', token0?.address, chainId],
    queryFn: () => fetchTokenPrice(token0!.address, chainId),
    enabled: !!token0?.address,
    staleTime: 30000,
  });

  const { data: token1Price = 0 } = useQuery({
    queryKey: ['tokenPrice', token1?.address, chainId],
    queryFn: () => fetchTokenPrice(token1!.address, chainId),
    enabled: !!token1?.address,
    staleTime: 30000,
  });

  // Fetch pool data
  const { data: poolData } = useQuery({
    queryKey: ['poolData', token0?.address, token1?.address, selectedFeeTier, chainId],
    queryFn: () => fetchPoolData(token0!.address, token1!.address, selectedFeeTier, chainId),
    enabled: !!token0?.address && !!token1?.address,
    staleTime: 30000,
  });

  // Calculate current price from pool data or token prices
  const currentPrice = useMemo(() => {
    if (poolData?.token0Price) {
      return poolData.token0Price;
    }
    if (token0Price > 0 && token1Price > 0) {
      return token0Price / token1Price;
    }
    return 2450; // ETH/USDC example default
  }, [poolData, token0Price, token1Price]);

  // Get suggested ranges
  const tickSpacing = TICK_SPACINGS[selectedFeeTier];
  const suggestedRanges = useMemo(
    () => getSuggestedRanges(currentPrice, tickSpacing),
    [currentPrice, tickSpacing]
  );

  // Handle preset selection
  const handlePresetSelect = useCallback((preset: any) => {
    setPriceLower(preset.priceLower.toString());
    setPriceUpper(preset.priceUpper.toString());
    setSelectedPreset(preset.label);
  }, []);

  // Validation
  const priceLowerNum = parseFloat(priceLower);
  const priceUpperNum = parseFloat(priceUpper);
  const invalidRange =
    priceLower &&
    priceUpper &&
    !isNaN(priceLowerNum) &&
    !isNaN(priceUpperNum) &&
    priceLowerNum >= priceUpperNum;

  // Check if in range
  const inRange = useMemo(() => {
    if (!priceLower || !priceUpper) return true;
    const { tickLower, tickUpper } = getTicksFromPriceRange(
      priceLowerNum,
      priceUpperNum,
      tickSpacing
    );
    return isInRange(Math.log(currentPrice) / Math.log(1.0001), tickLower, tickUpper);
  }, [priceLower, priceUpper, currentPrice, tickSpacing, priceLowerNum, priceUpperNum]);

  // Calculate USD value
  const totalValueUsd = useMemo(() => {
    return calculateTotalValueUsd(amount0, amount1, token0Price, token1Price);
  }, [amount0, amount1, token0Price, token1Price]);

  // Calculate pool share
  const shareOfPool = useMemo(() => {
    const poolTvl = poolData?.tvlUsd || 0;
    return calculatePoolShare(amount0, amount1, token0Price, token1Price, poolTvl);
  }, [amount0, amount1, token0Price, token1Price, poolData]);

  // Estimate APR
  const estimatedApr = useMemo(() => {
    if (!poolData || !priceLower || !priceUpper) return 0;
    return estimateApr(
      poolData.fees24hUsd || 0,
      poolData.tvlUsd || 0,
      currentPrice,
      priceLowerNum,
      priceUpperNum
    );
  }, [poolData, currentPrice, priceLowerNum, priceUpperNum, priceLower, priceUpper]);

  // Can add liquidity
  const canAdd = token0 && token1 && amount0 && amount1 && priceLower && priceUpper && !invalidRange;

  // Determine needs approval
  const needsToken0Approval = isToken0ApprovalNeeded && token0 && !isNativeToken(token0);
  const needsToken1Approval = isToken1ApprovalNeeded && token1 && !isNativeToken(token1);

  /**
   * Handle the full add liquidity flow: approve tokens then mint
   */
  const handleAddLiquidity = async () => {
    if (!token0 || !token1 || !address) return;

    try {
      // Step 1: Approve token0 if needed (exact amount + 5% buffer)
      if (needsToken0Approval) {
        setTxStep('approve-token0');
        toast({
          variant: 'loading',
          title: 'Approval pending',
          description: `Approve ${token0.symbol} for PositionManager`,
        });
        await approveToken0Exact(amount0Raw);
        toast({
          variant: 'success',
          title: 'Approval successful',
          description: `${token0.symbol} approved`,
        });
      }

      // Step 2: Approve token1 if needed (exact amount + 5% buffer)
      if (needsToken1Approval) {
        setTxStep('approve-token1');
        toast({
          variant: 'loading',
          title: 'Approval pending',
          description: `Approve ${token1.symbol} for PositionManager`,
        });
        await approveToken1Exact(amount1Raw);
        toast({
          variant: 'success',
          title: 'Approval successful',
          description: `${token1.symbol} approved`,
        });
      }

      // Step 3: Calculate ticks from price range
      const { tickLower, tickUpper } = getTicksFromPriceRange(
        priceLowerNum,
        priceUpperNum,
        tickSpacing
      );

      // Step 4: Execute mint
      setTxStep('adding');

      // Add pending transaction to store
      const tempHash = ('0x' + Math.random().toString(16).slice(2)) as `0x${string}`;
      addTransaction({
        hash: tempHash,
        type: 'addLiquidity',
        chainId,
        summary: `Add liquidity: ${amount0} ${token0.symbol} + ${amount1} ${token1.symbol}`,
      });

      toast({
        variant: 'loading',
        title: 'Adding liquidity',
        description: 'Confirm the transaction in your wallet',
      });

      await executeAddLiquidity({
        token0: token0.address,
        token1: token1.address,
        fee: selectedFeeTier,
        tickLower,
        tickUpper,
        amount0Desired: amount0Raw,
        amount1Desired: amount1Raw,
      });

    } catch (error: any) {
      console.error('Add liquidity error:', error);
      setTxStep('error');

      if (error.message?.includes('not yet deployed') || error.message?.includes('not deployed')) {
        toast({
          variant: 'error',
          title: 'Not available yet',
          description: 'Smart contracts are not yet deployed on this network.',
        });
      } else if (!error.message?.includes('User rejected')) {
        toast({
          variant: 'error',
          title: 'Failed to add liquidity',
          description: error.message || 'An unexpected error occurred',
        });
      }
    }
  };

  /**
   * Reset the form after success
   */
  const handleReset = () => {
    setAmount0('');
    setAmount1('');
    setPriceLower('');
    setPriceUpper('');
    setSelectedPreset(null);
    setTxStep('idle');
    resetMint();
  };

  // Get button text and state
  const getButtonConfig = () => {
    if (!isConnected) {
      return { text: 'Connect Wallet', disabled: true, loading: false };
    }
    if (!token0 || !token1) {
      return { text: 'Select Tokens', disabled: true, loading: false };
    }
    if (!amount0 || !amount1) {
      return { text: 'Enter Amounts', disabled: true, loading: false };
    }
    if (!priceLower || !priceUpper) {
      return { text: 'Set Price Range', disabled: true, loading: false };
    }
    if (invalidRange) {
      return { text: 'Invalid Range', disabled: true, loading: false };
    }

    // Transaction in progress
    if (txStep === 'approve-token0' || isToken0Approving) {
      return { text: `Approving ${token0.symbol}...`, disabled: true, loading: true };
    }
    if (txStep === 'approve-token1' || isToken1Approving) {
      return { text: `Approving ${token1.symbol}...`, disabled: true, loading: true };
    }
    if (txStep === 'adding' || isAdding) {
      return { text: 'Adding Liquidity...', disabled: true, loading: true };
    }
    if (txStep === 'success') {
      return { text: 'Success! Add Another', disabled: false, loading: false };
    }

    // Determine what the button should say
    if (needsToken0Approval && needsToken1Approval) {
      return { text: `Approve ${token0.symbol} & ${token1.symbol}, then Add`, disabled: false, loading: false };
    }
    if (needsToken0Approval) {
      return { text: `Approve ${token0.symbol} & Add Liquidity`, disabled: false, loading: false };
    }
    if (needsToken1Approval) {
      return { text: `Approve ${token1.symbol} & Add Liquidity`, disabled: false, loading: false };
    }

    return { text: 'Add Liquidity', disabled: false, loading: false };
  };

  const buttonConfig = getButtonConfig();

  // Transaction progress indicator
  const renderTxProgress = () => {
    if (txStep === 'idle' || txStep === 'error') return null;

    const steps = [];
    if (needsToken0Approval || txStep === 'approve-token0') {
      steps.push({ label: `Approve ${token0?.symbol}`, done: txStep !== 'approve-token0', active: txStep === 'approve-token0' });
    }
    if (needsToken1Approval || txStep === 'approve-token1') {
      steps.push({ label: `Approve ${token1?.symbol}`, done: txStep !== 'approve-token0' && txStep !== 'approve-token1', active: txStep === 'approve-token1' });
    }
    steps.push({ label: 'Add Liquidity', done: txStep === 'success', active: txStep === 'adding' || txStep === 'confirming' });

    if (steps.length <= 1) return null;

    return (
      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <h4 className="text-sm font-medium">Transaction Progress</h4>
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={cn(
                'h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium border-2',
                step.done
                  ? 'bg-green-500 border-green-500 text-white'
                  : step.active
                    ? 'border-primary text-primary animate-pulse'
                    : 'border-border text-muted-foreground'
              )}>
                {step.done ? (
                  <Check className="h-3 w-3" />
                ) : step.active ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  i + 1
                )}
              </div>
              <span className={cn(
                'text-sm',
                step.done ? 'text-green-500' : step.active ? 'text-foreground font-medium' : 'text-muted-foreground'
              )}>
                {step.label}
              </span>
              {i < steps.length - 1 && (
                <ArrowRight className="h-3 w-3 text-muted-foreground ml-auto" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Token Selection */}
      <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
        <h3 className="font-semibold">Select Pair</h3>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant={token0 ? 'secondary' : 'default'}
            onClick={() => setSelectingToken('token0')}
            className="h-auto py-3"
          >
            {token0 ? (
              <div className="flex items-center gap-2">
                <img
                  src={token0.logoURI}
                  alt={token0.symbol}
                  className="w-6 h-6 rounded-full"
                />
                <span>{token0.symbol}</span>
              </div>
            ) : (
              'Select Token'
            )}
          </Button>

          <Button
            variant={token1 ? 'secondary' : 'default'}
            onClick={() => setSelectingToken('token1')}
            className="h-auto py-3"
          >
            {token1 ? (
              <div className="flex items-center gap-2">
                <img
                  src={token1.logoURI}
                  alt={token1.symbol}
                  className="w-6 h-6 rounded-full"
                />
                <span>{token1.symbol}</span>
              </div>
            ) : (
              'Select Token'
            )}
          </Button>
        </div>

        {/* Fee Tier Selection */}
        {token0 && token1 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Fee Tier</h4>
            <div className="grid grid-cols-2 gap-2">
              {FEE_TIERS.map((tier) => (
                <button
                  key={tier.fee}
                  onClick={() => setSelectedFeeTier(tier.fee)}
                  className={cn(
                    'p-3 rounded-lg border-2 text-left transition-all',
                    selectedFeeTier === tier.fee
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <div className="font-semibold text-sm mb-0.5">{tier.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {tier.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Amount Inputs */}
      {token0 && token1 && (
        <>
          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <h3 className="font-semibold">Deposit Amounts</h3>

            <TokenInput
              label="Amount"
              token={token0}
              amount={amount0}
              onTokenSelect={() => {}}
              onAmountChange={setAmount0}
              showBalance
              showMaxButton
              priceUsd={token0Price}
            />

            <TokenInput
              label="Amount"
              token={token1}
              amount={amount1}
              onTokenSelect={() => {}}
              onAmountChange={setAmount1}
              showBalance
              showMaxButton
              priceUsd={token1Price}
            />

            {/* Show USD value of deposits */}
            {totalValueUsd > 0 && (
              <div className="text-sm text-muted-foreground text-right">
                Total: ~${totalValueUsd.toFixed(2)}
              </div>
            )}
          </div>

          {/* Price Range */}
          <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Set Price Range</h3>
              <button className="p-2 rounded-lg hover:bg-surface-secondary transition-colors">
                <Settings className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Presets */}
            <RangePresets
              presets={suggestedRanges}
              selectedPreset={selectedPreset}
              currentPrice={currentPrice}
              onSelectPreset={handlePresetSelect}
            />

            {/* Custom Range */}
            <div className="grid grid-cols-2 gap-3">
              <PriceRangeInput
                label="Min Price"
                value={priceLower}
                onChange={(val) => {
                  setPriceLower(val);
                  setSelectedPreset(null);
                }}
                currentPrice={currentPrice}
                symbol={`${token1.symbol} per ${token0.symbol}`}
                error={!!invalidRange}
                helperText="Your position will be 100% token1 at this price"
              />

              <PriceRangeInput
                label="Max Price"
                value={priceUpper}
                onChange={(val) => {
                  setPriceUpper(val);
                  setSelectedPreset(null);
                }}
                currentPrice={currentPrice}
                symbol={`${token1.symbol} per ${token0.symbol}`}
                error={!!invalidRange}
                helperText="Your position will be 100% token0 at this price"
              />
            </div>
          </div>

          {/* Preview */}
          {amount0 && amount1 && priceLower && priceUpper && !invalidRange && (
            <LiquidityPreview
              token0={token0}
              token1={token1}
              amount0={amount0}
              amount1={amount1}
              totalValueUsd={totalValueUsd}
              shareOfPool={shareOfPool}
              estimatedApr={estimatedApr}
              priceLower={priceLowerNum}
              priceUpper={priceUpperNum}
              currentPrice={currentPrice}
              inRange={inRange}
            />
          )}

          {/* Transaction Progress */}
          {renderTxProgress()}

          {/* Error Message */}
          {(mintError || token0ApprovalError || token1ApprovalError) && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">
                {mintError || token0ApprovalError?.message || token1ApprovalError?.message || 'An error occurred'}
              </p>
            </div>
          )}

          {/* Success Message */}
          {txStep === 'success' && mintTxHash && (
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Check className="h-5 w-5 text-green-500" />
                <span className="font-semibold text-green-500">Liquidity Added Successfully!</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Your new position has been created. You can view and manage it from the Positions page.
              </p>
              <div className="flex gap-2">
                <a
                  href={`${BLOCK_EXPLORERS[chainId]}/tx/${mintTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  View on Explorer
                </a>
                <span className="text-muted-foreground">|</span>
                <a
                  href="/positions"
                  className="text-sm text-primary hover:underline"
                >
                  View Positions
                </a>
              </div>
            </div>
          )}

          {/* Add Liquidity Button */}
          <Button
            onClick={txStep === 'success' ? handleReset : handleAddLiquidity}
            disabled={txStep === 'success' ? false : (!canAdd || !isConnected || buttonConfig.disabled)}
            loading={buttonConfig.loading}
            size="lg"
            className="w-full"
          >
            {buttonConfig.text}
          </Button>
        </>
      )}

      {/* Token Selector Modals */}
      <TokenSelector
        open={selectingToken === 'token0'}
        onOpenChange={(open) => !open && setSelectingToken(null)}
        onSelectToken={(token) => {
          setToken0(token);
          setSelectingToken(null);
        }}
        selectedToken={token0}
        otherToken={token1}
      />

      <TokenSelector
        open={selectingToken === 'token1'}
        onOpenChange={(open) => !open && setSelectingToken(null)}
        onSelectToken={(token) => {
          setToken1(token);
          setSelectingToken(null);
        }}
        selectedToken={token1}
        otherToken={token0}
      />
    </div>
  );
}
