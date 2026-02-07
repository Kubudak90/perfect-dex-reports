import { Address } from 'viem';
import { SwapQuote } from '@/types/swap';
import { apiClient, ApiClientError, SWAP_QUOTE_TIMEOUT_MS } from './client';
import { API_CONFIG } from '../config/api';

/**
 * Swap API Response from backend
 */
interface SwapQuoteResponse {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string;
  amountOut: string;
  amountOutMin: string;
  executionPrice: number;
  priceImpact: number;
  route: {
    paths: Array<{
      pools: Array<{
        poolId: string;
        tokenIn: Address;
        tokenOut: Address;
        fee: number;
      }>;
      percentage: number;
    }>;
    hops: number;
    splits: number;
  };
  gasEstimate: string;
  gasEstimateUsd: number;
  timestamp: number;
  validUntil: number;
}

/**
 * Build transaction response from backend
 */
interface BuildSwapTxResponse {
  to: Address;
  data: `0x${string}`;
  value: string;
  gasLimit: string;
}

/**
 * Get swap quote from backend
 * Calls the Rust router engine via backend API
 */
export async function getSwapQuote(params: {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string;
  slippage?: number;
  chainId?: number;
}): Promise<SwapQuote> {
  const { tokenIn, tokenOut, amountIn, slippage = 0.5, chainId = 8453 } = params;

  try {
    // Call backend API for quote (uses extended timeout for routing computation)
    const response = await apiClient.post<SwapQuoteResponse>(
      API_CONFIG.endpoints.quote,
      {
        tokenIn,
        tokenOut,
        amountIn,
        slippage,
        chainId,
      },
      { timeoutMs: SWAP_QUOTE_TIMEOUT_MS }
    );

    // Transform response to SwapQuote
    return {
      tokenIn: response.tokenIn,
      tokenOut: response.tokenOut,
      amountIn: response.amountIn,
      amountOut: response.amountOut,
      amountOutMin: response.amountOutMin,
      executionPrice: response.executionPrice,
      priceImpact: response.priceImpact,
      route: response.route,
      gasEstimate: response.gasEstimate,
      gasEstimateUsd: response.gasEstimateUsd,
      timestamp: response.timestamp,
      validUntil: response.validUntil,
    };
  } catch (error) {
    // Log error for debugging
    console.error('Failed to get swap quote from backend:', error);

    // Check if it's a network error, timeout, or API unavailable
    const isNetworkError =
      error instanceof ApiClientError &&
      (error.code === 'API_UNAVAILABLE' ||
        error.code === 'REQUEST_TIMEOUT' ||
        error.code.startsWith('HTTP_5'));

    // Fall back to mock data only for network errors during development
    if (isNetworkError && process.env.NODE_ENV === 'development') {
      console.warn('Using mock quote data (backend unavailable)');
      return getMockQuote(params);
    }

    // Re-throw the error for other cases
    throw error;
  }
}

/**
 * Build swap transaction calldata from backend
 * Returns pre-built transaction data ready for signing
 */
export async function buildSwapTransaction(params: {
  quote: SwapQuote;
  recipient: Address;
  deadline: number; // Unix timestamp
  chainId?: number;
}): Promise<BuildSwapTxResponse> {
  const { quote, recipient, deadline, chainId = 8453 } = params;

  try {
    const response = await apiClient.post<BuildSwapTxResponse>(
      API_CONFIG.endpoints.buildTx,
      {
        tokenIn: quote.tokenIn,
        tokenOut: quote.tokenOut,
        amountIn: quote.amountIn,
        amountOutMin: quote.amountOutMin,
        recipient,
        deadline,
        route: quote.route,
        chainId,
      },
      { timeoutMs: SWAP_QUOTE_TIMEOUT_MS }
    );

    return response;
  } catch (error) {
    console.error('Failed to build swap transaction:', error);
    throw error;
  }
}

/**
 * Get optimal route for swap from backend
 * Useful for multi-hop and split routes
 */
export async function getSwapRoute(params: {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string;
  maxHops?: number;
  maxSplits?: number;
  chainId?: number;
}): Promise<SwapQuote['route']> {
  const {
    tokenIn,
    tokenOut,
    amountIn,
    maxHops = 3,
    maxSplits = 1,
    chainId = 8453,
  } = params;

  try {
    const response = await apiClient.post<SwapQuote['route']>(
      API_CONFIG.endpoints.route,
      {
        tokenIn,
        tokenOut,
        amountIn,
        maxHops,
        maxSplits,
        chainId,
      },
      { timeoutMs: SWAP_QUOTE_TIMEOUT_MS }
    );

    return response;
  } catch (error) {
    console.error('Failed to get swap route:', error);
    throw error;
  }
}

