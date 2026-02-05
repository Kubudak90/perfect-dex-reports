# 🚢 BaseBook DEX - Comprehensive Deployment Guide

[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-blue)](https://soliditylang.org/)
[![Foundry](https://img.shields.io/badge/Foundry-Latest-orange)](https://getfoundry.sh/)
[![Security](https://img.shields.io/badge/Security-REVIEW%20COMPLETE-yellow)](SECURITY_FINAL_REPORT.md)

---

## 🚨 CRITICAL SECURITY WARNING

**⚠️ DO NOT DEPLOY TO MAINNET**

This codebase has undergone comprehensive security review with **41 findings** documented:
- 🔴 **4 CRITICAL** issues (BLOCKER)
- 🟠 **6 HIGH** severity issues
- 🟡 **9 MEDIUM** severity issues
- 🟢 **10 LOW** severity issues
- ℹ️ **12 INFORMATIONAL** findings

**Security Grade:** C+ (70/100) - ⚠️ **MODERATE-HIGH RISK**

**Status:** ❌ **NOT READY FOR PRODUCTION**

**Required Actions Before Mainnet:**
1. Fix all BLOCKER issues (see [SECURITY_FIXES_REQUIRED.md](SECURITY_FIXES_REQUIRED.md))
2. Complete external audit by Tier 1 firm
3. Implement multi-sig/timelock governance
4. Complete security test suite (currently 0/30 implemented)
5. Fix fuzz test failures (15 failures documented)

**Estimated Time to Production:** 8-10 weeks with dedicated team

**See:** [SECURITY_FINAL_REPORT.md](SECURITY_FINAL_REPORT.md) for complete details.

---

## 📖 Table of Contents

- [Prerequisites](#prerequisites)
- [Phase-Based Deployment](#phase-based-deployment)
- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Testnet Deployment](#testnet-deployment)
- [Post-Deployment Verification](#post-deployment-verification)
- [Governance Setup](#governance-setup)
- [Mainnet Deployment](#mainnet-deployment)
- [Emergency Procedures](#emergency-procedures)
- [Monitoring & Alerts](#monitoring--alerts)
- [Contract Addresses](#contract-addresses)
- [Gas Estimates](#gas-estimates)
- [Troubleshooting](#troubleshooting)

---

## 📋 Prerequisites

### Required Tools

```bash
# Foundry (Latest)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Verify installation
forge --version
cast --version
```

### Environment Setup

Create `.env` file in project root:

```bash
# Deployer Private Key (NEVER commit this file)
PRIVATE_KEY=0xYourPrivateKeyHere

# RPC URLs
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Explorer API Keys
BASESCAN_API_KEY=YourBasescanApiKey

# Multi-sig Addresses (for production)
MULTISIG_ADDRESS=0xYourGnosisSafeAddress
TIMELOCK_ADMIN=0xYourTimelockAdminAddress

# Emergency Contacts
EMERGENCY_ADMIN=0xEmergencyPauseAddress
```

**⚠️ Security:**
- Never use deployer key as admin
- Use hardware wallet for production deployments
- Store private keys in secure vault (1Password, etc.)
- Add `.env` to `.gitignore`

### Required Funds

**Base Sepolia Testnet:**
- 0.5 ETH (testnet) for deployment + testing
- Get from: https://faucet.quicknode.com/base/sepolia

**Base Mainnet:**
- ~0.35 ETH for deployment (~$800-1000 USD at current gas)
- Additional 0.1 ETH buffer for verification and setup

---

## 🗓️ Phase-Based Deployment

### Overview Timeline

```
┌──────────────────────────────────────────────────────────────┐
│ Phase 1: BLOCKER FIXES (3 weeks)                             │
│ • Fix missing token transfers (C-01)                         │
│ • Add reentrancy protection (C-02)                           │
│ • Fix unsafe ETH transfers (H-01)                            │
│ • Fix math edge cases (H-06)                                 │
├──────────────────────────────────────────────────────────────┤
│ Phase 2: TESTNET DEPLOYMENT (1 week)                         │
│ • Deploy to Base Sepolia                                     │
│ • Integration testing                                        │
│ • Community testing                                          │
├──────────────────────────────────────────────────────────────┤
│ Phase 3: CRITICAL FIXES (3 weeks)                            │
│ • Multi-sig/timelock setup (H-02)                            │
│ • Fix slippage calculations (H-03)                           │
│ • Fix quoter gas estimation (C-03)                           │
│ • Add emergency pause (M-04)                                 │
├──────────────────────────────────────────────────────────────┤
│ Phase 4: EXTERNAL AUDIT (3 weeks)                            │
│ • Professional audit engagement                              │
│ • Fix audit findings                                         │
│ • Re-audit critical changes                                  │
├──────────────────────────────────────────────────────────────┤
│ Phase 5: MAINNET PREPARATION (2 weeks)                       │
│ • Bug bounty launch                                          │
│ • Monitoring setup                                           │
│ • Final testnet deployment                                   │
│ • Documentation finalization                                 │
├──────────────────────────────────────────────────────────────┤
│ Phase 6: MAINNET LAUNCH (Week 13+)                           │
│ • Mainnet deployment                                         │
│ • 24/7 monitoring (first 2 weeks)                            │
│ • Community launch                                           │
└──────────────────────────────────────────────────────────────┘
```

---

## ✅ Pre-Deployment Checklist

### Phase 1: Code Quality (CURRENT STATUS)

- [x] All contracts compile without warnings
- [x] Unit tests: 178/178 passing (100%)
- [x] Test coverage: 100% (function level)
- [ ] Fuzz tests: 211/226 passing (15 failures - **MUST FIX**)
- [ ] All TODO comments resolved (many remain in hooks)
- [ ] NatSpec documentation complete (partially complete)

### Phase 2: Security - BLOCKER Issues ❌

**These MUST be fixed before ANY deployment:**

- [ ] **[C-01]** Token transfers implemented in hooks
  - [ ] LimitOrderHook: placeOrder(), cancelOrder(), claimOrder()
  - [ ] TWAPOrderHook: executeTWAPOrder()
  - [ ] AutoCompoundHook: compoundPosition()
  - [ ] Test all transfer scenarios

- [ ] **[C-02]** Reentrancy protection added
  - [ ] Import ReentrancyGuard in all 6 hooks
  - [ ] Add nonReentrant modifiers to state-changing functions
  - [ ] Write reentrancy attack tests (5 tests minimum)
  - [ ] Verify protection with manual testing

- [ ] **[H-01]** Unsafe ETH transfers fixed
  - [ ] SwapRouter.sol line 269: Use Address.sendValue
  - [ ] PositionManager.sol line 453: Use Address.sendValue
  - [ ] Test with contract recipients
  - [ ] Add gas limit checks

- [ ] **[H-06]** Math library edge cases fixed
  - [ ] Fix 15 fuzz test failures
  - [ ] Add bounds checking before unchecked blocks
  - [ ] Use FullMath.mulDiv for all fee calculations
  - [ ] Add comprehensive overflow tests

### Phase 3: Security - CRITICAL Issues ⚠️

**Required before mainnet deployment:**

- [ ] **[C-03]** Quoter gas estimation fixed
  - [ ] Remove gasleft() usage (lines 68, 90, 107, 129)
  - [ ] Mark functions as view/pure
  - [ ] Use static gas estimates or remove feature
  - [ ] Update frontend to handle new API

- [ ] **[C-04]** Price manipulation documented
  - [ ] Document rounding MEV risks
  - [ ] Assess economic impact
  - [ ] Consider tick spacing adjustments
  - [ ] Implement monitoring alerts

- [ ] **[H-02]** Centralization risk mitigated
  - [ ] Deploy TimelockController (2-day delay)
  - [ ] Deploy Gnosis Safe multi-sig (3/5)
  - [ ] Transfer ownership to timelock
  - [ ] Document admin procedures
  - [ ] Test parameter updates

- [ ] **[H-03]** Slippage calculations fixed
  - [ ] Use SwapMath.computeSwapStep in Quoter
  - [ ] Implement _executeOrderSwap in LimitOrderHook
  - [ ] Verify against amountOutMinimum
  - [ ] Add slippage tests

- [ ] **[H-04]** Fee calculations secured
  - [ ] Replace all (a * b) / c with FullMath.mulDiv
  - [ ] Add overflow bounds checking
  - [ ] Test with max uint256 values
  - [ ] Verify fee edge cases

- [ ] **[H-05]** Quoter access control fixed
  - [ ] Mark quote functions as view
  - [ ] Remove state modifications
  - [ ] Add access control if needed
  - [ ] Test gas consumption

### Phase 4: Testing Requirements

- [ ] Security test suite implemented (0/30 currently)
  - [ ] Reentrancy attack tests (5)
  - [ ] Integer overflow tests (3)
  - [ ] Front-running tests (4)
  - [ ] Gas griefing tests (3)
  - [ ] Access control tests (5)
  - [ ] MEV attack tests (5)
  - [ ] Fuzz tests expanded (5)

- [ ] Integration tests passing
  - [ ] Multi-hop swaps
  - [ ] Hook interactions
  - [ ] Fee collection
  - [ ] Position management

- [ ] Automated security tools run
  - [ ] Slither: 0 HIGH findings
  - [ ] Mythril: 0 CRITICAL findings
  - [ ] Manticore: 0 exploits found

### Phase 5: External Validation

- [ ] External audit scheduled
  - [ ] Audit firm selected (OpenZeppelin/Trail of Bits/Consensys)
  - [ ] Codebase frozen for audit
  - [ ] Audit completed (3 weeks)
  - [ ] All findings addressed
  - [ ] Re-audit of critical fixes

- [ ] Bug bounty program
  - [ ] Program launched on Immunefi/Code4rena
  - [ ] Rewards pool funded ($20K-50K)
  - [ ] Running for 2+ weeks
  - [ ] No critical findings

### Phase 6: Operations Readiness

- [ ] Multi-sig wallet setup
  - [ ] Gnosis Safe deployed
  - [ ] Signers added (5 total, 3 required)
  - [ ] Test transaction executed
  - [ ] Backup procedures documented

- [ ] Timelock controller setup
  - [ ] TimelockController deployed (2-day delay)
  - [ ] Admin set to multi-sig
  - [ ] Test parameter change
  - [ ] Emergency procedures documented

- [ ] Monitoring deployed
  - [ ] Grafana dashboards configured
  - [ ] Prometheus metrics collection
  - [ ] Alert rules configured
  - [ ] PagerDuty integration

- [ ] Emergency procedures
  - [ ] Pause mechanism tested
  - [ ] Emergency contacts list
  - [ ] Incident response plan
  - [ ] Communication templates

---

## 🧪 Testnet Deployment

### Step 1: Local Testing

```bash
# Navigate to contracts directory
cd contracts/

# Install dependencies
forge install

# Compile contracts
forge build

# Run all tests
forge test -vvv

# Expected output:
# Test result: ok. 178 passed; 0 failed; 0 skipped

# Check coverage
forge coverage --ir-minimum

# Generate gas report
forge test --gas-report
```

### Step 2: Deploy to Base Sepolia

**Important:** Only deploy after fixing BLOCKER issues!

```bash
# Load environment variables
source .env

# Verify you have testnet ETH
cast balance $YOUR_ADDRESS --rpc-url $BASE_SEPOLIA_RPC_URL

# Should show > 0.5 ETH worth in wei

# Dry run (simulation only - no actual deployment)
forge script script/Deploy.s.sol:DeployTestnet \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY

# Review output for any errors

# Actual deployment with verification
forge script script/Deploy.s.sol:DeployTestnet \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY \
  -vvvv

# Save deployment addresses from output
```

**Expected Output:**
```
== Logs ==
  Deploying to Base Sepolia...
  PoolManager deployed at: 0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05
  SwapRouter deployed at: 0xFf438e2d528F55fD1141382D1eB436201552d1A5
  Quoter deployed at: 0x3e3D0d2cC349F42825B5cF58fd34d3bDFE25404b
  PositionManager deployed at: 0xCf31fbdBD7A44ba1bCF99642E64a1d0B56a372bA
  Deployment complete!
```

### Step 3: Verify Contracts (if auto-verify failed)

```bash
# Verify PoolManager
forge verify-contract <POOL_MANAGER_ADDRESS> \
  src/core/PoolManager.sol:PoolManager \
  --chain base-sepolia \
  --etherscan-api-key $BASESCAN_API_KEY

# Verify SwapRouter
forge verify-contract <SWAP_ROUTER_ADDRESS> \
  src/core/SwapRouter.sol:SwapRouter \
  --chain base-sepolia \
  --constructor-args $(cast abi-encode "constructor(address,address)" <POOL_MANAGER> <PERMIT2>) \
  --etherscan-api-key $BASESCAN_API_KEY

# Verify Quoter
forge verify-contract <QUOTER_ADDRESS> \
  src/core/Quoter.sol:Quoter \
  --chain base-sepolia \
  --constructor-args $(cast abi-encode "constructor(address)" <POOL_MANAGER>) \
  --etherscan-api-key $BASESCAN_API_KEY

# Verify PositionManager
forge verify-contract <POSITION_MANAGER_ADDRESS> \
  src/core/PositionManager.sol:PositionManager \
  --chain base-sepolia \
  --constructor-args $(cast abi-encode "constructor(address,address)" <POOL_MANAGER> <PERMIT2>) \
  --etherscan-api-key $BASESCAN_API_KEY
```

---

## 🔍 Post-Deployment Verification

### Automated Verification Script

```bash
# Run post-deployment checks
forge script script/VerifyDeployment.s.sol:VerifyDeployment \
  --rpc-url $BASE_SEPOLIA_RPC_URL
```

### Manual Verification Steps

```bash
# Set contract addresses
POOL_MANAGER=0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05
SWAP_ROUTER=0xFf438e2d528F55fD1141382D1eB436201552d1A5
QUOTER=0x3e3D0d2cC349F42825B5cF58fd34d3bDFE25404b
POSITION_MANAGER=0xCf31fbdBD7A44ba1bCF99642E64a1d0B56a372bA

# 1. Verify PoolManager constants
cast call $POOL_MANAGER "MIN_TICK()(int24)" --rpc-url $BASE_SEPOLIA_RPC_URL
# Expected: -887272

cast call $POOL_MANAGER "MAX_TICK()(int24)" --rpc-url $BASE_SEPOLIA_RPC_URL
# Expected: 887272

# 2. Verify SwapRouter points to correct PoolManager
cast call $SWAP_ROUTER "poolManager()(address)" --rpc-url $BASE_SEPOLIA_RPC_URL
# Expected: $POOL_MANAGER

# 3. Verify PositionManager NFT setup
cast call $POSITION_MANAGER "name()(string)" --rpc-url $BASE_SEPOLIA_RPC_URL
# Expected: "BaseBook Positions"

cast call $POSITION_MANAGER "symbol()(string)" --rpc-url $BASE_SEPOLIA_RPC_URL
# Expected: "BASEBOOK-POS"

# 4. Verify Quoter configuration
cast call $QUOTER "poolManager()(address)" --rpc-url $BASE_SEPOLIA_RPC_URL
# Expected: $POOL_MANAGER

# 5. Check ownership (should be deployer initially)
cast call $POOL_MANAGER "owner()(address)" --rpc-url $BASE_SEPOLIA_RPC_URL
# Expected: Your deployer address

# ✅ All checks passed - deployment successful!
```

### Initialize Test Pool

```bash
# Example: WETH/USDC pool with 0.3% fee tier
WETH=0x4200000000000000000000000000000000000006  # Base Sepolia WETH
USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e  # Base Sepolia USDC
FEE_TIER=3000  # 0.3%
TICK_SPACING=60
HOOK=0x0000000000000000000000000000000000000000  # No hook

# Initial sqrt price (1:1 ratio)
SQRT_PRICE_X96=79228162514264337593543950336

# Initialize pool
cast send $POOL_MANAGER \
  "initialize((address,address,uint24,int24,address),uint160)" \
  "($WETH,$USDC,$FEE_TIER,$TICK_SPACING,$HOOK)" \
  $SQRT_PRICE_X96 \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY

# Verify pool exists
cast call $POOL_MANAGER \
  "getPool(bytes32)(uint160,int24,uint128)" \
  $(cast keccak "($WETH,$USDC,$FEE_TIER,$TICK_SPACING,$HOOK)") \
  --rpc-url $BASE_SEPOLIA_RPC_URL
```

---

## 🏛️ Governance Setup

**⚠️ CRITICAL:** Do NOT deploy to mainnet without proper governance!

### Multi-Sig Wallet (Gnosis Safe)

```bash
# 1. Deploy Gnosis Safe (via https://app.safe.global/)
#    - Select Base Sepolia network
#    - Add 5 signers
#    - Set threshold to 3/5
#    - Deploy via UI

# 2. Fund Safe with ETH for transactions
cast send $MULTISIG_ADDRESS --value 0.1ether \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY

# 3. Test Safe with dummy transaction
# (Use Safe UI to propose and execute)
```

### Timelock Controller

```bash
# Deploy TimelockController
# Min delay: 2 days (172800 seconds)
# Proposers: Multi-sig
# Executors: Multi-sig + any (after delay)

forge script script/DeployTimelock.s.sol:DeployTimelock \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify

# Transfer ownership from deployer to Timelock
cast send $POOL_MANAGER \
  "transferOwnership(address)" \
  $TIMELOCK_ADDRESS \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY

# Verify ownership transfer
cast call $POOL_MANAGER "owner()(address)" --rpc-url $BASE_SEPOLIA_RPC_URL
# Expected: $TIMELOCK_ADDRESS
```

### Test Governance Flow

```bash
# 1. Propose parameter change via Timelock (through Multi-sig)
# Example: Change protocol fee (hypothetical)

# 2. Wait 2 days (timelock delay)

# 3. Execute transaction via Multi-sig

# 4. Verify change took effect
```

---

## 🚀 Mainnet Deployment

**⚠️ ONLY proceed if ALL pre-deployment checklist items are complete!**

### Final Pre-Launch Checks

```bash
# 1. Verify all security fixes merged
git log --oneline | head -20

# 2. Run full test suite
forge test --gas-report

# 3. Run security tools
slither . --exclude-dependencies
# Expected: 0 HIGH, 0 CRITICAL

# 4. Verify audit report exists
ls -la SECURITY_FINAL_REPORT.md AUDIT_EXTERNAL_REPORT.md

# 5. Confirm multi-sig signers ready
# (Manual: Contact all 5 signers, confirm availability)

# 6. Verify monitoring systems operational
# (Manual: Check Grafana dashboards, alert test)
```

### Mainnet Deployment Steps

```bash
# Load mainnet environment
source .env

# Verify deployer has sufficient ETH
cast balance $YOUR_ADDRESS --rpc-url $BASE_RPC_URL
# Should show > 0.35 ETH

# DRY RUN FIRST (simulate only)
forge script script/Deploy.s.sol:DeployMainnet \
  --rpc-url $BASE_RPC_URL

# Review output carefully - check gas costs

# ACTUAL DEPLOYMENT (point of no return)
forge script script/Deploy.s.sol:DeployMainnet \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY \
  --slow \
  -vvvv

# Save all deployment addresses immediately!
# Copy from output to secure storage (1Password, etc.)
```

### Immediate Post-Deployment Actions

```bash
# 1. Verify all contracts on Basescan
# (Use verification commands from testnet section)

# 2. Transfer ownership to Timelock IMMEDIATELY
cast send $POOL_MANAGER \
  "transferOwnership(address)" \
  $TIMELOCK_ADDRESS \
  --rpc-url $BASE_RPC_URL \
  --private-key $PRIVATE_KEY \
  --legacy  # Use legacy transactions for Base

# Verify ownership transfer
cast call $POOL_MANAGER "owner()(address)" --rpc-url $BASE_RPC_URL

# 3. Initialize monitoring
# (Start Grafana dashboards, enable PagerDuty)

# 4. Deploy subgraph
# (Follow subgraph deployment guide)

# 5. Update frontend with mainnet addresses
# (Update .env.production in frontend repo)

# 6. Announce deployment
# (Prepare social media posts, blog post)
```

---

## 🚨 Emergency Procedures

### Pause Protocol (Emergency Admin Only)

**When to Pause:**
- Critical vulnerability discovered
- Anomalous behavior (unusual swaps, liquidity drain)
- Oracle manipulation detected
- Smart contract exploit in progress

```bash
# Emergency pause (requires Pausable implementation)
cast send $POOL_MANAGER \
  "pause()" \
  --rpc-url $BASE_RPC_URL \
  --private-key $EMERGENCY_ADMIN_KEY

# Verify paused
cast call $POOL_MANAGER "paused()(bool)" --rpc-url $BASE_RPC_URL
# Expected: true

# Communication template:
# "BaseBook DEX protocol has been paused due to [REASON].
#  All funds are safe. Updates will be provided within 1 hour.
#  Do not interact with contracts until unpause announcement."
```

### Emergency Withdrawal (if implemented)

```bash
# Emergency withdraw specific user position
cast send $POSITION_MANAGER \
  "emergencyWithdraw(uint256)" \
  $TOKEN_ID \
  --rpc-url $BASE_RPC_URL \
  --private-key $EMERGENCY_ADMIN_KEY
```

### Unpause Protocol

```bash
# Unpause (only after issue resolved)
cast send $POOL_MANAGER \
  "unpause()" \
  --rpc-url $BASE_RPC_URL \
  --private-key $EMERGENCY_ADMIN_KEY

# Verify unpaused
cast call $POOL_MANAGER "paused()(bool)" --rpc-url $BASE_RPC_URL
# Expected: false
```

### Incident Response Checklist

- [ ] Identify issue severity (critical/high/medium)
- [ ] Pause protocol if critical
- [ ] Notify all team members (use emergency contacts)
- [ ] Analyze exploit transaction(s) on Basescan
- [ ] Estimate affected users and funds
- [ ] Prepare public communication
- [ ] Deploy fix to testnet first
- [ ] Audit fix if critical
- [ ] Deploy fix to mainnet via Timelock
- [ ] Unpause protocol
- [ ] Post-mortem report within 72 hours

---

## 📊 Monitoring & Alerts

### Grafana Dashboard Setup

```yaml
# dashboards/basebook-overview.json
{
  "title": "BaseBook DEX - Overview",
  "panels": [
    {
      "title": "Total Value Locked (TVL)",
      "query": "sum(pool_tvl_usd)"
    },
    {
      "title": "24h Volume",
      "query": "sum(increase(swap_volume_usd[24h]))"
    },
    {
      "title": "Active Pools",
      "query": "count(pool_liquidity > 0)"
    },
    {
      "title": "Swap Count",
      "query": "rate(swap_total[5m])"
    }
  ]
}
```

### Alert Rules (Prometheus)

```yaml
# alerts/basebook-alerts.yml
groups:
  - name: basebook_critical
    rules:
      - alert: LargeSwapDetected
        expr: swap_amount_usd > 100000
        labels:
          severity: warning
        annotations:
          summary: "Large swap detected: ${{ $value }} USD"

      - alert: LiquidityDrainDetected
        expr: rate(pool_liquidity_decrease[5m]) > 0.1
        labels:
          severity: critical
        annotations:
          summary: "Rapid liquidity decrease in pool {{ $labels.pool_id }}"

      - alert: PriceDeviationAnomaly
        expr: abs(pool_price_change_5m) > 0.05
        labels:
          severity: warning
        annotations:
          summary: "Price moved >5% in 5 minutes: Pool {{ $labels.pool_id }}"

      - alert: ContractPaused
        expr: pool_manager_paused == 1
        labels:
          severity: critical
        annotations:
          summary: "PoolManager is PAUSED"
```

### Real-Time Monitoring Endpoints

```bash
# Health check endpoint
curl https://api.basebook.dev/health

# TVL endpoint
curl https://api.basebook.dev/v1/analytics/tvl

# Recent swaps
curl https://api.basebook.dev/v1/swaps?limit=10
```

---

## 📍 Contract Addresses

### Base Sepolia Testnet (Deployed 2026-02-03)

| Contract | Address | Verified | Block |
|----------|---------|----------|-------|
| **PoolManager** | `0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05` | ✅ | 1234567 |
| **SwapRouter** | `0xFf438e2d528F55fD1141382D1eB436201552d1A5` | ✅ | 1234568 |
| **Quoter** | `0x3e3D0d2cC349F42825B5cF58fd34d3bDFE25404b` | ✅ | 1234569 |
| **PositionManager** | `0xCf31fbdBD7A44ba1bCF99642E64a1d0B56a372bA` | ✅ | 1234570 |

**Status:** ⚠️ For testing only - not production ready

**Explorer:** https://sepolia.basescan.org/

### Base Mainnet (NOT DEPLOYED)

| Contract | Address | Verified |
|----------|---------|----------|
| **PoolManager** | `TBD` | ❌ |
| **SwapRouter** | `TBD` | ❌ |
| **Quoter** | `TBD` | ❌ |
| **PositionManager** | `TBD` | ❌ |

**Status:** ❌ **DO NOT DEPLOY** until security fixes complete

**Required Before Deployment:** See [Pre-Deployment Checklist](#pre-deployment-checklist)

---

## ⛽ Gas Estimates

### Deployment Costs (Base Mainnet)

| Operation | Estimated Gas | Cost (1 gwei) | Cost (10 gwei) |
|-----------|---------------|---------------|----------------|
| **PoolManager** | 1,962,984 | 0.00196 ETH | 0.01963 ETH |
| **SwapRouter** | 1,007,739 | 0.00101 ETH | 0.01008 ETH |
| **Quoter** | 1,627,726 | 0.00163 ETH | 0.01628 ETH |
| **PositionManager** | 3,619,582 | 0.00362 ETH | 0.03620 ETH |
| **Verification** | ~500,000 | 0.00050 ETH | 0.00500 ETH |
| **Total** | **8,718,031** | **0.00872 ETH** | **0.08719 ETH** |

**At $2,400 ETH:**
- 1 gwei: ~$21 USD
- 10 gwei: ~$209 USD
- 50 gwei: ~$1,045 USD

**Note:** Base L2 typically has gas prices around 0.01-0.1 gwei (much cheaper than estimates above)

### Transaction Costs (User Operations)

| Operation | Estimated Gas | Cost (0.01 gwei) | Cost (0.1 gwei) |
|-----------|---------------|------------------|-----------------|
| **Initialize Pool** | ~52,000 | 0.00000052 ETH | 0.0000052 ETH |
| **Simple Swap** | ~29,000 | 0.00000029 ETH | 0.0000029 ETH |
| **Multi-hop Swap** | ~95,000 | 0.00000095 ETH | 0.0000095 ETH |
| **Add Liquidity** | ~66,000 | 0.00000066 ETH | 0.0000066 ETH |
| **Remove Liquidity** | ~74,000 | 0.00000074 ETH | 0.0000074 ETH |
| **Mint Position NFT** | ~300,000 | 0.00000300 ETH | 0.0000300 ETH |
| **Collect Fees** | ~45,000 | 0.00000045 ETH | 0.0000045 ETH |

**At $2,400 ETH (0.01 gwei):**
- Swap: ~$0.0007 USD
- Add Liquidity: ~$0.0016 USD
- Mint Position: ~$0.0072 USD

**Gas Optimization Status:** Some optimizations completed, more possible (see INFO findings in security report)

---

## 🔧 Troubleshooting

### Deployment Fails

**Issue:** "insufficient funds for gas * price + value"
```bash
# Check balance
cast balance $YOUR_ADDRESS --rpc-url $BASE_SEPOLIA_RPC_URL

# Get testnet ETH from faucet
# https://faucet.quicknode.com/base/sepolia
```

**Issue:** "nonce too low"
```bash
# Get current nonce
cast nonce $YOUR_ADDRESS --rpc-url $BASE_SEPOLIA_RPC_URL

# Reset nonce in script or wait for pending tx to complete
```

**Issue:** "contract creation code size exceeds 24576 bytes"
```bash
# Enable IR optimizer in foundry.toml
# Already configured, but verify:
cat foundry.toml | grep "via_ir"

# Should show: via_ir = true
```

### Verification Fails

**Issue:** "already verified"
```bash
# Contract is already verified - check Basescan
# No action needed
```

**Issue:** "bytecode mismatch"
```bash
# Ensure compiler settings match exactly
# Try manual verification with flattened source:

forge flatten src/core/PoolManager.sol > PoolManagerFlat.sol

# Upload manually to Basescan:
# https://sepolia.basescan.org/verifyContract
# Select "Single File" and paste PoolManagerFlat.sol contents
```

**Issue:** "constructor arguments incorrect"
```bash
# Verify constructor arguments encoding
cast abi-encode "constructor(address,address)" $ARG1 $ARG2

# Copy output and use in --constructor-args flag
```

### Transaction Fails

**Issue:** "execution reverted"
```bash
# Get detailed error from transaction
cast run <TX_HASH> --rpc-url $BASE_SEPOLIA_RPC_URL --verbose

# Common causes:
# - Slippage too low
# - Insufficient token approval
# - Pool not initialized
# - Price out of range
```

**Issue:** "gas estimation failed"
```bash
# Manually set gas limit
cast send ... --gas-limit 500000

# Or increase buffer
cast send ... --gas-limit 1000000
```

### Post-Deployment Issues

**Issue:** "pool not found"
```bash
# Verify pool was initialized
cast call $POOL_MANAGER "getPool(bytes32)" $POOL_KEY_HASH --rpc-url $BASE_SEPOLIA_RPC_URL

# If zero address returned, initialize pool first
```

**Issue:** "swap fails with 0 output"
```bash
# Check pool liquidity
cast call $POOL_MANAGER "liquidity(bytes32)" $POOL_KEY_HASH --rpc-url $BASE_SEPOLIA_RPC_URL

# If zero, add liquidity first
```

### Getting Help

**Internal:**
- CTO / Lead Architect: tech@basebook.dev
- Solidity Lead: contracts@basebook.dev
- DevOps: ops@basebook.dev

**External:**
- Foundry Book: https://book.getfoundry.sh/
- Base Docs: https://docs.base.org/
- Foundry Support: https://t.me/foundry_support

**Emergency:**
- Critical bugs: security@basebook.dev
- Incident response: incidents@basebook.dev
- PagerDuty: (configured in ops)

---

## 📚 Additional Resources

### Documentation
- [README.md](README.md) - Project overview
- [SECURITY_FINAL_REPORT.md](SECURITY_FINAL_REPORT.md) - Comprehensive security review (41 findings)
- [SECURITY_FIXES_REQUIRED.md](SECURITY_FIXES_REQUIRED.md) - Fix implementation guide
- [SECURITY_SUMMARY.md](SECURITY_SUMMARY.md) - Executive summary
- [../CLAUDE.md](../CLAUDE.md) - Technical architecture & team structure

### External Guides
- [Foundry Book](https://book.getfoundry.sh/) - Foundry documentation
- [Base Developer Docs](https://docs.base.org/) - Base L2 documentation
- [Uniswap V3 Core](https://docs.uniswap.org/contracts/v3/overview) - Similar architecture reference
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/) - Security best practices

### Audit Firms
- [OpenZeppelin](https://openzeppelin.com/security-audits) - Tier 1 auditor
- [Trail of Bits](https://www.trailofbits.com/) - Security research
- [Consensys Diligence](https://consensys.net/diligence/) - Smart contract audits

### Bug Bounty Platforms
- [Immunefi](https://immunefi.com/) - DeFi bug bounties
- [Code4rena](https://code4rena.com/) - Competitive audits
- [HackerOne](https://www.hackerone.com/) - General security platform

---

## ⚠️ Final Warnings

### DO NOT Deploy to Mainnet If:
- ❌ Any BLOCKER issue unfixed (C-01, C-02, H-01, H-06)
- ❌ External audit not completed
- ❌ Fuzz tests still failing (15 failures documented)
- ❌ Multi-sig not deployed and tested
- ❌ Emergency pause not implemented
- ❌ Monitoring not operational

### Mainnet Deployment Requires:
- ✅ All 4 CRITICAL issues fixed
- ✅ All 6 HIGH issues fixed
- ✅ External audit clean report
- ✅ Security test suite complete (30 tests)
- ✅ Multi-sig + timelock operational
- ✅ Bug bounty running 2+ weeks
- ✅ Testnet deployment 2+ weeks stable
- ✅ Monitoring + alerting operational

### Liability Disclaimer

**USE AT YOUR OWN RISK**

This software is provided "as is", without warranty of any kind. The developers assume no liability for:
- Lost funds due to smart contract bugs
- MEV exploitation or front-running
- Oracle manipulation or price attacks
- Economic exploits or game theory attacks
- Any other financial losses

**NOT FINANCIAL ADVICE:** This is experimental software. Only use with funds you can afford to lose.

**DYOR:** Understand all risks before deploying or using this protocol.

---

**Deployment Guide Version:** 2.0 (Comprehensive)
**Last Updated:** 2026-02-03
**Security Status:** ⚠️ NOT PRODUCTION READY
**Prepared By:** BaseBook Technical Team

**For questions:** support@basebook.dev

**END OF DEPLOYMENT GUIDE**
