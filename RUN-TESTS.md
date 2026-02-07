# 🧪 Quick Test Execution Guide

Fast reference for running all tests in the BaseBook DEX test suite.

## 🚀 Quick Start

### Prerequisites
```bash
# Install dependencies
cd frontend && npm install
cd ../backend && npm install

# Install Playwright browsers (first time only)
cd frontend
npx playwright install
```

### Start Dev Server
```bash
# Terminal 1: Start frontend dev server
cd frontend
npm run dev

# Terminal 2: Start backend (if testing API locally)
cd backend
npm run dev
```

---

## 🎯 Test Commands

### Smoke Tests (< 2 minutes)
**Purpose:** Quick sanity check - run before commits

```bash
cd frontend
npm run test:e2e -- smoke.spec.ts
```

**What it tests:**
- Basic page loads
- Wallet connection
- Token list loading
- Quote fetching
- Pool list loading
- Critical UI elements

**Expected output:** 30+ tests pass

---

### Critical Path Tests (< 10 minutes)
**Purpose:** Test all critical user journeys

```bash
cd frontend
npm run test:e2e -- critical-paths.spec.ts
```

**What it tests:**
- Complete swap flow
- Multi-hop swaps
- Add liquidity flow
- Remove liquidity flow
- Wallet connection
- Error handling
- Mobile experience
- Pool discovery

**Expected output:** 50+ tests pass

---

### Full E2E Suite (< 30 minutes)
**Purpose:** Complete end-to-end testing

```bash
cd frontend
npm run test:e2e
```

**What it runs:**
- smoke.spec.ts (30+ tests)
- swap.spec.ts (20+ tests)
- pools.spec.ts (15+ tests)
- liquidity.spec.ts (25+ tests)
- critical-paths.spec.ts (50+ tests)

**Expected output:** 140+ tests pass

---

### API Integration Tests (< 5 minutes)
**Purpose:** Test backend API endpoints

```bash
cd backend
npm run test:integration
```

**What it tests:**
- All REST endpoints
- Error handling
- Rate limiting
- Input validation
- Response formats

**Expected output:** 26+ tests pass

---

### All Tests (< 35 minutes)
**Purpose:** Complete test suite

```bash
# Terminal 1: Frontend E2E
cd frontend
npm run test:e2e

# Terminal 2: Backend API
cd backend
npm run test:integration
```

**Expected output:** 166+ tests pass

---

## 🎭 Specific Test Runs

### Run Specific File
```bash
npm run test:e2e -- swap.spec.ts
npm run test:e2e -- pools.spec.ts
npm run test:e2e -- liquidity.spec.ts
```

### Run Specific Test
```bash
npm run test:e2e -- swap.spec.ts -g "should execute swap successfully"
```

### Run in Headed Mode (See Browser)
```bash
npm run test:e2e:headed
# or
npm run test:e2e -- --headed
```

### Run in Debug Mode (Step Through)
```bash
npm run test:e2e:debug
# or
npm run test:e2e -- --debug
```

### Run in Specific Browser
```bash
npm run test:e2e:chromium
npm run test:e2e:firefox
npm run test:e2e:webkit
npm run test:e2e:mobile
```

### Run with UI (Interactive)
```bash
npm run test:e2e:ui
# or
npm run test:e2e -- --ui
```

---

## 📊 View Reports

### HTML Report
```bash
# After tests complete
npm run test:e2e:report
# or
npx playwright show-report
```

Opens interactive HTML report in browser showing:
- Test results
- Screenshots on failure
- Videos on failure
- Traces for debugging

### Coverage Report (API Tests)
```bash
cd backend
npm run test:coverage
```

Opens coverage report showing:
- Line coverage
- Branch coverage
- Function coverage
- File coverage

---

## 🔍 Debugging Failed Tests

### 1. View Screenshot
```bash
# Screenshots saved to: test-results/
open test-results/<test-name>-<timestamp>.png
```

### 2. View Video
```bash
# Videos saved to: test-results/
open test-results/<test-name>-<timestamp>.webm
```

### 3. View Trace
```bash
# Download trace from test results
npx playwright show-trace test-results/<test-name>-<timestamp>/trace.zip
```

### 4. Debug in VS Code
1. Open test file
2. Set breakpoint
3. Click "Debug Test" above test name
4. Use VS Code debugger

---

## 🐛 Common Issues

### "Port 3000 already in use"
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
# Or use different port
PORT=3001 npm run dev
```

### "Playwright not found"
```bash
npm install -D @playwright/test
npx playwright install
```

### "Cannot find module"
```bash
rm -rf node_modules package-lock.json
npm install
```

### Tests timing out
```bash
# Increase timeout in playwright.config.ts
timeout: 120000 // 2 minutes
```

### Flaky tests
```bash
# Run with retries
npm run test:e2e -- --retries=3
```

---

## 🎯 Pre-Commit Checklist

Run these before committing code:

```bash
# 1. Smoke tests (2 min)
cd frontend
npm run test:e2e -- smoke.spec.ts

# 2. Linting
npm run lint

# 3. Type checking
npm run typecheck

# 4. Build check
npm run build
```

---

## 🚀 CI/CD Commands

### CI Mode (No UI)
```bash
CI=true npm run test:e2e
```

**Changes in CI:**
- Runs in headless mode
- 2 automatic retries
- Parallel execution off (1 worker)
- HTML report generated
- Screenshots/videos on failure

---

## 📊 Test Execution Checklist

Before deployment:

- [ ] Smoke tests pass
- [ ] Critical path tests pass
- [ ] Full E2E suite passes
- [ ] API integration tests pass
- [ ] No console errors
- [ ] Performance benchmarks met
- [ ] Mobile tests pass
- [ ] Cross-browser tests pass

---

## 🎓 Best Practices

### Local Development
1. Run smoke tests frequently
2. Run affected tests after changes
3. Run full suite before PR
4. Check reports for failures

### CI/CD
1. Smoke tests on every commit
2. Full suite on PR
3. Performance tests nightly
4. Load tests weekly

### Bug Fixes
1. Write failing test first
2. Fix the bug
3. Verify test passes
4. Run regression suite

---

## 📞 Getting Help

### Test Issues
1. Check test documentation: `frontend/tests/README.md`
2. View this guide: `RUN-TESTS.md`
3. Check Playwright docs: https://playwright.dev/

### Bug Reports
Use template in `BUG-BASH-CHECKLIST.md`

---

## 🎉 Quick Reference Card

```bash
# Smoke tests (2 min)
npm run test:e2e -- smoke.spec.ts

# Critical paths (10 min)
npm run test:e2e -- critical-paths.spec.ts

# Full suite (30 min)
npm run test:e2e

# API tests (5 min)
cd backend && npm run test:integration

# View report
npm run test:e2e:report

# Debug mode
npm run test:e2e:debug

# Headed mode
npm run test:e2e:headed
```

**Remember:** Start dev server before running E2E tests!

---

**Quick Start:** `npm run test:e2e -- smoke.spec.ts` ⚡
