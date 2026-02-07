# BaseBook DEX - Bug Bash Checklist

Manual testing checklist for comprehensive bug discovery before launch.

## 📋 How to Use This Checklist

1. **Assign sections** to different team members
2. **Test on multiple browsers**: Chrome, Firefox, Safari, Edge
3. **Test on multiple devices**: Desktop, Mobile (iOS/Android), Tablet
4. **Document all bugs** using the bug template at the bottom
5. **Mark items** as ✅ Pass, ❌ Fail, or ⚠️ Issue Found
6. **Retest** fixed bugs before marking as resolved

## 🎯 Testing Environment

- **URL:** https://staging.basebook.xyz (or localhost:3000)
- **Network:** Base Sepolia (Testnet)
- **Wallet:** Test wallet with test funds
- **Date:** ___________
- **Tester:** ___________
- **Browser:** ___________
- **Device:** ___________

---

## 1. WALLET CONNECTION

### 1.1 Initial Connection
- [ ] Click "Connect Wallet" button
- [ ] Wallet selector modal appears
- [ ] All supported wallets shown (MetaMask, Coinbase, WalletConnect, Rainbow)
- [ ] Can select MetaMask
- [ ] MetaMask prompt appears
- [ ] Can approve connection
- [ ] Wallet address displayed correctly
- [ ] Balance displayed correctly
- [ ] Network badge shows "Base" (or current network)

**Status:** _____ | **Notes:** _____________________

### 1.2 Wrong Network
- [ ] Connect on Ethereum Mainnet
- [ ] Warning message appears
- [ ] "Switch Network" button shown
- [ ] Click "Switch Network"
- [ ] MetaMask prompt to switch
- [ ] After switch, warning disappears
- [ ] App functions normally

**Status:** _____ | **Notes:** _____________________

### 1.3 Disconnection
- [ ] Click wallet menu/avatar
- [ ] Dropdown menu appears
- [ ] "Disconnect" option visible
- [ ] Click "Disconnect"
- [ ] Wallet disconnected
- [ ] "Connect Wallet" button shown again
- [ ] Can reconnect successfully

**Status:** _____ | **Notes:** _____________________

### 1.4 Account Switch
- [ ] Switch account in MetaMask
- [ ] App detects account change
- [ ] New address displayed
- [ ] New balance displayed
- [ ] Positions update (if applicable)

**Status:** _____ | **Notes:** _____________________

### 1.5 Network Switch
- [ ] Switch network in MetaMask
- [ ] App detects network change
- [ ] Network badge updates
- [ ] Token list updates
- [ ] Pools update

**Status:** _____ | **Notes:** _____________________

### 1.6 Connection Persistence
- [ ] Connect wallet
- [ ] Reload page
- [ ] Wallet still connected
- [ ] Address still shown
- [ ] Balance still shown

**Status:** _____ | **Notes:** _____________________

---

## 2. SWAP FUNCTIONALITY

### 2.1 Basic Swap UI
- [ ] Navigate to /swap
- [ ] Swap widget displayed
- [ ] Token input fields visible
- [ ] Token selector buttons visible
- [ ] Settings icon visible
- [ ] Swap button visible
- [ ] Default tokens shown (ETH/USDC)

**Status:** _____ | **Notes:** _____________________

### 2.2 Token Selection
- [ ] Click "Select Token" button
- [ ] Token modal opens
- [ ] Token list loads
- [ ] Can see token logos
- [ ] Can see token symbols
- [ ] Can see token names
- [ ] Can see token balances
- [ ] Can search tokens
- [ ] Search works correctly
- [ ] Can select token
- [ ] Modal closes
- [ ] Token appears in swap widget

**Status:** _____ | **Notes:** _____________________

### 2.3 Amount Input
- [ ] Enter amount: 1
- [ ] Amount accepted
- [ ] Can use decimals: 0.1
- [ ] Can paste amount
- [ ] Cannot enter negative
- [ ] Cannot enter letters
- [ ] "MAX" button available
- [ ] Click "MAX"
- [ ] Max balance filled (minus gas)
- [ ] Can clear and re-enter

**Status:** _____ | **Notes:** _____________________

### 2.4 Quote Fetching
- [ ] Enter amount: 1 ETH
- [ ] Loading indicator appears
- [ ] Quote arrives within 2 seconds
- [ ] Output amount displayed
- [ ] Execution price displayed
- [ ] Price impact displayed
- [ ] Route displayed
- [ ] Gas estimate displayed
- [ ] Quote auto-refreshes (wait 15s)
- [ ] New quote received

**Status:** _____ | **Notes:** _____________________

