# BaseBook DEX - Critical User Paths

Critical paths that MUST work flawlessly for the DEX to be functional.

## 🎯 Critical Path Priority Matrix

### P0 (Blocker - Must Work)
- Wallet connection
- Token swap (single hop)
- Token approval
- View pool list
- View token balances

### P1 (Critical - Core Features)
- Multi-hop swaps
- Add liquidity
- Remove liquidity
- View positions
- Collect fees

### P2 (Important - Enhanced Features)
- View analytics
- Price charts
- Transaction history
- Search functionality
- Slippage settings

## 📊 Critical Path Scenarios

### CP-001: First Time User - Complete Swap Journey

**Priority:** P0 - Blocker

**User Story:** As a first-time user, I want to swap ETH for USDC

**Prerequisites:**
- User has MetaMask installed
- User has ETH on Base chain
- User has never used the DEX before

**Steps:**
1. Navigate to baseBook.xyz
2. Connect wallet (MetaMask)
3. Approve Base chain connection
4. Navigate to Swap page (should be default)
5. Select ETH as input token (should be default)
6. Select USDC as output token
7. Enter amount: 0.1 ETH
8. Review quote and price impact
9. Click "Swap" button
10. Review swap confirmation modal
11. Confirm swap in MetaMask
12. Wait for transaction confirmation
13. See success message
14. Verify new USDC balance

**Expected Results:**
- ✅ Wallet connects successfully
- ✅ Token selector shows all verified tokens
- ✅ Quote appears within 2 seconds
- ✅ Price impact shown and reasonable (<1%)
- ✅ Gas estimate shown
- ✅ Transaction succeeds
- ✅ Balance updates correctly
- ✅ Transaction appears in recent history

**Edge Cases:**
- Insufficient ETH for gas
- Network congestion
- RPC provider failure
- Quote expires during approval
- Price slippage exceeds tolerance

---

### CP-002: Power User - Multi-Hop Swap with Slippage

**Priority:** P1 - Critical

**User Story:** As a power user, I want to swap DAI to WBTC with custom slippage

**Prerequisites:**
- User has connected wallet
- User has DAI balance
- No WBTC/DAI pool exists (requires multi-hop)

**Steps:**
1. Select DAI as input token
2. Select WBTC as output token
3. Enter amount: 1000 DAI
4. Click settings icon
5. Change slippage to 1.5%
6. Close settings
7. Review route (should show: DAI → USDC → WETH → WBTC)
8. Review price impact (may be higher)
9. Click "Swap"
10. Confirm transaction
11. Wait for confirmation

**Expected Results:**
- ✅ Router finds optimal multi-hop route
- ✅ Route displayed clearly with intermediary tokens
- ✅ Price impact calculated correctly
- ✅ Custom slippage applied
- ✅ Swap executes through all hops
- ✅ Correct amount received (within slippage)

**Edge Cases:**
- One hop in route has insufficient liquidity
- Better route becomes available mid-transaction
- MEV attack (sandwich)

---

### CP-003: Liquidity Provider - Add Full Range Position

**Priority:** P1 - Critical

**User Story:** As an LP, I want to provide ETH/USDC liquidity in full range

**Prerequisites:**
- User has ETH and USDC
- User has never provided liquidity before

**Steps:**
1. Navigate to Pools page
2. Search for "ETH/USDC"
3. Click on ETH/USDC 0.3% pool
4. Click "Add Liquidity"
5. Select ETH and USDC
6. Select 0.3% fee tier
7. Click "Full Range"
8. Enter amount: 1 ETH
9. Review calculated USDC amount (should be ~$2,450)
10. Review position preview (liquidity, APR)
11. Approve ETH (if needed)
12. Approve USDC
13. Click "Add Liquidity"
14. Confirm transaction
15. Wait for confirmation
16. Navigate to Portfolio
17. Verify position appears

**Expected Results:**
- ✅ Pool found successfully
- ✅ Token amounts calculated correctly
- ✅ Position preview shows reasonable APR
- ✅ Both token approvals succeed
- ✅ Position minted successfully
- ✅ NFT received
- ✅ Position shows in portfolio
- ✅ Liquidity value displayed correctly

**Edge Cases:**
- Pool doesn't exist (needs creation)
- Insufficient balance for both tokens
- Price changes during approval
- Transaction reverts

---

### CP-004: Liquidity Provider - Remove Partial Liquidity

**Priority:** P1 - Critical

**User Story:** As an LP, I want to remove 50% of my liquidity and collect fees

**Prerequisites:**
- User has active position
- Position has accrued fees