/**
 * Mock quote for development/fallback
 * Used when backend is unavailable during development
 */
function getMockQuote(params: {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string;
  slippage?: number;
}): SwapQuote {
  const { tokenIn, tokenOut, amountIn, slippage = 0.5 } = params;

  // Parse amount
  const amountInBigInt = BigInt(amountIn);

  // Mock: Assume 1:1 ratio with 0.3% fee
  const fee = 0.003;
  const amountOutBeforeFee = amountInBigInt;
  const feeAmount = (amountOutBeforeFee * BigInt(Math.floor(fee * 10000))) / 10000n;
  const amountOutBigInt = amountOutBeforeFee - feeAmount;

  // Calculate min output with slippage
  const slippageAmount =
    (amountOutBigInt * BigInt(Math.floor(slippage * 100))) / 10000n;
  const amountOutMin = amountOutBigInt - slippageAmount;

  // Mock execution price (1:1)
  const executionPrice = 1.0;

  // Mock price impact (0.1% for small trades)
  const priceImpact = 0.1;

  // Mock route (single hop)
  const route = {
    paths: [
      {
        pools: [
          {
            poolId: '0x1234567890123456789012345678901234567890',
            tokenIn,
            tokenOut,
            fee: 3000, // 0.3%
          },
        ],
        percentage: 100,
      },
    ],
    hops: 1,
    splits: 1,
  };

  // Mock gas estimate
  const gasEstimate = '150000';
  const gasEstimateUsd = 0.5;

  const now = Date.now();

  return {
    tokenIn,
    tokenOut,
    amountIn,
    amountOut: amountOutBigInt.toString(),
    amountOutMin: amountOutMin.toString(),
    executionPrice,
    priceImpact,
    route,
    gasEstimate,
    gasEstimateUsd,
    timestamp: now,
    validUntil: now + 15000, // Valid for 15 seconds
  };
}

/**
 * Build route string for display
 */
export function buildRouteString(
  quote: SwapQuote,
  tokenInSymbol: string,
  tokenOutSymbol: string
): string {
  const { route } = quote;

  if (route.paths.length === 1 && route.hops === 1) {
    return `${tokenInSymbol} -> ${tokenOutSymbol}`;
  }

  // For multi-hop routes, build full path
  if (route.paths.length === 1 && route.hops > 1) {
    // Single path with multiple hops
    const pools = route.paths[0].pools;
    const tokens = [tokenInSymbol];

    // Add intermediate tokens (we would need token symbols from addresses)
    for (let i = 0; i < pools.length - 1; i++) {
      tokens.push('...');
    }
    tokens.push(tokenOutSymbol);

    return tokens.join(' -> ');
  }

  // For split routes
  if (route.splits > 1) {
    const splitPercentages = route.paths.map((p) => `${p.percentage}%`).join(', ');
    return `${tokenInSymbol} -> ${tokenOutSymbol} (split: ${splitPercentages})`;
  }

  return `${tokenInSymbol} -> ${tokenOutSymbol}`;
}

/**
 * Calculate price impact severity
 */
export function getPriceImpactSeverity(
  priceImpact: number
): 'low' | 'medium' | 'high' | 'severe' {
  if (priceImpact < 1) return 'low';
  if (priceImpact < 3) return 'medium';
  if (priceImpact < 5) return 'high';
  return 'severe';
}

/**
 * Get price impact color class for UI
 */
export function getPriceImpactColor(priceImpact: number): string {
  const severity = getPriceImpactSeverity(priceImpact);
  switch (severity) {
    case 'low':
      return 'text-green-500';
    case 'medium':
      return 'text-yellow-500';
    case 'high':
      return 'text-orange-500';
    case 'severe':
      return 'text-red-500';
    default:
      return 'text-muted-foreground';
  }
}

/**
 * Check if quote is still valid
 */
export function isQuoteValid(quote: SwapQuote): boolean {
  return Date.now() < quote.validUntil;
}

/**
 * Get time remaining for quote validity
 */
export function getQuoteTimeRemaining(quote: SwapQuote): number {
  return Math.max(0, quote.validUntil - Date.now());
}