### 2.5 Swap Details
- [ ] Expand swap details (if collapsed)
- [ ] See "Execution Price"
- [ ] See "Price Impact"
- [ ] See "Minimum Received"
- [ ] See "Route" (e.g., ETH → USDC)
- [ ] See "Gas Estimate"
- [ ] See "Fee Breakdown"
- [ ] All values reasonable

**Status:** _____ | **Notes:** _____________________

### 2.6 Settings
- [ ] Click settings icon
- [ ] Settings modal opens
- [ ] Slippage tolerance shown (default 0.5%)
- [ ] Can change slippage to 1%
- [ ] Can change slippage to 0.1%
- [ ] Invalid slippage rejected (e.g., 100%)
- [ ] Deadline shown (default 20 min)
- [ ] Can change deadline
- [ ] Expert mode toggle visible
- [ ] Close modal
- [ ] Settings persisted

**Status:** _____ | **Notes:** _____________________

### 2.7 Token Approval
- [ ] Select USDC as input token
- [ ] Enter amount
- [ ] "Approve USDC" button shown
- [ ] Click "Approve"
- [ ] MetaMask prompt appears
- [ ] Approve transaction
- [ ] Wait for confirmation
- [ ] "Approved" indicator shown
- [ ] "Swap" button now enabled

**Status:** _____ | **Notes:** _____________________

### 2.8 Swap Execution
- [ ] Enter 0.1 ETH → USDC
- [ ] Wait for quote
- [ ] Verify quote reasonable
- [ ] Click "Swap"
- [ ] Confirmation modal appears
- [ ] Review details in modal
- [ ] Click "Confirm Swap"
- [ ] MetaMask prompt appears
- [ ] Confirm transaction
- [ ] "Pending" indicator shown
- [ ] Wait for confirmation (check block explorer)
- [ ] "Success" message shown
- [ ] Balance updated
- [ ] Transaction in history

**Status:** _____ | **Notes:** _____________________

### 2.9 Multi-Hop Swap
- [ ] Select DAI → WBTC (no direct pool)
- [ ] Enter amount
- [ ] Quote received
- [ ] Route shows multiple hops
- [ ] Route displays correctly (DAI → X → Y → WBTC)
- [ ] Price impact shown
- [ ] Can execute swap

**Status:** _____ | **Notes:** _____________________

### 2.10 Switch Tokens
- [ ] Select ETH → USDC
- [ ] Enter 1 ETH
- [ ] Quote shown: ~2450 USDC
- [ ] Click switch tokens button
- [ ] Tokens switched
- [ ] Now shows USDC → ETH
- [ ] Quote updated correctly

**Status:** _____ | **Notes:** _____________________

### 2.11 Error Handling
- [ ] Enter huge amount (999999 ETH)
- [ ] "Insufficient Balance" error shown
- [ ] Swap button disabled
- [ ] Enter amount > liquidity
- [ ] "Insufficient Liquidity" error shown
- [ ] Disconnect network
- [ ] "Network Error" shown
- [ ] Reconnect
- [ ] Error clears

**Status:** _____ | **Notes:** _____________________

---

## 3. POOLS & LIQUIDITY

### 3.1 Pool List
- [ ] Navigate to /pools
- [ ] Pool table displayed
- [ ] Multiple pools shown
- [ ] Each pool shows: Token pair, TVL, Volume, APR, Fee tier
- [ ] Can scroll through list
- [ ] Pool logos displayed
- [ ] Pool stats formatted correctly

**Status:** _____ | **Notes:** _____________________

### 3.2 Pool Search
- [ ] Search for "ETH"
- [ ] Results update
- [ ] Only ETH pools shown
- [ ] Search for "USDC"
- [ ] Results update
- [ ] Clear search
- [ ] All pools shown again

**Status:** _____ | **Notes:** _____________________

### 3.3 Pool Sorting
- [ ] Click "TVL" column header
- [ ] Pools sorted by TVL (descending)
- [ ] Top pools have highest TVL
- [ ] Click "Volume" column header
- [ ] Pools sorted by volume
- [ ] Click "APR" column header
- [ ] Pools sorted by APR

**Status:** _____ | **Notes:** _____________________

### 3.4 Pool Filtering
- [ ] Click fee tier filter
- [ ] Select "0.3%"
- [ ] Only 0.3% pools shown
- [ ] Select "0.05%"
- [ ] Only 0.05% pools shown
- [ ] Clear filter
- [ ] All pools shown

**Status:** _____ | **Notes:** _____________________

