# ABI Update Instructions for Solidity Team

## 📋 Overview

The frontend ABI directory has been created at `src/lib/constants/abis/` with placeholder files. The Solidity team needs to populate these files with actual contract ABIs.

## 📁 Files to Update

```
src/lib/constants/abis/
├── PoolManager.ts      ⚠️ NEEDS UPDATE
├── SwapRouter.ts       ⚠️ NEEDS UPDATE
├── Quoter.ts           ⚠️ NEEDS UPDATE
├── PositionManager.ts  ⚠️ NEEDS UPDATE
├── ERC20.ts            ✅ Complete
├── Permit2.ts          ✅ Complete
└── index.ts            ✅ Complete (exports)
```

## 🔧 How to Update ABIs

### Step 1: Build Contracts

```bash
cd contracts
forge build
```

### Step 2: Locate ABI Files

After building, find the compiled artifacts:

```
contracts/out/
├── PoolManager.sol/
│   └── PoolManager.json       ← Contains ABI
├── SwapRouter.sol/
│   └── SwapRouter.json         ← Contains ABI
├── Quoter.sol/
│   └── Quoter.json             ← Contains ABI
└── PositionManager.sol/
    └── PositionManager.json    ← Contains ABI
```

### Step 3: Extract ABI Array

Open each JSON file and find the `"abi"` field. It looks like this:

```json
{
  "abi": [
    {
      "type": "function",
      "name": "initialize",
      "stateMutability": "nonpayable",
      "inputs": [...],
      "outputs": [...]
    },
    ...
  ],
  ...
}
```

Copy the entire array inside `"abi"`.

### Step 4: Update Frontend Files

#### PoolManager.ts

```typescript
// Replace empty array with actual ABI
export const POOL_MANAGER_ABI = [
  // Paste ABI array from PoolManager.json here
  {
    type: 'function',
    name: 'initialize',
    stateMutability: 'nonpayable',
    inputs: [...],
    outputs: [...]
  },
  ...
] as const;
```

#### SwapRouter.ts

```typescript
export const SWAP_ROUTER_ABI = [
  // Paste ABI array from SwapRouter.json here
] as const;
```

#### Quoter.ts

```typescript
export const QUOTER_ABI = [
  // Paste ABI array from Quoter.json here
] as const;
```

#### PositionManager.ts

```typescript
export const POSITION_MANAGER_ABI = [
  // Paste ABI array from PositionManager.json here
] as const;
```

### Step 5: Verify TypeScript Compilation

```bash
cd frontend
npm run typecheck
```

Should output: **No errors**

## 🎯 Important Notes

1. **Keep `as const`**: This is required for TypeScript type inference
2. **Don't modify index.ts**: It's already configured correctly
3. **Complete array**: Copy the entire ABI array, including all functions and events
4. **Format**: Maintain proper JSON formatting (use Prettier if available)

## ✅ Checklist

- [ ] Build contracts with `forge build`
- [ ] Extract ABI from `PoolManager.json`
- [ ] Update `PoolManager.ts`
- [ ] Extract ABI from `SwapRouter.json`
- [ ] Update `SwapRouter.ts`
- [ ] Extract ABI from `Quoter.json`
- [ ] Update `Quoter.ts`
- [ ] Extract ABI from `PositionManager.json`
- [ ] Update `PositionManager.ts`
- [ ] Run `npm run typecheck` to verify
- [ ] Commit changes

## 📞 Contact

If you have questions, ask the Frontend Lead.

---

**Status**: ⚠️ **WAITING FOR SOLIDITY TEAM**
**Priority**: 🔴 **HIGH** (Blocks frontend contract interaction)
