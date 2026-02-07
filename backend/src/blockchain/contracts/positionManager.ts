import { Address } from 'viem';
import { getBlockchainClient } from '../client.js';
import { POSITION_MANAGER_ABI } from '../abis/positionManager.js';
import { getContractAddresses } from '../../config/addresses.js';

/**
 * Position data structure
 */
export interface Position {
  poolId: `0x${string}`;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  feeGrowthInside0LastX128: bigint;
  feeGrowthInside1LastX128: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
}

/**
 * Get position details by token ID
 */
export async function getPosition(
  chainId: number,
  tokenId: bigint
): Promise<Position> {
  const client = getBlockchainClient(chainId);
  const positionManagerAddress = getContractAddresses(chainId).positionManager;

  const result = await client.readContract({
    address: positionManagerAddress,
    abi: POSITION_MANAGER_ABI,
    functionName: 'positions',
    args: [tokenId],
  }) as [
    `0x${string}`,
    number,
    number,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint
  ];

  return {
    poolId: result[0],
    tickLower: result[1],
    tickUpper: result[2],
    liquidity: result[3],
    feeGrowthInside0LastX128: result[4],
    feeGrowthInside1LastX128: result[5],
    tokensOwed0: result[6],
    tokensOwed1: result[7],
  };
}

/**
 * Get position owner
 */
export async function getPositionOwner(
  chainId: number,
  tokenId: bigint
): Promise<Address> {
  const client = getBlockchainClient(chainId);
  const positionManagerAddress = getContractAddresses(chainId).positionManager;

  return await client.readContract({
    address: positionManagerAddress,
    abi: POSITION_MANAGER_ABI,
    functionName: 'ownerOf',
    args: [tokenId],
  }) as Address;
}

/**
 * Get number of positions for an address
 */
export async function getPositionBalance(
  chainId: number,
  owner: Address
): Promise<bigint> {
  const client = getBlockchainClient(chainId);
  const positionManagerAddress = getContractAddresses(chainId).positionManager;

  return await client.readContract({
    address: positionManagerAddress,
    abi: POSITION_MANAGER_ABI,
    functionName: 'balanceOf',
    args: [owner],
  }) as bigint;
}

/**
 * Get token ID by owner and index
 */
export async function getTokenOfOwnerByIndex(
  chainId: number,
  owner: Address,
  index: bigint
): Promise<bigint> {
  const client = getBlockchainClient(chainId);
  const positionManagerAddress = getContractAddresses(chainId).positionManager;

  return await client.readContract({
    address: positionManagerAddress,
    abi: POSITION_MANAGER_ABI,
    functionName: 'tokenOfOwnerByIndex',
    args: [owner, index],
  }) as bigint;
}

/**
 * Get all positions for an address
 */
export async function getPositionsByOwner(
  chainId: number,
  owner: Address
): Promise<Array<{ tokenId: bigint; position: Position }>> {
  const balance = await getPositionBalance(chainId, owner);
  const balanceNumber = Number(balance);

  if (balanceNumber === 0) {
    return [];
  }

  const client = getBlockchainClient(chainId);
  const positionManagerAddress = getContractAddresses(chainId).positionManager;

  // Get all token IDs using multicall
  const tokenIdCalls = Array.from({ length: balanceNumber }, (_, i) => ({
    address: positionManagerAddress,
    abi: POSITION_MANAGER_ABI,
    functionName: 'tokenOfOwnerByIndex',
    args: [owner, BigInt(i)],
  }));

  const tokenIdsResults = await client.multicall({
    contracts: tokenIdCalls as any,
  });

  const tokenIds = tokenIdsResults
    .filter((result) => result.status === 'success')
    .map((result) => result.result as bigint);

  // Get position details using multicall
  const positionCalls = tokenIds.map((tokenId) => ({
    address: positionManagerAddress,
    abi: POSITION_MANAGER_ABI,
    functionName: 'positions',
    args: [tokenId],
  }));

  const positionsResults = await client.multicall({
    contracts: positionCalls as any,
  });

  return tokenIds
    .map((tokenId, index) => {
      const result = positionsResults[index];
      if (result.status !== 'success') return null;

      const positionData = result.result as [
        `0x${string}`,
        number,
        number,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint
      ];

      return {
        tokenId,
        position: {
          poolId: positionData[0],
          tickLower: positionData[1],
          tickUpper: positionData[2],
          liquidity: positionData[3],
          feeGrowthInside0LastX128: positionData[4],
          feeGrowthInside1LastX128: positionData[5],
          tokensOwed0: positionData[6],
          tokensOwed1: positionData[7],
        },
      };
    })
    .filter((item): item is { tokenId: bigint; position: Position } => item !== null);
}
