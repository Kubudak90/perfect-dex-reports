import { getContract, type Address } from 'viem';
import { getBlockchainClient } from '../client.js';
import { ERC20_ABI } from '../abis/erc20.js';

/**
 * Token metadata from contract
 */
export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
}

/**
 * Get ERC20 contract instance
 */
export function getERC20Contract(chainId: number, tokenAddress: Address) {
  const client = getBlockchainClient(chainId);

  return getContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    client,
  });
}

/**
 * Get token metadata from contract
 */
export async function getTokenMetadata(
  chainId: number,
  tokenAddress: Address
): Promise<TokenMetadata> {
  const contract = getERC20Contract(chainId, tokenAddress);

  const [name, symbol, decimals, totalSupply] = await Promise.all([
    contract.read.name(),
    contract.read.symbol(),
    contract.read.decimals(),
    contract.read.totalSupply(),
  ]);

  return {
    name,
    symbol,
    decimals,
    totalSupply,
  };
}

/**
 * Get token balance for an address
 */
export async function getTokenBalance(
  chainId: number,
  tokenAddress: Address,
  holderAddress: Address
): Promise<bigint> {
  const contract = getERC20Contract(chainId, tokenAddress);
  return await contract.read.balanceOf([holderAddress]);
}

/**
 * Get multiple token balances using multicall
 */
export async function getMultipleTokenBalances(
  chainId: number,
  tokenAddresses: Address[],
  holderAddress: Address
): Promise<Map<Address, bigint>> {
  const client = getBlockchainClient(chainId);

  const calls = tokenAddresses.map((tokenAddress) => ({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [holderAddress],
  }));

  const results = await client.multicall({
    contracts: calls as any,
  });

  const balances = new Map<Address, bigint>();

  results.forEach((result, index) => {
    if (result.status === 'success') {
      balances.set(tokenAddresses[index], result.result as bigint);
    }
  });

  return balances;
}

/**
 * Get token allowance
 */
export async function getTokenAllowance(
  chainId: number,
  tokenAddress: Address,
  owner: Address,
  spender: Address
): Promise<bigint> {
  const contract = getERC20Contract(chainId, tokenAddress);
  return await contract.read.allowance([owner, spender]);
}
