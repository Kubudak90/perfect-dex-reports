# Hook Deployment - Manual Guide

**Issue**: Automated deployment encountered technical difficulties.

**Status**: Core contracts deployed ✅, Hooks pending manual deployment ⏳

---

## Quick Deploy Commands

### 1. Deploy All Hooks

```bash
cd /Users/huseyinarslan/Desktop/basebook-dex2/contracts

forge script script/DeployHooks.s.sol:DeployHooks \
  --rpc-url https://base-sepolia.infura.io/v3/c6f3cb043d5443379a100854997c050a \
  --broadcast \
  --legacy \
  --skip-simulation
```

### 2. Deploy Individual Hooks

**DynamicFeeHook**:
```bash
forge script script/DeployDynamicFee.s.sol:DeployDynamicFee \
  --rpc-url https://base-sepolia.infura.io/v3/c6f3cb043d5443379a100854997c050a \
  --broadcast \
  --legacy \
  --skip-simulation
```

**OracleHook**:
```bash
forge script script/DeployHooks.s.sol:DeployOracleHook \
  --rpc-url https://base-sepolia.infura.io/v3/c6f3cb043d5443379a100854997c050a \
  --broadcast \
  --legacy \
  --skip-simulation
```

---

## Alternative: Deploy with forge create

### DynamicFeeHook

```bash
source .env
forge create src/hooks/DynamicFeeHook.sol:DynamicFeeHook \
  --rpc-url https://base-sepolia.infura.io/v3/c6f3cb043d5443379a100854997c050a \
  --private-key $PRIVATE_KEY \
  --constructor-args 0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05 \
  --legacy
```

### OracleHook

```bash
forge create src/hooks/OracleHook.sol:OracleHook \
  --rpc-url https://base-sepolia.infura.io/v3/c6f3cb043d5443379a100854997c050a \
  --private-key $PRIVATE_KEY \
  --constructor-args 0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05 \
  --legacy
```

### LimitOrderHook

```bash
forge create src/hooks/LimitOrderHook.sol:LimitOrderHook \
  --rpc-url https://base-sepolia.infura.io/v3/c6f3cb043d5443379a100854997c050a \
  --private-key $PRIVATE_KEY \
  --constructor-args 0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05 \
  --legacy
```

### MEVProtectionHook

```bash
forge create src/hooks/MEVProtectionHook.sol:MEVProtectionHook \
  --rpc-url https://base-sepolia.infura.io/v3/c6f3cb043d5443379a100854997c050a \
  --private-key $PRIVATE_KEY \
  --constructor-args 0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05 \
  --legacy
```

### TWAPOrderHook

```bash
forge create src/hooks/TWAPOrderHook.sol:TWAPOrderHook \
  --rpc-url https://base-sepolia.infura.io/v3/c6f3cb043d5443379a100854997c050a \
  --private-key $PRIVATE_KEY \
  --constructor-args 0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05 \
  --legacy
```

### AutoCompoundHook

```bash
forge create src/hooks/AutoCompoundHook.sol:AutoCompoundHook \
  --rpc-url https://base-sepolia.infura.io/v3/c6f3cb043d5443379a100854997c050a \
  --private-key $PRIVATE_KEY \
  --constructor-args 0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05 \
  --legacy
```

---

## Verification After Deployment

Check each hook is deployed:

```bash
cast code <HOOK_ADDRESS> --rpc-url https://base-sepolia.infura.io/v3/c6f3cb043d5443379a100854997c050a
```

---

## Update Integration Files

After deploying, update `abis/addresses.ts`:

```typescript
export const BASE_SEPOLIA_HOOKS = {
  DynamicFee: '0x...', // Add deployed address
  Oracle: '0x...',
  LimitOrder: '0x...',
  MEVProtection: '0x...',
  TWAPOrder: '0x...',
  AutoCompound: '0x...',
} as const;
```

---

## Troubleshooting

### Compilation Errors

```bash
forge clean
forge build
```

### Gas Estimation Failed

Add `--gas-limit` flag:
```bash
--gas-limit 5000000
```

### Transaction Underpriced

Use higher gas price:
```bash
--gas-price 2000000000
```

---

**PoolManager Address**: `0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05`
**Chain**: Base Sepolia (84532)
**RPC**: Infura Base Sepolia
