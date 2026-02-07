# ABI Copy Instructions

This directory contains production-ready TypeScript ABIs for BaseBook DEX contracts.

## 📁 Directory Structure

```
contracts/abis/
├── PoolManager.json          # Raw ABI (JSON)
├── PoolManager.ts            # TypeScript wrapper
├── SwapRouter.json           # Raw ABI
├── SwapRouter.ts             # TypeScript wrapper
├── Quoter.json               # Raw ABI
├── Quoter.ts                 # TypeScript wrapper
├── PositionManager.json      # Raw ABI
├── PositionManager.ts        # TypeScript wrapper
├── index.ts                  # Main export
├── addresses.ts              # Contract addresses (LEGACY)
├── package.json              # Package config
└── README.md                 # Usage guide
```

---

## 🚀 Frontend Integration

### Option 1: Copy Entire Directory

```bash
# From contracts/ directory
cp -r abis ../frontend/src/lib/constants/

# Or from basebook-dex2/ root
cp -r contracts/abis frontend/src/lib/constants/
```

### Option 2: Symlink (for development)

```bash
# From frontend/src/lib/constants/
ln -s ../../../../contracts/abis ./abis
```

### Usage in Frontend (wagmi v2)

```typescript
// In your component
import { useReadContract } from 'wagmi';
import { PoolManagerABI, BASE_SEPOLIA_ADDRESSES } from '@/lib/constants/abis';

export function PoolInfo({ poolId }: { poolId: string }) {
  const { data: slot0 } = useReadContract({
    address: BASE_SEPOLIA_ADDRESSES.PoolManager,
    abi: PoolManagerABI,
    functionName: 'getSlot0',
    args: [poolId],
  });

  return <div>Current Price: {slot0?.sqrtPriceX96}</div>;
}
```

---

## 🔧 Backend Integration

### Option 1: Copy Entire Directory

```bash
# From contracts/ directory
cp -r abis ../backend/src/blockchain/

# Or from basebook-dex2/ root
cp -r contracts/abis backend/src/blockchain/
```

### Option 2: Symlink (for development)

```bash
# From backend/src/blockchain/
ln -s ../../../contracts/abis ./abis
```

### Usage in Backend (viem)

```typescript
// In your service
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { PoolManagerABI, BASE_SEPOLIA_ADDRESSES } from './blockchain/abis';

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.BASE_SEPOLIA_RPC_URL),
});

export async function getPoolSlot0(poolId: string) {
  return await client.readContract({
    address: BASE_SEPOLIA_ADDRESSES.PoolManager,
    abi: PoolManagerABI,
    functionName: 'getSlot0',
    args: [poolId],
  });
}
```

### Usage in Backend (ethers.js v6)

```typescript
import { ethers } from 'ethers';
import { PoolManagerABI, BASE_SEPOLIA_ADDRESSES } from './blockchain/abis';

const provider = new ethers.JsonRpcProvider(
  process.env.BASE_SEPOLIA_RPC_URL
);

const poolManager = new ethers.Contract(
  BASE_SEPOLIA_ADDRESSES.PoolManager,
  PoolManagerABI,
  provider
);

export async function getPoolSlot0(poolId: string) {
  return await poolManager.getSlot0(poolId);
}
```

---

## 📦 npm Package (Future)

When ready to publish as npm package:

```bash
cd contracts/abis
npm publish --access public
```

Then in frontend/backend:

```bash
npm install @basebook/abis
```

```typescript
import { PoolManagerABI, BASE_SEPOLIA_ADDRESSES } from '@basebook/abis';
```

---

## 🔄 Regenerating ABIs

When contracts are updated and redeployed:

```bash
cd contracts

# Clean and rebuild
forge clean
forge build

# Regenerate ABIs
./scripts/export-abis.sh
```

Or manually:

```bash
# Extract ABIs from build artifacts
mkdir -p abis
jq '.abi' out/PoolManager.sol/PoolManager.json > abis/PoolManager.json
jq '.abi' out/SwapRouter.sol/SwapRouter.json > abis/SwapRouter.json
jq '.abi' out/Quoter.sol/Quoter.json > abis/Quoter.json
jq '.abi' out/PositionManager.sol/PositionManager.json > abis/PositionManager.json
```

Then update addresses in `index.ts` and individual `.ts` files.

---

## ✅ Verification Checklist

After copying ABIs:

- [ ] Frontend can import ABIs without errors
- [ ] Backend can import ABIs without errors
- [ ] Contract addresses are correct for target network
- [ ] TypeScript compilation passes
- [ ] wagmi/viem hooks work correctly
- [ ] Test transactions succeed

---

## 📞 Support

If you encounter issues:

1. Check that TypeScript is configured correctly
2. Verify imports match your project structure
3. Ensure viem/wagmi versions are compatible
4. Check contract addresses are for correct network

---

**Last Updated**: 2026-02-03
**Contracts Version**: 1.0.0 (Base Sepolia)
