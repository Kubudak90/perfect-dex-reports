# Basescan Verification Guide

**Chain**: Base Sepolia (84532)
**Explorer**: https://sepolia.basescan.org

---

## 📋 Contracts to Verify

| Contract | Address | Priority |
|----------|---------|----------|
| **PoolManager** | `0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05` | Critical |
| **SwapRouter** | `0xFf438e2d528F55fD1141382D1eB436201552d1A5` | Critical |
| **Quoter** | `0x3e3D0d2cC349F42825B5cF58fd34d3bDFE25404b` | High |
| **PositionManager** | `0xCf31fbdBD7A44ba1bCF99642E64a1d0B56a372bA` | Critical |

---

## 🛠️ Compiler Settings

Use these exact settings for verification:

```
Compiler Type: Solidity (Single file)
Compiler Version: v0.8.24+commit.e11b9ed9
Open Source License: MIT

Optimization: Yes
Runs: 1000000

EVM Version: cancun
Via IR: true
```

---

## 🚀 Method 1: forge verify-contract

### PoolManager

```bash
forge verify-contract \
  0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05 \
  src/core/PoolManager.sol:PoolManager \
  --chain-id 84532 \
  --etherscan-api-key $BASESCAN_API_KEY \
  --verifier-url "https://api-sepolia.basescan.org/api" \
  --watch
```

### SwapRouter

```bash
forge verify-contract \
  0xFf438e2d528F55fD1141382D1eB436201552d1A5 \
  src/core/SwapRouter.sol:SwapRouter \
  --chain-id 84532 \
  --etherscan-api-key $BASESCAN_API_KEY \
  --verifier-url "https://api-sepolia.basescan.org/api" \
  --constructor-args $(cast abi-encode "constructor(address,address)" 0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05 0x000000000022D473030F116dDEE9F6B43aC78BA3) \
  --watch
```

### Quoter

```bash
forge verify-contract \
  0x3e3D0d2cC349F42825B5cF58fd34d3bDFE25404b \
  src/core/Quoter.sol:Quoter \
  --chain-id 84532 \
  --etherscan-api-key $BASESCAN_API_KEY \
  --verifier-url "https://api-sepolia.basescan.org/api" \
  --constructor-args $(cast abi-encode "constructor(address)" 0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05) \
  --watch
```

### PositionManager

```bash
forge verify-contract \
  0xCf31fbdBD7A44ba1bCF99642E64a1d0B56a372bA \
  src/core/PositionManager.sol:PositionManager \
  --chain-id 84532 \
  --etherscan-api-key $BASESCAN_API_KEY \
  --verifier-url "https://api-sepolia.basescan.org/api" \
  --constructor-args $(cast abi-encode "constructor(address)" 0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05) \
  --watch
```

---

## 📝 Method 2: Manual Verification (If forge fails)

### Step 1: Generate Flattened Contract

```bash
forge flatten src/core/PoolManager.sol > PoolManager_flat.sol
```

### Step 2: Go to Basescan

Visit: https://sepolia.basescan.org/verifyContract

### Step 3: Fill Form

1. **Contract Address**: `0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05`
2. **Compiler Type**: Solidity (Single file)
3. **Compiler Version**: v0.8.24+commit.e11b9ed9
4. **Open Source License**: MIT
5. **Optimization**: Yes
6. **Optimizer Runs**: 1000000
7. **EVM Version**: cancun
8. **Contract Code**: Paste flattened contract
9. **Constructor Arguments**: (leave empty for PoolManager)
10. **Libraries**: (leave empty)

---

## 🐛 Troubleshooting

### Error: "Compilation failed"

**Cause**: Compiler settings mismatch

**Fix**: Ensure exact settings:
- Compiler: 0.8.24
- Optimization: Yes, 1000000 runs
- EVM: cancun
- Via IR: true

### Error: "Constructor arguments invalid"

**Cause**: Incorrect ABI encoding

**Fix**: Use cast to encode:
```bash
cast abi-encode "constructor(address,address)" 0x91B... 0x000...
```

### Error: "Already verified"

**Cause**: Contract already verified

**Check**: Visit contract page on Basescan

### Error: "API Key invalid"

**Fix**: Check `.env` file:
```bash
BASESCAN_API_KEY=91GM2EAR1UI27MRUJ19S9QTYGCR4Q2SQP4
```

---

## ✅ Verification Checklist

After verification, check:

- [ ] Contract source code visible
- [ ] "Read Contract" tab works
- [ ] "Write Contract" tab works
- [ ] Constructor arguments displayed correctly
- [ ] License shown as MIT
- [ ] Optimization settings correct

---

## 🔗 Verified Contract Links

After verification:

- PoolManager: https://sepolia.basescan.org/address/0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05#code
- SwapRouter: https://sepolia.basescan.org/address/0xFf438e2d528F55fD1141382D1eB436201552d1A5#code
- Quoter: https://sepolia.basescan.org/address/0x3e3D0d2cC349F42825B5cF58fd34d3bDFE25404b#code
- PositionManager: https://sepolia.basescan.org/address/0xCf31fbdBD7A44ba1bCF99642E64a1d0B56a372bA#code

---

**Manual verification recommended due to previous API issues**
