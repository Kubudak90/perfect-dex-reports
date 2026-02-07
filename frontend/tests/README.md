# BaseBook DEX - E2E & Integration Test Suite

Comprehensive test suite for BaseBook DEX using Playwright for E2E tests and Vitest for API integration tests.

## 📁 Test Structure

```
tests/
├── e2e/                      # End-to-end tests
│   ├── swap.spec.ts          # Swap functionality tests
│   ├── pools.spec.ts         # Pool browsing and detail tests
│   └── liquidity.spec.ts     # Liquidity management tests
├── fixtures/                 # Test fixtures and mock data
│   ├── wallet.ts             # Mock wallet implementation
│   └── tokens.ts             # Test token fixtures
├── pages/                    # Page Object Model
│   ├── BasePage.ts           # Base page with common methods
│   ├── SwapPage.ts           # Swap page object
│   ├── PoolsPage.ts          # Pools page object
│   ├── LiquidityPage.ts      # Liquidity pages object
│   └── PortfolioPage.ts      # Portfolio page object
├── utils/                    # Test utilities
│   └── helpers.ts            # Helper functions
├── global-setup.ts           # Global setup (runs once before all tests)
└── global-teardown.ts        # Global teardown (runs once after all tests)
```

## 🚀 Running Tests

### Prerequisites

```bash
# Install dependencies
npm install

# Start development server (required for tests)
npm run dev
```

### Run All E2E Tests

```bash
# Run all tests in headless mode
npm run test:e2e

# Run tests in headed mode (with browser UI)
npm run test:e2e -- --headed

# Run tests in debug mode
npm run test:e2e -- --debug
```

### Run Specific Test Files

```bash
# Run only swap tests
npm run test:e2e -- swap.spec.ts

# Run only pool tests
npm run test:e2e -- pools.spec.ts

# Run only liquidity tests
npm run test:e2e -- liquidity.spec.ts
```

### Run Tests in Specific Browsers

```bash
# Run in Chromium only
npm run test:e2e -- --project=chromium

# Run in Firefox only
npm run test:e2e -- --project=firefox

# Run in WebKit (Safari) only
npm run test:e2e -- --project=webkit

# Run in mobile Chrome
npm run test:e2e -- --project="Mobile Chrome"
```

### Run API Integration Tests

```bash
# Run backend API tests
cd backend
npm run test:integration
```

### Run Tests in CI Mode

```bash
# CI mode enables retries and parallel execution
CI=true npm run test:e2e
```

## 📊 Test Reports

### HTML Report

After running tests, view the HTML report:

```bash
npx playwright show-report
```

The report includes:
- Test results with pass/fail status
- Screenshots on failure
- Video recordings on failure
- Trace files for debugging

### JUnit Report

JUnit XML report is generated at `test-results/junit.xml` for CI integration.

### JSON Report

JSON report is generated at `test-results/results.json` for programmatic access.

## 🎭 Test Coverage

### Swap Tests (`swap.spec.ts`)

**Basic Functionality:**
- ✅ Display swap interface
- ✅ Select tokens
- ✅ Switch tokens
- ✅ Fetch quote when amount is entered
- ✅ Display swap details (price, impact, route)
- ✅ Change slippage tolerance
- ✅ Show price impact warning for large trades
- ✅ Disable swap button for invalid amount
- ✅ Show insufficient balance error
- ✅ Approve token if needed
- ✅ Execute swap successfully
- ✅ Handle multi-hop swaps
- ✅ Persist token selection
- ✅ Update quote automatically
- ✅ Handle network errors gracefully
- ✅ Show transaction in recent swaps

**Edge Cases:**
- ✅ Handle same token selection
- ✅ Handle very small amounts
- ✅ Handle maximum decimals
- ✅ Reject invalid input

**Mobile:**
- ✅ Display mobile swap interface
- ✅ Execute swap on mobile

### Pool Tests (`pools.spec.ts`)

**Pool List:**
- ✅ Display pools table
- ✅ Search for pools
- ✅ Sort pools by TVL
- ✅ Sort pools by volume
- ✅ Filter by fee tier
- ✅ Navigate to pool detail
- ✅ Display pool stats
- ✅ Verify specific pools exist
- ✅ Handle empty search results

