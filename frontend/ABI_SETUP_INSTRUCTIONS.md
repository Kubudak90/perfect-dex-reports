# 📝 ABI Setup Instructions

## ⚠️ ABIs Not Yet Copied

The frontend needs contract ABIs to interact with deployed contracts.

---

## 🔧 Option 1: Automatic Copy (Recommended)

### Prerequisites
- `jq` installed (`brew install jq` on macOS)
- Contracts built (`forge build` in contracts/ directory)

### Steps
```bash
cd /Users/huseyinarslan/Desktop/basebook-dex2
bash COPY_ABIS.sh
```

This will:
1. Extract ABIs from `contracts/out/`
2. Create TypeScript files in `frontend/src/lib/constants/abis/`
3. Generate index file for easy imports

---

## 🔧 Option 2: Manual Copy

If automatic copy fails, manually extract ABIs:

###  1. Build Contracts
```bash
cd contracts
forge build
```

### 2. Create Directory
```bash
mkdir -p frontend/src/lib/constants/abis
```

### 3. Extract Each ABI

#### PoolManager
```bash
jq '.abi' contracts/out/PoolManager.sol/PoolManager.json > \
  frontend/src/lib/constants/abis/PoolManager.json

# Then wrap in TypeScript:
echo "export const POOLMANAGER_ABI = " > \
  frontend/src/lib/constants/abis/PoolManager.ts
cat frontend/src/lib/constants/abis/PoolManager.json >> \
  frontend/src/lib/constants/abis/PoolManager.ts
echo " as const;" >> \
  frontend/src/lib/constants/abis/PoolManager.ts
```

#### Repeat for other contracts:
- SwapRouter
- Quoter
- PositionManager

---

## 🔧 Option 3: Use Minimal ABIs (Quick Start)

For immediate testing, use minimal ABIs with only essential functions.

### Create files manually:

**frontend/src/lib/constants/abis/PoolManager.ts:**
```typescript
export const POOLMANAGER_ABI = [
  {
    type: 'function',
    name: 'getSlot0',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'protocolFee', type: 'uint24' },
      { name: 'lpFee', type: 'uint24' }
    ],
  },
  {
    type: 'function',
    name: 'getLiquidity',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [{ name: 'liquidity', type: 'uint128' }],
  },
] as const;
```

**frontend/src/lib/constants/abis/SwapRouter.ts:**
```typescript
export const SWAPROUTER_ABI = [
  {
    type: 'function',
    name: 'swap',
    stateMutability: 'payable',
    inputs: [
      { name: 'params', type: 'tuple', components: [
        { name: 'poolKey', type: 'tuple', components: [
          { name: 'token0', type: 'address' },
          { name: 'token1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' }
        ]},
        { name: 'zeroForOne', type: 'bool' },
        { name: 'amountSpecified', type: 'int256' },
        { name: 'sqrtPriceLimitX96', type: 'uint160' },
        { name: 'recipient', type: 'address' }
      ]}
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
] as const;
```

**frontend/src/lib/constants/abis/Quoter.ts:**
```typescript
export const QUOTER_ABI = [
  {
    type: 'function',
    name: 'quoteExactInputSingle',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'params', type: 'tuple', components: [
        { name: 'poolKey', type: 'tuple', components: [
          { name: 'token0', type: 'address' },
          { name: 'token1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' }
        ]},
        { name: 'zeroForOne', type: 'bool' },
        { name: 'amountIn', type: 'uint128' },
        { name: 'sqrtPriceLimitX96', type: 'uint160' }
      ]}
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' }
    ],
  },
] as const;
```

**frontend/src/lib/constants/abis/PositionManager.ts:**
```typescript
export const POSITIONMANAGER_ABI = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'payable',
    inputs: [
      { name: 'params', type: 'tuple', components: [
        { name: 'poolKey', type: 'tuple', components: [
          { name: 'token0', type: 'address' },
          { name: 'token1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' }
        ]},
        { name: 'tickLower', type: 'int24' },
        { name: 'tickUpper', type: 'int24' },
        { name: 'liquidity', type: 'uint128' },
        { name: 'recipient', type: 'address' }
      ]}
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'burn',
    stateMutability: 'payable',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [],
  },
] as const;
```

**frontend/src/lib/constants/abis/index.ts:**
```typescript
export { POOLMANAGER_ABI } from './PoolManager';
export { SWAPROUTER_ABI } from './SwapRouter';
export { QUOTER_ABI } from './Quoter';
export { POSITIONMANAGER_ABI } from './PositionManager';
```

---

## ✅ Verification

After adding ABIs, verify they work:

```typescript
// In your frontend code:
import { POOLMANAGER_ABI } from '@/lib/constants/abis';
import { useReadContract } from 'wagmi';

const { data } = useReadContract({
  address: '0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05',
  abi: POOLMANAGER_ABI,
  functionName: 'getSlot0',
  args: [poolId],
});
```

If no errors, ABIs are working! ✅

---

## 🚨 Current Status

- ❌ ABIs not added yet
- ✅ Directory structure ready
- ✅ Script created (COPY_ABIS.sh)
- ✅ Manual instructions provided

**Next Step:** Choose an option above and add the ABIs!