### 3.5 Pool Detail
- [ ] Click on ETH/USDC pool
- [ ] Navigate to pool detail page
- [ ] Pool header shown (ETH/USDC, 0.3%)
- [ ] Pool stats shown (TVL, Volume, Fees, APR)
- [ ] Price chart displayed
- [ ] Chart loads with data
- [ ] Can change time range (24h, 7d, 30d)
- [ ] Chart updates
- [ ] Liquidity distribution chart shown
- [ ] Transaction list shown
- [ ] Recent transactions displayed

**Status:** _____ | **Notes:** _____________________

### 3.6 Add Liquidity - Basic
- [ ] From pool detail, click "Add Liquidity"
- [ ] Navigate to add liquidity page
- [ ] Tokens pre-selected
- [ ] Fee tier pre-selected
- [ ] Amount inputs visible
- [ ] Price range selector visible
- [ ] Preset buttons visible (Narrow, Medium, Wide, Full)

**Status:** _____ | **Notes:** _____________________

### 3.7 Add Liquidity - Full Range
- [ ] Select ETH and USDC
- [ ] Select 0.3% fee tier
- [ ] Click "Full Range"
- [ ] Min price shows 0
- [ ] Max price shows ∞
- [ ] Enter 0.1 ETH
- [ ] USDC amount calculated automatically
- [ ] Position preview shown
- [ ] Estimated APR shown
- [ ] Share of pool shown

**Status:** _____ | **Notes:** _____________________

### 3.8 Add Liquidity - Preset Range
- [ ] Select ETH and USDC
- [ ] Click "Narrow" preset
- [ ] Price range set (e.g., ±10%)
- [ ] Click "Medium" preset
- [ ] Price range updated
- [ ] Click "Wide" preset
- [ ] Price range updated

**Status:** _____ | **Notes:** _____________________

### 3.9 Add Liquidity - Custom Range
- [ ] Select ETH and USDC
- [ ] Enter min price: 2000
- [ ] Enter max price: 3000
- [ ] Range displayed on chart
- [ ] Current price indicated
- [ ] In range / out of range shown
- [ ] Enter invalid range (min > max)
- [ ] Error shown
- [ ] Cannot proceed

**Status:** _____ | **Notes:** _____________________

### 3.10 Add Liquidity - Approval & Execution
- [ ] Enter 0.1 ETH
- [ ] "Approve ETH" button (if needed)
- [ ] "Approve USDC" button (if needed)
- [ ] Click "Approve ETH"
- [ ] Confirm in MetaMask
- [ ] Wait for approval
- [ ] "Approved" indicator
- [ ] Repeat for USDC
- [ ] "Add Liquidity" button enabled
- [ ] Click "Add Liquidity"
- [ ] Confirmation modal shown
- [ ] Review position details
- [ ] Click "Confirm"
- [ ] MetaMask prompt
- [ ] Confirm transaction
- [ ] Wait for confirmation
- [ ] Success message
- [ ] "View Position" button

**Status:** _____ | **Notes:** _____________________

### 3.11 Position View
- [ ] Click "View Position" (from add liquidity success)
- [ ] Navigate to position detail page
- [ ] Position ID shown
- [ ] Token pair shown
- [ ] Price range shown
- [ ] Current price shown
- [ ] In range / out of range status
- [ ] Liquidity value shown
- [ ] Unclaimed fees shown
- [ ] Position value shown
- [ ] PnL shown
- [ ] Chart shown

**Status:** _____ | **Notes:** _____________________

### 3.12 Remove Liquidity
- [ ] From position detail, click "Remove Liquidity"
- [ ] Navigate to remove page
- [ ] Percentage slider visible
- [ ] Percentage buttons visible (25%, 50%, 75%, 100%)
- [ ] Click "50%"
- [ ] Amounts to receive shown
- [ ] "Collect Fees" checkbox visible
- [ ] Check "Collect Fees"
- [ ] Click "Remove Liquidity"
- [ ] Confirmation modal
- [ ] Review amounts
- [ ] Confirm
- [ ] MetaMask prompt
- [ ] Confirm transaction
- [ ] Wait for confirmation
- [ ] Success message
- [ ] Tokens received
- [ ] Position updated

**Status:** _____ | **Notes:** _____________________

### 3.13 Collect Fees
- [ ] Navigate to position with unclaimed fees
- [ ] "Collect Fees" button visible
- [ ] Unclaimed fees amount shown
- [ ] Click "Collect Fees"
- [ ] Confirmation modal
- [ ] Review fee amounts
- [ ] Confirm
- [ ] MetaMask prompt
- [ ] Confirm transaction
- [ ] Wait for confirmation
- [ ] Success message
- [ ] Fees received
- [ ] Unclaimed fees reset to 0