**Pool Detail:**
- ✅ Display pool header
- ✅ Display pool stats
- ✅ Display charts
- ✅ Display transaction list
- ✅ Navigate to add liquidity
- ✅ Show real-time updates
- ✅ Display recent transactions

**Mobile:**
- ✅ Display pools on mobile
- ✅ Search pools on mobile
- ✅ Navigate to pool detail on mobile

### Liquidity Tests (`liquidity.spec.ts`)

**Add Liquidity:**
- ✅ Display add liquidity interface
- ✅ Select tokens and fee tier
- ✅ Calculate amount1 when amount0 is entered
- ✅ Select full range
- ✅ Select preset ranges (narrow, medium, wide)
- ✅ Set custom price range
- ✅ Display position preview
- ✅ Approve tokens if needed
- ✅ Add liquidity successfully
- ✅ Navigate to position after adding liquidity
- ✅ Handle insufficient balance
- ✅ Validate price range

**Remove Liquidity:**
- ✅ Display remove liquidity interface
- ✅ Adjust removal percentage
- ✅ Use percentage buttons (25%, 50%, 75%, 100%)
- ✅ Remove 100% liquidity
- ✅ Collect fees along with removal
- ✅ Remove partial liquidity

**Portfolio:**
- ✅ Display portfolio page
- ✅ Display portfolio stats
- ✅ List positions
- ✅ Filter open positions
- ✅ Filter closed positions
- ✅ Navigate to position detail
- ✅ Display swap history
- ✅ Verify new position appears after adding liquidity

**Mobile:**
- ✅ Display add liquidity interface on mobile
- ✅ Add liquidity on mobile

### API Integration Tests (`api.test.ts`)

**Health Check:**
- ✅ Return 200 on /health

**Token API:**
- ✅ Get token list
- ✅ Get token by address
- ✅ Return 404 for non-existent token
- ✅ Search tokens
- ✅ Get token price

**Pool API:**
- ✅ Get pool list
- ✅ Get pool by ID
- ✅ Get pool stats
- ✅ Get pool chart data
- ✅ Sort pools by TVL

**Swap API:**
- ✅ Get swap quote
- ✅ Return error for invalid token address
- ✅ Return error for insufficient liquidity
- ✅ Build swap transaction

**Position API:**
- ✅ Get user positions
- ✅ Get position by token ID

**Analytics API:**
- ✅ Get protocol overview
- ✅ Get volume chart data
- ✅ Get top pools
- ✅ Get trending tokens

**Rate Limiting:**
- ✅ Rate limit excessive requests

**Error Handling:**
- ✅ Return 400 for missing parameters
- ✅ Return 400 for invalid parameter types
- ✅ Return 404 for non-existent routes
- ✅ Handle CORS preflight requests

## 🛠️ Writing Tests

### Page Object Model

We use the Page Object Model (POM) pattern to make tests maintainable:

```typescript
// Example: Using SwapPage
import { SwapPage } from '../pages/SwapPage';
import { ETH, USDC } from '../fixtures/tokens';

test('should execute swap', async ({ page }) => {
  const swapPage = new SwapPage(page);
  await swapPage.navigate();

  await swapPage.selectTokenIn(ETH);
  await swapPage.selectTokenOut(USDC);
  await swapPage.enterAmount('1');

  if (await swapPage.isApprovalNeeded()) {
    await swapPage.approve();
  }

  await swapPage.swap();
  await swapPage.waitForSwapComplete();
});
```

### Test Fixtures

Use fixtures for reusable test data:

```typescript
import { mockWalletConnection } from '../fixtures/wallet';
import { ETH, USDC } from '../fixtures/tokens';

test.beforeEach(async ({ page }) => {
  await mockWalletConnection(page);
});
```

### Helper Functions

Use helper functions for common operations:

```typescript
import { waitForNetworkIdle, clearAllStorage } from '../utils/helpers';

test('should do something', async ({ page }) => {
  await clearAllStorage(page);
  await waitForNetworkIdle(page);
});
```

## 🎯 Best Practices

### 1. Test Isolation

Each test should be independent:

