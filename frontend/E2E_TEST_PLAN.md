# 🧪 E2E TEST PLAN — BaseBook DEX

**Test Environment:** Base Sepolia Testnet
**Date:** 2026-02-03
**QA Engineer:** Automated E2E Testing

---

## 📋 Test Environment Configuration

### Services & Ports

| Service | URL | Port | Status |
|---------|-----|------|--------|
| **Frontend** | http://localhost:3001 | 3001 | ⏳ Not Started |
| **Backend API** | http://localhost:3000 | 3000 | ⏳ Not Started |
| **Router API** | http://localhost:3001 | 3001 | ⏳ Not Started |

### ⚠️ Port Conflict Detected

**Issue:** Router and Frontend both configured for port 3001

**Resolution Options:**
1. Frontend on 3001, Backend on 3000, Router on 3002 (RECOMMENDED)
2. Frontend on 3000, Backend on 4000, Router on 3001

**Recommended Configuration:**
```bash
# Frontend (Next.js dev)
PORT=3001 npm run dev

# Backend API
PORT=3000 npm run dev

# Router API
PORT=3002 cargo run
```

---

## 🎯 E2E Test Scenarios

### Test Suite 1: Wallet Connection

**Priority:** CRITICAL

**Test Cases:**
1. **Connect Wallet**
   - Open homepage
   - Click "Connect Wallet"
   - Select MetaMask
   - Approve connection
   - Verify wallet address displayed

2. **Network Check**
   - Verify connected to Base Sepolia (84532)
   - If wrong network, show switch prompt
   - Verify network switch works

3. **Disconnect Wallet**
   - Click disconnect
   - Verify wallet disconnected
   - Verify UI updates correctly

**Expected Results:**
- ✓ Wallet connects successfully
- ✓ Correct network (Base Sepolia)
- ✓ Address displayed in header
- ✓ Balance loaded

---

### Test Suite 2: Token Selection

**Priority:** HIGH

**Test Cases:**
1. **Open Token Selector**
   - Click "Select Token" on swap widget
   - Verify modal opens
   - Verify token list loads

2. **Search Tokens**
   - Type "ETH" in search
   - Verify filtered results
   - Verify token logos display

3. **Select Token**
   - Click ETH token
   - Verify modal closes
   - Verify token selected in UI
   - Verify balance displays

**Expected Results:**
- ✓ Token selector opens
- ✓ Search works
- ✓ Token selection updates UI
- ✓ Balances load correctly

---

### Test Suite 3: Swap Quote

**Priority:** CRITICAL

**Test Cases:**
1. **Get Quote - ETH to USDC**
   - Select ETH as input token
   - Select USDC as output token
   - Enter amount: 0.1 ETH
   - Wait for quote

2. **Verify Quote Data**
   - Output amount displayed
   - Exchange rate shown
   - Price impact shown
   - Gas estimate shown

3. **Quote Updates**
   - Change input amount
   - Verify quote updates (debounced)
   - Verify loading state shows

**Expected Results:**
- ✓ Quote fetched within 2 seconds
- ✓ All quote data displayed
- ✓ Quote updates on amount change
- ✓ No errors in console

**API Endpoint Tested:**
```
POST http://localhost:3000/v1/quote
```

---

### Test Suite 4: Swap Execution

**Priority:** CRITICAL

**Test Cases:**
1. **Approve Token (if needed)**
   - If approval needed, show approve button
   - Click "Approve USDC"
   - Wait for transaction
   - Verify approval confirmed

2. **Execute Swap**
   - Enter swap amount
   - Get quote
   - Click "Swap"
   - Review transaction details
   - Confirm in wallet
   - Wait for transaction

3. **Verify Swap Success**
   - Transaction confirmed on-chain
   - Balance updated
   - Success notification shown
   - Transaction link works

**Expected Results:**
- ✓ Approval works (if needed)
- ✓ Swap transaction submitted
- ✓ Transaction confirmed
- ✓ Balances updated correctly
- ✓ UI shows success state

**Blockchain Interaction:**
- Contract: SwapRouter (0xFf438e2d528F55fD1141382D1eB436201552d1A5)
- Network: Base Sepolia (84532)

---

### Test Suite 5: Pool Discovery

**Priority:** HIGH

**Test Cases:**
1. **Browse Pools**
   - Navigate to /pools
   - Verify pool list loads
   - Verify sorting works (TVL, Volume, APR)

2. **Pool Details**
   - Click on a pool
   - Verify pool details page loads
   - Verify chart displays
   - Verify pool stats show

3. **Pool Search**
   - Use search to find specific pool
   - Verify search results
   - Verify filters work

**Expected Results:**
- ✓ Pool list loads
- ✓ Pool data displays correctly
- ✓ Charts render
- ✓ Search/filter works

**API Endpoint Tested:**
```
GET http://localhost:3000/v1/pools?chainId=84532
```

---

### Test Suite 6: Position Management

**Priority:** MEDIUM