**Steps:**
1. Navigate to Portfolio
2. Click on position
3. Verify position details (value, fees, PnL)
4. Click "Remove Liquidity"
5. Select 50% using slider
6. Check "Collect Fees" checkbox
7. Review amounts to receive
8. Click "Remove Liquidity"
9. Confirm transaction
10. Wait for confirmation
11. Verify received tokens
12. Verify position still exists with 50% liquidity
13. Verify fees were collected

**Expected Results:**
- ✅ Position details accurate
- ✅ Slider calculates amounts correctly
- ✅ Fee collection works
- ✅ Transaction succeeds
- ✅ Tokens received correctly
- ✅ Position updated (not closed)
- ✅ Portfolio value updated

**Edge Cases:**
- Position out of range
- Very small amounts (dust)
- 100% removal
- Uncollected fees

---

### CP-005: Wallet Connection - All Providers

**Priority:** P0 - Blocker

**User Story:** As a user, I can connect with different wallet providers

**Prerequisites:**
- User has wallet extension installed

**Test Matrix:**

| Wallet       | Connect | Disconnect | Switch Network | Switch Account |
|--------------|---------|------------|----------------|----------------|
| MetaMask     | ✅      | ✅         | ✅             | ✅             |
| Coinbase     | ✅      | ✅         | ✅             | ✅             |
| WalletConnect| ✅      | ✅         | ✅             | ✅             |
| Rainbow      | ✅      | ✅         | ✅             | ✅             |

**Expected Results:**
- ✅ All wallets connect successfully
- ✅ Address displayed correctly
- ✅ Balance fetched correctly
- ✅ Can disconnect
- ✅ Network switch works
- ✅ Account switch detected

**Edge Cases:**
- User rejects connection
- Wallet locked
- Wrong network
- Multiple wallets installed

---

### CP-006: Token Approval - Permit2 Flow

**Priority:** P0 - Blocker

**User Story:** As a user, I want to approve tokens efficiently using Permit2

**Prerequisites:**
- User has tokens that support Permit2
- First time using the token

**Steps:**
1. Select token requiring approval
2. Enter swap amount
3. Click "Approve"
4. Sign Permit2 signature (no gas)
5. Wait for approval
6. Verify "Swap" button enabled
7. Execute swap

**Expected Results:**
- ✅ Permit2 detected for supported tokens
- ✅ Signature request shown (no gas)
- ✅ Approval instant
- ✅ Swap enabled immediately
- ✅ No second approval needed

**Fallback:**
- If Permit2 not supported → Standard ERC20 approval
- If user rejects signature → Show error

---

### CP-007: Error Handling - Network Failures

**Priority:** P0 - Blocker

**User Story:** As a user, I want clear errors when network issues occur

**Test Scenarios:**

1. **RPC Provider Down**
   - Simulate: Disconnect network
   - Expected: "Network error. Please try again."
   - Recovery: Auto-retry with fallback RPC

2. **Transaction Failed**
   - Simulate: Insufficient gas
   - Expected: "Transaction failed: Insufficient gas"
   - Recovery: Suggest gas increase

3. **Quote Fetch Failed**
   - Simulate: API timeout
   - Expected: "Failed to fetch quote. Retrying..."
   - Recovery: Auto-retry 3 times

4. **Slippage Exceeded**
   - Simulate: Large price movement
   - Expected: "Price moved beyond slippage tolerance"
   - Recovery: Prompt to retry or increase slippage

**Expected Results:**
- ✅ All errors shown clearly
- ✅ User not stuck
- ✅ Clear recovery actions
- ✅ No cryptic error messages

---

### CP-008: Mobile Experience - Complete Flow

**Priority:** P1 - Critical

**User Story:** As a mobile user, I want to swap on my phone

**Prerequisites:**
- User on mobile device (iOS or Android)
- User has mobile wallet app

**Steps:**
1. Open baseBook.xyz on mobile browser
2. Connect using WalletConnect
3. Approve in mobile wallet app
4. Navigate swap interface
5. Select tokens (touch targets)
6. Enter amount using mobile keyboard
7. Review swap details
8. Execute swap
9. Approve in wallet app
10. View transaction status

**Expected Results:**
- ✅ UI responsive and usable
- ✅ Touch targets large enough (44x44px min)
- ✅ Keyboard doesn't break layout
- ✅ WalletConnect works smoothly
- ✅ All modals work on mobile
- ✅ Transaction succeeds

**Edge Cases:**
- App switch during transaction
- Mobile network issues
- Small screen sizes
- Landscape orientation

---

### CP-009: Pool Discovery - Search & Filter

**Priority:** P2 - Important

**User Story:** As a trader, I want to find the best pool for my trade

**Prerequisites:**
- Multiple pools exist for same pair
- Pools have different fee tiers