```typescript
test.beforeEach(async ({ page }) => {
  // Setup: Clear storage, mock wallet
  await clearAllStorage(page);
  await mockWalletConnection(page);
});

test.afterEach(async ({ page }) => {
  // Cleanup if needed
});
```

### 2. Wait for Elements

Always wait for elements before interacting:

```typescript
// Good ✅
await page.waitForSelector('[data-testid="swap-button"]');
await page.click('[data-testid="swap-button"]');

// Bad ❌
await page.click('[data-testid="swap-button"]'); // Might fail if not ready
```

### 3. Use Data Test IDs

Always use `data-testid` for reliable selectors:

```typescript
// Good ✅
await page.click('[data-testid="swap-button"]');

// Bad ❌
await page.click('.btn-primary'); // Can break with style changes
```

### 4. Assertions

Use meaningful assertions:

```typescript
// Good ✅
await expect(page.locator('[data-testid="swap-button"]')).toBeVisible();
await expect(page.locator('[data-testid="output-amount"]')).toContainText('2,450');

// Bad ❌
await expect(page.locator('button')).toBeVisible(); // Not specific enough
```

### 5. Error Handling

Test both success and error scenarios:

```typescript
test('should handle insufficient balance', async ({ page }) => {
  await swapPage.enterAmount('999999');

  const buttonText = await swapPage.getSwapButtonText();
  expect(buttonText).toContain('Insufficient Balance');
});
```

### 6. Mobile Testing

Test on mobile viewports:

```typescript
test.describe('Mobile Tests', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should work on mobile', async ({ page }) => {
    // Test mobile-specific behavior
  });
});
```

## 🐛 Debugging Tests

### Debug Mode

Run tests in debug mode to step through:

```bash
npm run test:e2e -- --debug
```

### Headed Mode

See the browser while tests run:

```bash
npm run test:e2e -- --headed
```

### Trace Viewer

View traces for failed tests:

```bash
npx playwright show-trace trace.zip
```

### VS Code Debugging

Add breakpoints in VS Code and run:

1. Set breakpoint in test file
2. Click "Debug Test" above test name
3. Use VS Code debugger controls

### Console Logs

Capture console logs during tests:

```typescript
import { setupConsoleCapture } from '../utils/helpers';

test('should log something', async ({ page }) => {
  const logs = setupConsoleCapture(page);

  // Run test...

  console.log('Console logs:', logs);
});
```

## 🔧 CI/CD Integration

### GitHub Actions

Add to `.github/workflows/test.yml`:

```yaml
- name: Run E2E tests
  run: |
    npm run dev &
    sleep 10
    npm run test:e2e
  env:
    CI: true

- name: Upload test results
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: playwright-report
    path: playwright-report/
```

### Docker

Run tests in Docker:

```bash
docker build -t basebook-tests -f Dockerfile.test .
docker run basebook-tests npm run test:e2e
```

## 📈 Performance

### Parallel Execution

Tests run in parallel by default:

```typescript
// playwright.config.ts
export default defineConfig({
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined, // Serial in CI, parallel locally
});
```

### Test Timeout

Set appropriate timeouts:

```typescript
test('long running test', async ({ page }) => {
  test.setTimeout(120000); // 2 minutes

  // Test...
});
```

## 🎓 Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [Vitest Documentation](https://vitest.dev/)
- [Page Object Model](https://playwright.dev/docs/pom)
- [Test Best Practices](https://playwright.dev/docs/best-practices)

## 📝 Adding New Tests

1. Create test file in appropriate directory
2. Follow naming convention: `feature.spec.ts`
3. Use Page Object Model
4. Add test coverage to this README
5. Run tests to verify: `npm run test:e2e -- your-test.spec.ts`

## ❓ Troubleshooting

### Tests fail with "Target closed"

- Increase timeout in `playwright.config.ts`
- Check if application is running
- Verify network connectivity

### Tests fail randomly

- Increase wait times
- Check for race conditions
- Use `test.describe.serial()` for dependent tests

### Wallet connection fails

- Verify mock wallet is properly configured
- Check console for errors
- Ensure wallet scripts are loaded

### API tests fail

- Verify backend is running
- Check database connection
- Review API logs

---

**Test Suite Version:** 1.0
**Last Updated:** 2024-02-03
**Maintained By:** QA Team
