# ✅ Task #1 Complete: ABI Export

**Date**: 2026-02-03
**Duration**: ~45 minutes
**Status**: ✅ COMPLETE

---

## 📦 Deliverables

### TypeScript ABI Files

```
contracts/abis/
├── PoolManager.json          ✅ (11 KB)
├── PoolManager.ts            ✅ TypeScript wrapper + address
├── SwapRouter.json           ✅ (12 KB)
├── SwapRouter.ts             ✅ TypeScript wrapper + address
├── Quoter.json               ✅ (7.9 KB)
├── Quoter.ts                 ✅ TypeScript wrapper + address
├── PositionManager.json      ✅ (21 KB)
├── PositionManager.ts        ✅ TypeScript wrapper + address
├── index.ts                  ✅ Main export with examples
├── addresses.ts              ✅ (LEGACY - kept for compatibility)
├── package.json              ✅ Package configuration
├── README.md                 ✅ Usage guide
└── COPY_INSTRUCTIONS.md      ✅ Integration instructions
```

### Helper Scripts

```
contracts/scripts/
└── export-abis.sh            ✅ Regeneration script
```

---

## ✨ Features

### 1. TypeScript Wrappers ✅

Each contract has a TypeScript wrapper with:
- **Typed ABI import**: `import abi from './ContractName.json'`
- **Const assertion**: `abi as const` for type safety
- **Address export**: `CONTRACT_NAME_ADDRESS` with chain-specific addresses
- **Usage examples**: wagmi v2 and viem examples

Example:
```typescript
import { PoolManagerABI, POOL_MANAGER_ADDRESS } from '@/abis/PoolManager';

const { data } = useReadContract({
  address: POOL_MANAGER_ADDRESS.BASE_SEPOLIA,
  abi: PoolManagerABI,
  functionName: 'getSlot0',
  args: [poolId],
});
```

### 2. Centralized Exports ✅

`abis/index.ts` provides:
- Named exports for all ABIs
- Contract addresses by chain
- Helper function `getAddresses(chainId)`
- Type exports for TypeScript
- Usage examples for wagmi, viem, ethers.js

### 3. Multiple Import Patterns ✅

**Pattern 1 - Named imports**:
```typescript
import { PoolManagerABI, BASE_SEPOLIA_ADDRESSES } from '@/abis';
```

**Pattern 2 - Individual contract**:
```typescript
import { PoolManagerABI, POOL_MANAGER_ADDRESS } from '@/abis/PoolManager';
```

**Pattern 3 - Direct JSON** (if needed):
```typescript
import PoolManagerJSON from '@/abis/PoolManager.json';
```

### 4. Framework Support ✅

- **wagmi v2**: Full support with useReadContract/useWriteContract
- **viem**: Full support with createPublicClient/createWalletClient
- **ethers.js v6**: Full support with Contract + JsonRpcProvider
- **TypeScript**: Full type safety with const assertions

---

## 📝 Integration Instructions

### Frontend (Next.js + wagmi)

```bash
# Copy ABIs
cp -r contracts/abis frontend/src/lib/constants/

# Or symlink for development
cd frontend/src/lib/constants
ln -s ../../../../contracts/abis ./abis
```

### Backend (Node.js + viem)

```bash
# Copy ABIs
cp -r contracts/abis backend/src/blockchain/

# Or symlink for development
cd backend/src/blockchain
ln -s ../../../contracts/abis ./abis
```

### Verification

Test import in TypeScript:
```typescript
import { PoolManagerABI, BASE_SEPOLIA_ADDRESSES } from './abis';

console.log('PoolManager:', BASE_SEPOLIA_ADDRESSES.PoolManager);
console.log('ABI functions:', PoolManagerABI.length);
```

---

## 🔄 Regeneration

When contracts are updated:

```bash
cd contracts

# Rebuild contracts
forge clean && forge build

# Regenerate ABIs
./scripts/export-abis.sh

# Update addresses in:
# - abis/index.ts
# - abis/PoolManager.ts
# - abis/SwapRouter.ts
# - abis/Quoter.ts
# - abis/PositionManager.ts
```

---

## 📊 Contract Addresses (Base Sepolia)

| Contract | Address | Size |
|----------|---------|------|
| **PoolManager** | `0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05` | 18 KB |
| **SwapRouter** | `0xFf438e2d528F55fD1141382D1eB436201552d1A5` | 8 KB |
| **Quoter** | `0x3e3D0d2cC349F42825B5cF58fd34d3bDFE25404b` | 14 KB |
| **PositionManager** | `0xCf31fbdBD7A44ba1bCF99642E64a1d0B56a372bA` | 32 KB |
| **Permit2** | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | Canonical |

---

## ✅ Quality Checklist

- [x] All 4 contracts have JSON ABIs extracted
- [x] All 4 contracts have TypeScript wrappers
- [x] Contract addresses are accurate (verified on-chain)
- [x] TypeScript types are properly defined (as const)
- [x] Usage examples provided for wagmi v2
- [x] Usage examples provided for viem
- [x] Usage examples provided for ethers.js v6
- [x] Package.json created with proper exports
- [x] Copy instructions documented
- [x] Regeneration script created
- [x] Integration guide created

---

## 🎯 Next Steps

### Task #2: Basescan Verification (30 minutes)

Verify all 4 contracts on https://sepolia.basescan.org:

```bash
# Compiler settings
Solidity: 0.8.24
Optimization: Yes
Runs: 1000000
Via IR: true
EVM Version: cancun

# Command
forge verify-contract <ADDRESS> <CONTRACT> \
  --chain-id 84532 \
  --etherscan-api-key $BASESCAN_API_KEY
```

### Task #3: Fix Failing Fuzz Tests (1 day)

- 15 failing tests in math libraries
- Root causes: extreme values, rounding precision
- Libraries: FullMath, LiquidityMath, SafeCast, SqrtPriceMath, TickMath

### Task #4: Hook Callbacks (later)

- 6 TODO comments in PoolManager.sol
- Implement beforeSwap, afterSwap, etc.

---

**Task #1 Status**: ✅ COMPLETE
**Time Spent**: ~45 minutes
**Next Task**: #2 Basescan Verification