**Status:** _____ | **Notes:** _____________________

---

## 4. PORTFOLIO

### 4.1 Portfolio Overview
- [ ] Navigate to /portfolio
- [ ] Portfolio stats displayed
- [ ] Total value shown
- [ ] Total PnL shown
- [ ] Fees earned shown
- [ ] Charts displayed
- [ ] Position list shown

**Status:** _____ | **Notes:** _____________________

### 4.2 Position List
- [ ] All positions displayed
- [ ] Each shows: Token pair, Range, Value, Status
- [ ] "Open" positions tab
- [ ] Shows only open positions
- [ ] "Closed" positions tab
- [ ] Shows only closed positions
- [ ] Can click on position
- [ ] Navigate to position detail

**Status:** _____ | **Notes:** _____________________

### 4.3 Transaction History
- [ ] Switch to "History" tab
- [ ] Swap history shown
- [ ] Each swap shows: Tokens, Amounts, Time, Status
- [ ] Can filter by type (Swap, Add, Remove)
- [ ] Can click on transaction
- [ ] Opens block explorer
- [ ] Transaction found

**Status:** _____ | **Notes:** _____________________

### 4.4 PnL Calculation
- [ ] View position with PnL data
- [ ] Fees earned shown
- [ ] Impermanent loss shown
- [ ] Net PnL calculated correctly
- [ ] Percentage shown
- [ ] Color coding (green/red)

**Status:** _____ | **Notes:** _____________________

---

## 5. ANALYTICS

### 5.1 Overview Stats
- [ ] Navigate to /analytics
- [ ] Protocol TVL shown
- [ ] 24h Volume shown
- [ ] 24h Fees shown
- [ ] 24h Transactions shown
- [ ] Stats formatted correctly (K, M, B)

**Status:** _____ | **Notes:** _____________________

### 5.2 Charts
- [ ] Volume chart displayed
- [ ] TVL chart displayed
- [ ] Can switch time range (24h, 7d, 30d, 1y)
- [ ] Charts update
- [ ] Can hover over chart
- [ ] Tooltip shows data
- [ ] Charts responsive (resize window)

**Status:** _____ | **Notes:** _____________________

### 5.3 Top Pools
- [ ] Top pools table shown
- [ ] Sorted by TVL
- [ ] Shows: Pool, TVL, Volume, APR
- [ ] Can click on pool
- [ ] Navigate to pool detail

**Status:** _____ | **Notes:** _____________________

### 5.4 Trending Tokens
- [ ] Trending tokens shown
- [ ] Shows: Token, Price, Change %
- [ ] Color coded (green/red)
- [ ] Can click on token
- [ ] Navigate to token page (if exists)

**Status:** _____ | **Notes:** _____________________

---

## 6. MOBILE EXPERIENCE

**Test on mobile device (iOS/Android)**

### 6.1 Mobile Navigation
- [ ] Open on mobile browser
- [ ] Page loads correctly
- [ ] Mobile menu button visible (hamburger)
- [ ] Click menu button
- [ ] Menu slides out
- [ ] All nav links visible
- [ ] Can navigate to Swap
- [ ] Can navigate to Pools
- [ ] Can navigate to Portfolio

**Status:** _____ | **Notes:** _____________________

### 6.2 Mobile Swap
- [ ] Swap widget fits screen
- [ ] Token selectors tappable
- [ ] Amount input works
- [ ] Keyboard doesn't break layout
- [ ] Can scroll if needed
- [ ] All buttons tappable (minimum 44x44px)
- [ ] Modal overlays work
- [ ] Can complete swap

**Status:** _____ | **Notes:** _____________________

### 6.3 Mobile Wallet Connection
- [ ] Click "Connect Wallet"
- [ ] Wallet selector works
- [ ] Can select WalletConnect
- [ ] QR code shown OR deep link
- [ ] Can scan QR with wallet app
- [ ] Connection successful
- [ ] Address shown
- [ ] Balance shown

**Status:** _____ | **Notes:** _____________________

### 6.4 Mobile Liquidity
- [ ] Navigate to add liquidity
- [ ] Form fits screen
- [ ] Can select tokens
- [ ] Can enter amounts
- [ ] Price range selector works
- [ ] Can add liquidity
- [ ] Modal confirmations work

**Status:** _____ | **Notes:** _____________________

### 6.5 Mobile Orientation
- [ ] Test in portrait mode
- [ ] All features work
- [ ] Rotate to landscape
- [ ] Layout adapts
- [ ] All features still work

**Status:** _____ | **Notes:** _____________________

