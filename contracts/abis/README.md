# BaseBook DEX - Contract ABIs

This directory contains the exported ABIs for BaseBook DEX contracts.

## 📁 Files

| File | Description | Size |
|------|-------------|------|
| `PoolManager.json` | Core pool manager contract ABI | ~86 KB |
| `SwapRouter.json` | Swap routing contract ABI | ~62 KB |
| `Quoter.json` | Price quoter contract ABI | ~66 KB |
| `PositionManager.json` | NFT position manager ABI | ~165 KB |
| `addresses.ts` | TypeScript contract addresses | - |
| `index.ts` | TypeScript ABI exports | - |

## 🚀 Usage

### Frontend (wagmi v2)

```typescript
import { useReadContract } from 'wagmi';
import { PoolManagerABI, BASE_SEPOLIA_ADDRESSES } from '@/abis';

export function usePoolSlot0(poolId: string) {
  return useReadContract({
    address: BASE_SEPOLIA_ADDRESSES.PoolManager,
    abi: PoolManagerABI,
    functionName: 'getSlot0',
    args: [poolId],
  });
}
```

### Backend (viem)

```typescript
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { PoolManagerABI, BASE_SEPOLIA_ADDRESSES } from './abis';

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.BASE_SEPOLIA_RPC_URL),
});

const slot0 = await client.readContract({
  address: BASE_SEPOLIA_ADDRESSES.PoolManager,
  abi: PoolManagerABI,
  functionName: 'getSlot0',
  args: [poolId],
});
```

### Backend (ethers.js v6)

```typescript
import { ethers } from 'ethers';
import { PoolManagerABI, BASE_SEPOLIA_ADDRESSES } from './abis';

const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
const poolManager = new ethers.Contract(
  BASE_SEPOLIA_ADDRESSES.PoolManager,
  PoolManagerABI,
  provider
);

const slot0 = await poolManager.getSlot0(poolId);
```

## 📋 Contract Addresses (Base Sepolia)

```typescript
const addresses = {
  PoolManager: '0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05',
  SwapRouter: '0xFf438e2d528F55fD1141382D1eB436201552d1A5',
  Quoter: '0x3e3D0d2cC349F42825B5cF58fd34d3bDFE25404b',
  PositionManager: '0xCf31fbdBD7A44ba1bCF99642E64a1d0B56a372bA',
  Permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
};
```

## 🔄 Updating ABIs

When contracts are redeployed, regenerate ABIs:

```bash
# From contracts/ directory
mkdir -p abis
for contract in PoolManager SwapRouter Quoter PositionManager; do
  jq '.abi' "out/${contract}.sol/${contract}.json" > "abis/${contract}.json"
done
```

## 📦 Integration

### Copy to Frontend

```bash
# From contracts/ directory
cp -r abis ../frontend/src/lib/constants/
```

### Copy to Backend

```bash
# From contracts/ directory
cp -r abis ../backend/src/
```

## 🔗 Explorer Links

- [PoolManager](https://sepolia.basescan.org/address/0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05)
- [SwapRouter](https://sepolia.basescan.org/address/0xFf438e2d528F55fD1141382D1eB436201552d1A5)
- [Quoter](https://sepolia.basescan.org/address/0x3e3D0d2cC349F42825B5cF58fd34d3bDFE25404b)
- [PositionManager](https://sepolia.basescan.org/address/0xCf31fbdBD7A44ba1bCF99642E64a1d0B56a372bA)

---

**Last Updated**: 2026-02-03
**Chain**: Base Sepolia (84532)
