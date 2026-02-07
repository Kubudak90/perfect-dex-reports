import { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiClientError } from '@/lib/api/client';
import { Position } from '@/types/pool';

/**
 * Pool info returned by the positions API endpoint
 */
export interface ApiPositionPool {
  token0: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  token1: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  feeTier: number;
}

/**
 * Raw position data from the backend API
 */
interface ApiPosition {
  tokenId: string;
  poolId: string;
  pool: ApiPositionPool;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  tokensOwed0: string;
  tokensOwed1: string;
}

/**
 * API response shape for GET /v1/positions/:address
 */
interface PositionsApiResponse {
  success: boolean;
  data: {
    positions: ApiPosition[];
    total: number;
  };
}

/**
 * Enriched position that includes pool display info from the API.
 * Extends the frontend Position type with additional pool metadata.
 */
export interface EnrichedPosition extends Position {
  pool: ApiPositionPool;
}

/**
 * Map a backend API position to the frontend Position type,
 * enriched with pool info.
 */
function mapApiPosition(
  apiPos: ApiPosition,
  ownerAddress: string,
  chainId: number
): EnrichedPosition {
  return {
    tokenId: Number(apiPos.tokenId),
    owner: ownerAddress as `0x${string}`,
    chainId,
    poolId: apiPos.poolId,
    tickLower: apiPos.tickLower,
    tickUpper: apiPos.tickUpper,
    liquidity: apiPos.liquidity,
    // The list endpoint does not compute token amounts from liquidity.
    // Use '0' as a placeholder; the detail endpoint provides full amounts.
    amount0: '0',
    amount1: '0',
    // Map tokensOwed to unclaimed fees (these are the fees owed to the position owner)
    unclaimedFees0: apiPos.tokensOwed0,
    unclaimedFees1: apiPos.tokensOwed1,
    // inRange cannot be determined without the pool's current tick.
    // Default to true when liquidity is non-zero; the backend could be
    // enhanced to include currentTick in the future.
    inRange: BigInt(apiPos.liquidity) > 0n,
    // Attach pool display info
    pool: apiPos.pool,
  };
}

interface UsePositionsReturn {
  positions: EnrichedPosition[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch real positions from the backend API
 * Replaces the previous getMockPositions approach.
 *
 * @param address - Wallet address to fetch positions for
 * @param chainId - Chain ID (defaults to 8453 for Base)
 */
export function usePositions(
  address: string | undefined,
  chainId: number = 8453
): UsePositionsReturn {
  const [positions, setPositions] = useState<EnrichedPosition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!address) {
      setPositions([]);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get<PositionsApiResponse>(
        `/positions/${address}`,
        { chainId: chainId.toString() }
      );

      if (response.success && response.data) {
        const enriched = response.data.positions.map((p) =>
          mapApiPosition(p, address, chainId)
        );
        setPositions(enriched);
      } else {
        setPositions([]);
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to fetch positions');
      }
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }, [address, chainId]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  return {
    positions,
    loading,
    error,
    refetch: fetchPositions,
  };
}