**Steps:**
1. Navigate to Pools page
2. Search for "ETH"
3. Verify ETH pools shown
4. Sort by TVL (descending)
5. Verify order is correct
6. Filter by 0.3% fee tier
7. Verify only 0.3% pools shown
8. Click on top pool
9. Review pool stats and charts
10. Verify data is accurate

**Expected Results:**
- ✅ Search works instantly
- ✅ Results relevant
- ✅ Sorting accurate
- ✅ Filters work
- ✅ Pool details load quickly
- ✅ Charts render correctly

---

### CP-010: Analytics Dashboard

**Priority:** P2 - Important

**User Story:** As an analyst, I want to view protocol metrics

**Prerequisites:**
- Protocol has historical data

**Steps:**
1. Navigate to Analytics page
2. View overview stats (TVL, Volume, Fees)
3. Switch time range (24h, 7d, 30d)
4. View volume chart
5. View TVL chart
6. View top pools table
7. View trending tokens

**Expected Results:**
- ✅ Stats load within 1 second
- ✅ Charts render correctly
- ✅ Time ranges work
- ✅ Data accurate
- ✅ Responsive design

---

## 🔄 Integration Test Scenarios

### INT-001: Complete User Journey

**Flow:** Connect → Swap → Add Liquidity → Remove Liquidity → Disconnect

1. Fresh user connects wallet
2. Swaps ETH for USDC
3. Adds ETH/USDC liquidity
4. Waits for fees to accrue
5. Removes 100% liquidity
6. Collects fees
7. Swaps USDC back to ETH
8. Disconnects wallet

**Expected:** All steps succeed without errors

---

### INT-002: Stress Test - Rapid Actions

**Flow:** Rapid successive actions

1. Connect wallet
2. Execute 10 swaps back-to-back
3. Add 5 positions simultaneously
4. Remove all positions
5. Check all balances correct

**Expected:** No race conditions, all transactions succeed

---

### INT-003: State Persistence

**Flow:** Test state persistence across reloads

1. Connect wallet
2. Set slippage to 1.5%
3. Select ETH/USDC
4. Reload page
5. Verify slippage still 1.5%
6. Verify tokens still selected
7. Execute swap
8. Reload page
9. Verify transaction in history

**Expected:** Settings and selections persist

---

## 🐛 Known Edge Cases to Test

### Edge-001: Dust Amounts
- Swap 0.000001 ETH
- Expected: Quote returned or "Amount too small" error

### Edge-002: Max Balance
- Click "MAX" button
- Verify leaves enough for gas
- Swap succeeds

### Edge-003: Token with High Decimals
- Swap token with 18 decimals
- Enter 1.123456789012345678
- Verify precision maintained

### Edge-004: No Liquidity Path
- Attempt swap for obscure token pair
- Expected: "No route found" error
- Suggests adding liquidity

### Edge-005: Expired Quote
- Get quote
- Wait 30 seconds
- Execute swap
- Expected: Auto-refresh or warning

### Edge-006: Concurrent Position Updates
- User has position
- Collect fees in browser A
- Remove liquidity in browser B
- Expected: One succeeds, other gets fresh state

### Edge-007: Wrong Network
- Connect on Ethereum mainnet
- Expected: Prompt to switch to Base
- Auto-switch if possible

### Edge-008: Pool Creation
- Add liquidity to non-existent pool
- Expected: Pool created first, then liquidity added
- Or: "Pool doesn't exist" error

---

## ✅ Testing Checklist

### Functional Testing
- [ ] All P0 paths work end-to-end
- [ ] All P1 paths work with edge cases
- [ ] All P2 paths work
- [ ] Error messages are clear
- [ ] Loading states show correctly
- [ ] Success states show correctly

### Cross-Browser Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)
- [ ] Edge (latest)

### Performance Testing
- [ ] Swap quote < 2 seconds
- [ ] Page load < 3 seconds
- [ ] Chart render < 1 second
- [ ] API response < 500ms

### Security Testing
- [ ] No exposed private keys
- [ ] XSS protection
- [ ] CSRF protection
- [ ] Rate limiting works
- [ ] Input sanitization

### Accessibility Testing
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Color contrast sufficient
- [ ] Focus indicators visible

---

## 📊 Success Metrics

### Critical Path Success Rate
- **Target:** 100% for P0 paths
- **Minimum:** 99% for P1 paths
- **Acceptable:** 95% for P2 paths

### Performance Metrics
- Page load: < 3s (95th percentile)
- Quote fetch: < 2s (95th percentile)
- Transaction confirmation: < 30s (median)

### User Experience Metrics
- Wallet connection: < 10s
- Token approval: < 20s
- Swap execution: < 40s (total time)

---

**Document Version:** 1.0
**Last Updated:** 2024-02-03
**Review Frequency:** Before each release
