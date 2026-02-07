import { getContract, type Address } from 'viem';
import { getBlockchainClient } from '../client.js';
import { POOL_MANAGER_ABI } from '../abis/poolManager.js';
import { getContractAddresses } from '../../config/index.js';

/**
 * Get PoolManager contract instance
 */
export function getPoolManagerContract(chainId: number) {
  const client = getBlockchainClient(chainId);
  const addresses = getContractAddresses(chainId);

  return getContract({
    address: addresses.poolManager,
    abi: POOL_MANAGER_ABI,
    client,
  });
}

/**
 * Pool state returned from contract
 */
export interface PoolState {
  sqrtPriceX96: bigint;
  tick: number;
  protocolFee: number;
  lpFee: number;
  liquidity: bigint;
}

/**
 * Get pool state (slot0 + liquidity)
 */
export async function getPoolState(
  chainId: number,
  poolId: `0x${string}`
): Promise<PoolState> {
  const contract = getPoolManagerContract(chainId);

  const [slot0, liquidity] = await Promise.all([
    contract.read.getSlot0([poolId]),
    contract.read.getLiquidity([poolId]),
  ]);

  return {
    sqrtPriceX96: slot0[0],
    tick: Number(slot0[1]),
    protocolFee: Number(slot0[2]),
    lpFee: Number(slot0[3]),
    liquidity,
  };
}

/**
 * Get multiple pool states using multicall
 */
export async function getMultiplePoolStates(
  chainId: number,
  poolIds: `0x${string}`[]
): Promise<Map<string, PoolState>> {
  const client = getBlockchainClient(chainId);
  const addresses = getContractAddresses(chainId);

  // Build multicall contracts
  const calls = poolIds.flatMap((poolId) => [
    {
      address: addresses.poolManager,
      abi: POOL_MANAGER_ABI,
      functionName: 'getSlot0',
      args: [poolId],
    },
    {
      address: addresses.poolManager,
      abi: POOL_MANAGER_ABI,
      functionName: 'getLiquidity',
      args: [poolId],
    },
  ]);

  // Execute multicall
  const results = await client.multicall({
    contracts: calls as any,
  });

  // Parse results
  const poolStates = new Map<string, PoolState>();

  for (let i = 0; i < poolIds.length; i++) {
    const slot0Result = results[i * 2];
    const liquidityResult = results[i * 2 + 1];

    if (slot0Result.status === 'success' && liquidityResult.status === 'success') {
      const slot0 = slot0Result.result as [bigint, bigint, bigint, bigint];
      const liquidity = liquidityResult.result as bigint;

      poolStates.set(poolIds[i], {
        sqrtPriceX96: slot0[0],
        tick: Number(slot0[1]),
        protocolFee: Number(slot0[2]),
        lpFee: Number(slot0[3]),
        liquidity,
      });
    }
  }

  return poolStates;
}

/**
 * Get position info
 */
export async function getPositionInfo(
  chainId: number,
  poolId: `0x${string}`,
  owner: Address,
  tickLower: number,
  tickUpper: number,
  salt: `0x${string}` = '0x0000000000000000000000000000000000000000000000000000000000000000'
) {
  const contract = getPoolManagerContract(chainId);

  const position = await contract.read.getPosition([
    poolId,
    owner,
    tickLower,
    tickUpper,
    salt,
  ]);

  return {
    liquidity: position[0],
    feeGrowthInside0LastX128: position[1],
    feeGrowthInside1LastX128: position[2],
  };
}