---

## 7. CROSS-BROWSER TESTING

### 7.1 Chrome
- [ ] All features work
- [ ] No console errors
- [ ] Performance good

**Status:** _____ | **Notes:** _____________________

### 7.2 Firefox
- [ ] All features work
- [ ] No console errors
- [ ] Wallet connection works

**Status:** _____ | **Notes:** _____________________

### 7.3 Safari
- [ ] All features work
- [ ] No console errors
- [ ] Wallet connection works

**Status:** _____ | **Notes:** _____________________

### 7.4 Edge
- [ ] All features work
- [ ] No console errors
- [ ] Wallet connection works

**Status:** _____ | **Notes:** _____________________

---

## 8. PERFORMANCE

### 8.1 Page Load Speed
- [ ] Homepage loads < 3s
- [ ] Swap page loads < 3s
- [ ] Pools page loads < 3s
- [ ] No blank screens during load
- [ ] Loading indicators shown

**Status:** _____ | **Notes:** _____________________

### 8.2 Interaction Speed
- [ ] Quote fetching < 2s
- [ ] Token search instant
- [ ] Pool search instant
- [ ] Chart rendering < 1s
- [ ] Smooth animations
- [ ] No lag during typing

**Status:** _____ | **Notes:** _____________________

### 8.3 Memory Usage
- [ ] Open DevTools → Performance
- [ ] Monitor memory usage
- [ ] Navigate between pages
- [ ] Memory doesn't continuously grow
- [ ] No memory leaks detected

**Status:** _____ | **Notes:** _____________________

---

## 9. ACCESSIBILITY

### 9.1 Keyboard Navigation
- [ ] Can Tab through all interactive elements
- [ ] Focus indicators visible
- [ ] Can open modals with keyboard
- [ ] Can close modals with Esc
- [ ] Can submit forms with Enter
- [ ] No keyboard traps

**Status:** _____ | **Notes:** _____________________

### 9.2 Screen Reader
- [ ] Enable screen reader (VoiceOver/NVDA)
- [ ] Navigate through page
- [ ] All content announced
- [ ] Buttons have labels
- [ ] Form inputs have labels
- [ ] Images have alt text
- [ ] ARIA labels present

**Status:** _____ | **Notes:** _____________________

### 9.3 Color Contrast
- [ ] Text readable on background
- [ ] Buttons have sufficient contrast
- [ ] Links distinguishable
- [ ] Error messages readable
- [ ] Chart text readable

**Status:** _____ | **Notes:** _____________________

---

## 10. SECURITY

### 10.1 Input Validation
- [ ] Cannot inject HTML
- [ ] Cannot inject JavaScript
- [ ] SQL injection not possible (API)
- [ ] XSS attacks blocked
- [ ] Amount inputs sanitized

**Status:** _____ | **Notes:** _____________________

### 10.2 Transaction Security
- [ ] Slippage protection works
- [ ] Deadline enforced
- [ ] Cannot approve infinite amounts (unless intended)
- [ ] Transaction details accurate
- [ ] No hidden approvals

**Status:** _____ | **Notes:** _____________________

### 10.3 Connection Security
- [ ] HTTPS enforced
- [ ] Wallet connection secure
- [ ] No private keys exposed
- [ ] Signature requests clear
- [ ] No suspicious permissions requested

**Status:** _____ | **Notes:** _____________________

---

## 🐛 BUG TEMPLATE

When you find a bug, document it using this template:

```markdown
## BUG-XXX: [Short Title]

**Severity:** Critical / High / Medium / Low
**Priority:** P0 / P1 / P2 / P3
**Status:** Open / In Progress / Fixed / Won't Fix

**Environment:**
- URL:
- Browser:
- OS:
- Device:

**Steps to Reproduce:**
1.
2.
3.

**Expected Behavior:**


**Actual Behavior:**


**Screenshots/Video:**
[Attach here]

**Console Errors:**
```
[Paste console errors]
```

**Additional Notes:**


**Found By:** [Name]
**Date:** [Date]
```

---

## 📊 Bug Bash Summary

**Total Test Cases:** 150+
**Test Cases Passed:** _____
**Test Cases Failed:** _____
**Bugs Found:** _____
**Critical Bugs:** _____
**High Priority Bugs:** _____

**Overall Assessment:** ___________________________

**Ready for Launch:** Yes / No / With Fixes

**Sign-off:**
- QA Engineer: _____________ Date: _______
- CTO: _____________ Date: _______
- Product Owner: _____________ Date: _______

---

**Bug Bash Completed:** [Date]
**Next Steps:** ________________________________
