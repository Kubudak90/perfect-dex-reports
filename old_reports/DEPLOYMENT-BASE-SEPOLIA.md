# 🚀 BASEBOOK DEX - BASE SEPOLIA DEPLOYMENT

**Deployment Date:** 2026-02-03
**Chain:** Base Sepolia Testnet
**Chain ID:** 84532
**Deployer Address:** 0x2595cd76735D5A0EbAE4041395D6E0Fe88F8Fe60
**Block Number:** 37191430

---

## 📝 DEPLOYED CONTRACT ADDRESSES

### Core Contracts

| Contract | Address | Explorer Link |
|----------|---------|---------------|
| **PoolManager** | `0xDE81e0B7ceCD2F709Edbfdd739B1014Cd14E3DcC` | [View on Basescan](https://sepolia.basescan.org/address/0xDE81e0B7ceCD2F709Edbfdd739B1014Cd14E3DcC) |
| **SwapRouter** | `0xBde7E7Ac23C82913564691d20E1f8a7907465aEc` | [View on Basescan](https://sepolia.basescan.org/address/0xBde7E7Ac23C82913564691d20E1f8a7907465aEc) |
| **Quoter** | `0x35F345362CF926ecC08c7b99df18AA254E121ed7` | [View on Basescan](https://sepolia.basescan.org/address/0x35F345362CF926ecC08c7b99df18AA254E121ed7) |
| **PositionManager** | `0x16eDb8adF2150c984461aeB1EfE9890167eD40be` | [View on Basescan](https://sepolia.basescan.org/address/0x16eDb8adF2150c984461aeB1EfE9890167eD40be) |

### System Contracts

| Contract | Address | Note |
|----------|---------|------|
| **Permit2** | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | Canonical Uniswap Permit2 (already deployed) |

---

## ✅ CONFIGURATION UPDATES

### Backend Configuration (`backend/.env`)

```bash
# RPC URL
RPC_URL_BASE_SEPOLIA=https://base-sepolia.infura.io/v3/c6f3cb043d5443379a100854997c050a

# Contract Addresses - Base Sepolia (Chain ID: 84532)
POOL_MANAGER_ADDRESS_84532=0xDE81e0B7ceCD2F709Edbfdd739B1014Cd14E3DcC
SWAP_ROUTER_ADDRESS_84532=0xBde7E7Ac23C82913564691d20E1f8a7907465aEc
POSITION_MANAGER_ADDRESS_84532=0x16eDb8adF2150c984461aeB1EfE9890167eD40be
QUOTER_ADDRESS_84532=0x35F345362CF926ecC08c7b99df18AA254E121ed7
PERMIT2_ADDRESS_84532=0x000000000022D473030F116dDEE9F6B43aC78BA3
```

### Frontend Configuration (`frontend/.env.local`)

```bash
# Chain ID (Updated to Base Sepolia)
NEXT_PUBLIC_DEFAULT_CHAIN_ID=84532

# Contract Addresses
NEXT_PUBLIC_POOL_MANAGER=0xDE81e0B7ceCD2F709Edbfdd739B1014Cd14E3DcC
NEXT_PUBLIC_SWAP_ROUTER=0xBde7E7Ac23C82913564691d20E1f8a7907465aEc
NEXT_PUBLIC_QUOTER=0x35F345362CF926ecC08c7b99df18AA254E121ed7
NEXT_PUBLIC_POSITION_MANAGER=0x16eDb8adF2150c984461aeB1EfE9890167eD40be
NEXT_PUBLIC_PERMIT2=0x000000000022D473030F116dDEE9F6B43aC78BA3
```

### Backend Code Updates

**Files Modified:**
- ✅ `backend/src/config/chains.ts` - Added `baseSepolia` chain support
- ✅ `backend/src/config/env.ts` - Added Base Sepolia environment variables
- ✅ `backend/src/config/addresses.ts` - Added Base Sepolia contract addresses
- ✅ `backend/src/config/index.ts` - Added Base Sepolia RPC configuration
- ✅ `backend/.env` - Added Base Sepolia addresses and RPC URL

**Default Chain Changed:**
- Before: `8453` (Base Mainnet)
- After: `84532` (Base Sepolia Testnet)

---

## 🔍 CONTRACT VERIFICATION

**Status:** ⚠️ Pending Manual Verification

The automatic verification during deployment encountered an API version deprecation issue. Manual verification needed:

### Verification Commands

```bash
# Verify PoolManager
forge verify-contract \
  0xDE81e0B7ceCD2F709Edbfdd739B1014Cd14E3DcC \
  src/core/PoolManager.sol:PoolManager \
  --chain base-sepolia \
  --etherscan-api-key $BASESCAN_API_KEY

# Verify SwapRouter
forge verify-contract \
  0xBde7E7Ac23C82913564691d20E1f8a7907465aEc \
  src/core/SwapRouter.sol:SwapRouter \
  --chain base-sepolia \
  --constructor-args $(cast abi-encode "constructor(address,address)" 0xDE81e0B7ceCD2F709Edbfdd739B1014Cd14E3DcC 0x000000000022D473030F116dDEE9F6B43aC78BA3) \
  --etherscan-api-key $BASESCAN_API_KEY

# Verify Quoter
forge verify-contract \
  0x35F345362CF926ecC08c7b99df18AA254E121ed7 \
  src/core/Quoter.sol:Quoter \
  --chain base-sepolia \
  --constructor-args $(cast abi-encode "constructor(address)" 0xDE81e0B7ceCD2F709Edbfdd739B1014Cd14E3DcC) \
  --etherscan-api-key $BASESCAN_API_KEY

# Verify PositionManager
forge verify-contract \
  0x16eDb8adF2150c984461aeB1EfE9890167eD40be \
  src/core/PositionManager.sol:PositionManager \
  --chain base-sepolia \
  --constructor-args $(cast abi-encode "constructor(address)" 0xDE81e0B7ceCD2F709Edbfdd739B1014Cd14E3DcC) \
  --etherscan-api-key $BASESCAN_API_KEY
```

---

## 🎯 NEXT STEPS

### Immediate (Today)

1. **✅ COMPLETED:** Deploy contracts to Base Sepolia
2. **✅ COMPLETED:** Update backend configuration files
3. **✅ COMPLETED:** Update frontend configuration files
4. **⚠️ PENDING:** Verify contracts on Basescan
5. **TODO:** Test backend RPC connection to deployed contracts
6. **TODO:** Test frontend wallet connection to deployed contracts

### Short-term (This Week)

7. **TODO:** Create initial liquidity pools (ETH/USDC, WBTC/ETH)
8. **TODO:** Add test tokens to Base Sepolia
9. **TODO:** Run E2E tests against deployed contracts
10. **TODO:** Fix integration issues identified in INTEGRATION-CHECK-REPORT.md
11. **TODO:** Replace frontend mock data with real API calls

### Medium-term (Next 2 Weeks)

12. **TODO:** Deploy and test all 6 hooks (DynamicFee, LimitOrder, TWAP, Oracle, MEV Protection, AutoCompound)
13. **TODO:** Complete integration testing (Frontend ↔ Backend ↔ Router ↔ Contracts)
14. **TODO:** Performance and load testing
15. **TODO:** Fix 15 failing fuzz tests identified in security review

---

## 🧪 TESTING GUIDE

### Backend Testing

```bash
cd backend

# Set environment to use Base Sepolia
export NODE_ENV=development

# Test RPC connection
npm run test:integration

# Test contract interactions
curl http://localhost:3000/health
curl http://localhost:3000/v1/pools?chainId=84532
```

### Frontend Testing

```bash
cd frontend

# Start development server
npm run dev

# Visit http://localhost:3000
# Connect wallet to Base Sepolia
# Try to execute a swap (will need testnet ETH)
```

### Getting Test Funds

**Base Sepolia Faucets:**
- [Base Sepolia Faucet](https://www.basescan.org/faucet) (Official)
- [Alchemy Base Sepolia Faucet](https://sepoliafaucet.com/)
- [QuickNode Faucet](https://faucet.quicknode.com/base/sepolia)

---

## 📊 GAS USAGE REPORT

| Contract | Gas Used | Approximate Cost (ETH) |
|----------|----------|------------------------|
| PoolManager | ~3.5M | ~0.0049 ETH |
| SwapRouter | ~2.8M | ~0.0039 ETH |
| Quoter | ~2.2M | ~0.0031 ETH |
| PositionManager | ~2.3M | ~0.0032 ETH |
| **Total** | **~10.8M** | **~0.015 ETH** |

**Note:** Base Sepolia testnet ETH was used. For mainnet deployment, gas optimization should be performed.

---

## ⚠️ KNOWN ISSUES & WARNINGS

### From Compilation

1. **Unreachable code warning** in ReentrancyGuard (OpenZeppelin)
   - Non-critical, library code

2. **Unused function parameters** in SwapRouter
   - Lines 171, 230: `amountOut` and `amountIn` return values
   - Should be used or removed before mainnet

3. **Unused local variables** in Quoter and PositionManager
   - Should be cleaned up before audit

4. **Function state mutability** in Quoter
   - `quoteExactInputSingle` and `quoteExactOutputSingle` can be restricted to `view`
   - Gas optimization opportunity

### From Previous QA Reports

5. **15 failing fuzz tests** in math libraries
   - Identified in SECURITY-REVIEW-QA.md
   - Must be fixed before mainnet deployment

6. **Hook callbacks not implemented**
   - 6 TODOs in PoolManager.sol
   - Hooks will not function until implemented

---

## 🔐 SECURITY NOTES

### Deployment Security

✅ **Good Practices:**
- Private key stored securely in .env (not committed)
- Deployment script has chain ID check (prevents wrong chain deployment)
- Using canonical Permit2 address

⚠️ **To Improve:**
- Consider using a multisig for contract ownership on mainnet
- Set up Gnosis Safe or similar for contract admin functions
- Implement timelock for critical operations

### Contract Security

**Pre-Audit Status:**
- Core contracts deployed but NOT audited
- Use only for testing, NOT production
- Do not deploy significant funds

**Audit Required Before Mainnet:**
- Tier 2 audit (Cyfrin, Spearbit, etc.)
- Expected cost: $50-80K
- Timeline: 2-3 weeks

---

## 📞 SUPPORT & RESOURCES

### Block Explorers
- **Base Sepolia:** https://sepolia.basescan.org/
- **Base Mainnet:** https://basescan.org/

### RPC Endpoints
- **Public:** https://sepolia.base.org
- **Infura (Used):** https://base-sepolia.infura.io/v3/c6f3cb043d5443379a100854997c050a

### Documentation
- **Base Docs:** https://docs.base.org
- **Viem Docs:** https://viem.sh
- **Foundry Docs:** https://book.getfoundry.sh

---

## ✨ CONCLUSION

**Status:** ✅ **DEPLOYMENT SUCCESSFUL**

All core contracts are successfully deployed to Base Sepolia testnet. This unblocks:
- Backend integration testing
- Frontend integration testing
- E2E test execution
- End-to-end swap functionality

**Next Critical Steps:**
1. Verify contracts on Basescan
2. Test backend connection to contracts
3. Test frontend swap flow
4. Add initial liquidity pools
5. Fix failing tests identified in QA reports

**Time to Functional Testnet:** 2-3 days
**Time to Production Ready:** 6-8 weeks (including audit)

---

**Deployed by:** QA Team
**Deployment Script:** `contracts/script/Deploy.s.sol:DeployTestnet`
**Last Updated:** 2026-02-03