**Test Cases:**
1. **View Positions**
   - Navigate to /positions
   - Verify user positions load
   - Verify position details show

2. **Add Liquidity**
   - Navigate to /add
   - Select token pair
   - Select fee tier
   - Set price range
   - Enter amounts
   - Preview position
   - Add liquidity

3. **Remove Liquidity**
   - Open position
   - Click "Remove Liquidity"
   - Select amount to remove
   - Confirm transaction
   - Verify liquidity removed

**Expected Results:**
- ✓ Positions load correctly
- ✓ Can add liquidity
- ✓ Can remove liquidity
- ✓ Position updates in real-time

---

## 🔧 Test Setup Requirements

### Prerequisites

**Software:**
- Node.js 18+
- Playwright installed
- MetaMask extension (or test wallet)

**Blockchain:**
- Base Sepolia ETH in wallet
- Test tokens (ETH, USDC, etc.)
- At least 1 pool with liquidity

**Services Running:**
- ✓ Backend API (localhost:3000)
- ✓ Router API (localhost:3001 or 3002)
- ✓ Frontend (localhost:3001)
- ✓ PostgreSQL database
- ✓ Redis cache

### Environment Variables

**Frontend (.env.local):**
```bash
NEXT_PUBLIC_DEFAULT_CHAIN_ID=84532
NEXT_PUBLIC_API_URL=http://localhost:3000/v1
NEXT_PUBLIC_POOL_MANAGER=0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05
NEXT_PUBLIC_SWAP_ROUTER=0xFf438e2d528F55fD1141382D1eB436201552d1A5
NEXT_PUBLIC_QUOTER=0x3e3D0d2cC349F42825B5cF58fd34d3bDFE25404b
NEXT_PUBLIC_POSITION_MANAGER=0xCf31fbdBD7A44ba1bCF99642E64a1d0B56a372bA
```

**Backend (.env):**
```bash
PORT=3000
RPC_URL_BASE_SEPOLIA=https://sepolia.base.org
POOL_MANAGER_ADDRESS_84532=0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05
# ... (other addresses)
```

---

## 🚀 Running E2E Tests

### Manual Test Execution

```bash
# 1. Start services
cd backend && npm run dev &
cd router/routing-engine && cargo run &
cd frontend && npm run dev &

# 2. Wait for services to be ready (30 seconds)

# 3. Run E2E tests
cd frontend
npm run test:e2e

# 4. View results
# Playwright will open browser and run tests
# Results shown in terminal
```

### Automated Test Execution

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test tests/e2e/swap.spec.ts

# Run in headed mode (see browser)
npx playwright test --headed

# Debug mode
npx playwright test --debug
```

---

## ✅ Test Success Criteria

### Pass Criteria

**Individual Test:**
- All assertions pass
- No unhandled errors
- No console errors (critical)
- Response times acceptable (<5s)

**Test Suite:**
- 90%+ tests passing
- Critical paths 100% passing
- No blockers identified

**System:**
- All services responding
- Blockchain transactions succeed
- UI/UX smooth and responsive

### Failure Criteria

**Individual Test:**
- Assertion failure
- Timeout (>30s)
- Unhandled exception
- Service unavailable

**Test Suite:**
- <70% pass rate
- Any critical test fails
- Services not responding

---

## 📊 Test Report Format

### After Test Execution

Generate report with:
- ✓ Total tests run
- ✓ Pass/Fail count
- ✓ Test duration
- ✓ Failed test details
- ✓ Screenshots of failures
- ✓ Network logs
- ✓ Console errors

**Report Location:**
```
frontend/test-results/
  ├── index.html       (Summary)
  ├── screenshots/     (Failures)
  └── traces/          (Debug traces)
```

---

## 🐛 Known Issues & Workarounds

### Issue 1: Chain ID Mismatch
**Problem:** Frontend .env has 8453 (mainnet) but should be 84532 (Sepolia)
**Workaround:** Update NEXT_PUBLIC_DEFAULT_CHAIN_ID=84532

### Issue 2: Missing ABIs
**Problem:** Frontend missing contract ABIs
**Workaround:** Copy from contracts/out/

### Issue 3: Port Conflicts
**Problem:** Router and Frontend both use 3001
**Workaround:** Change router port or frontend port

---

## 📞 Support & Troubleshooting

### Test Failures

**"Wallet not connected"**
- Ensure MetaMask unlocked
- Check network is Base Sepolia
- Verify wallet has ETH

**"Quote timeout"**
- Check backend running
- Check router running
- Check RPC connection

**"Transaction failed"**
- Check wallet has enough ETH for gas
- Check contract addresses correct
- Check Base Sepolia network

### Service Health Checks

```bash
# Backend
curl http://localhost:3000/health

# Router
curl http://localhost:3001/health

# Frontend
curl http://localhost:3001
```

---

**Test Plan Status:** ✅ READY
**Next Step:** Await services startup, then execute E2E tests
**Estimated Test Duration:** 10-15 minutes (full suite)
