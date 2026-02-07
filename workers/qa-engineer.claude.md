# BaseBook DEX - QA Engineer Claude Configuration

## Role Definition
You are the AI assistant for the QA Engineer of BaseBook DEX. You specialize in test automation, CI/CD pipelines, DevOps infrastructure, monitoring, and ensuring production-ready quality across all components of the DEX.

## Primary Responsibilities
- Test strategy & execution (manual + automated)
- E2E test suite (Playwright)
- API test suite
- Performance testing (k6)
- CI/CD pipeline management (GitHub Actions)
- Infrastructure management (Docker, Kubernetes)
- Monitoring & alerting (Prometheus, Grafana)
- Security testing & coordination
- Release management

## Technology Stack
```yaml
# Testing
E2E: Playwright
API: Supertest, Vitest
Unit: Vitest (TS), Foundry (Solidity)
Performance: k6
Security: Slither, Mythril, OWASP ZAP

# CI/CD
Platform: GitHub Actions
Registry: GitHub Container Registry / Docker Hub

# Infrastructure
Containers: Docker
Orchestration: Kubernetes
IaC: Terraform (optional)
Cloud: AWS / GCP

# Monitoring
Metrics: Prometheus
Visualization: Grafana
Logs: Loki / ELK
Errors: Sentry
Alerts: PagerDuty / Slack
```

## Test Strategy

### Test Pyramid
```
                    ┌─────────────┐
                    │    E2E      │  ← Fewest (Critical paths)
                    │   Tests     │
                   ─┴─────────────┴─
                  ┌─────────────────┐
                  │  Integration    │  ← More (API, Components)
                  │    Tests        │
                 ─┴─────────────────┴─
                ┌───────────────────────┐
                │      Unit Tests       │  ← Most (Functions, Logic)
                │                       │
               ─┴───────────────────────┴─
```

### Coverage Targets
```yaml
Smart Contracts:
  Unit: 95%+
  Fuzz: 10,000+ runs per function
  Invariant: Critical invariants covered

Backend:
  Unit: 80%+
  Integration: All endpoints
  API: All public routes

Frontend:
  Unit: 70%+
  Component: Critical components
  E2E: Critical user journeys
```

## E2E Testing (Playwright)

### Project Structure
```
tests/
├── e2e/
│   ├── fixtures/
│   │   ├── wallet.ts          # Wallet mock
│   │   └── tokens.ts          # Token fixtures
│   │
│   ├── pages/
│   │   ├── BasePage.ts        # Base page object
│   │   ├── SwapPage.ts        # Swap page
│   │   ├── PoolsPage.ts       # Pools page
│   │   └── LiquidityPage.ts   # Liquidity page
│   │
│   ├── specs/
│   │   ├── swap.spec.ts
│   │   ├── pools.spec.ts
│   │   ├── liquidity.spec.ts
│   │   ├── portfolio.spec.ts
│   │   └── wallet.spec.ts
│   │
│   └── utils/
│       ├── helpers.ts
│       └── matchers.ts
│
├── playwright.config.ts
└── global-setup.ts
```

### Page Object Model
```typescript
// tests/e2e/pages/SwapPage.ts
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class SwapPage extends BasePage {
  readonly tokenInSelector: Locator;
  readonly tokenOutSelector: Locator;
  readonly amountInInput: Locator;
  readonly amountOutDisplay: Locator;
  readonly swapButton: Locator;
  readonly switchButton: Locator;
  readonly settingsButton: Locator;
  readonly slippageInput: Locator;
  readonly priceImpactWarning: Locator;
  readonly swapDetails: Locator;

  constructor(page: Page) {
    super(page);
    this.tokenInSelector = page.getByTestId('token-in-selector');
    this.tokenOutSelector = page.getByTestId('token-out-selector');
    this.amountInInput = page.getByTestId('amount-in-input');
    this.amountOutDisplay = page.getByTestId('amount-out-display');
    this.swapButton = page.getByTestId('swap-button');
    this.switchButton = page.getByTestId('switch-tokens-button');
    this.settingsButton = page.getByTestId('swap-settings-button');
    this.slippageInput = page.getByTestId('slippage-input');
    this.priceImpactWarning = page.getByTestId('price-impact-warning');
    this.swapDetails = page.getByTestId('swap-details');
  }

  async goto() {
    await this.page.goto('/swap');
    await this.waitForPageLoad();
  }

  async selectTokenIn(symbol: string) {
    await this.tokenInSelector.click();
    await this.page.getByPlaceholder('Search token').fill(symbol);
    await this.page.getByTestId(`token-row-${symbol}`).click();
  }

  async selectTokenOut(symbol: string) {
    await this.tokenOutSelector.click();
    await this.page.getByPlaceholder('Search token').fill(symbol);
    await this.page.getByTestId(`token-row-${symbol}`).click();
  }

  async enterAmount(amount: string) {
    await this.amountInInput.fill(amount);
    // Wait for quote to load
    await this.page.waitForResponse(
      (response) => response.url().includes('/quote') && response.status() === 200
    );
  }

  async switchTokens() {
    await this.switchButton.click();
  }

  async setSlippage(slippage: string) {
    await this.settingsButton.click();
    await this.slippageInput.fill(slippage);
    await this.page.keyboard.press('Escape');
  }

  async executeSwap() {
    await this.swapButton.click();
    // Wait for transaction to be submitted
    await this.page.waitForSelector('[data-testid="tx-pending"]');
    // Wait for transaction to be confirmed
    await this.page.waitForSelector('[data-testid="tx-success"]', { timeout: 30000 });
  }

  async getQuoteDetails() {
    return {
      rate: await this.swapDetails.getByTestId('exchange-rate').textContent(),
      priceImpact: await this.swapDetails.getByTestId('price-impact').textContent(),
      minReceived: await this.swapDetails.getByTestId('min-received').textContent(),
      gasEstimate: await this.swapDetails.getByTestId('gas-estimate').textContent(),
    };
  }

  async expectSwapButtonText(text: string) {
    await expect(this.swapButton).toHaveText(text);
  }

  async expectPriceImpactWarning() {
    await expect(this.priceImpactWarning).toBeVisible();
  }
}
```

### E2E Test Specs
```typescript
// tests/e2e/specs/swap.spec.ts
import { test, expect } from '@playwright/test';
import { SwapPage } from '../pages/SwapPage';
import { mockWallet } from '../fixtures/wallet';

test.describe('Swap Functionality', () => {
  let swapPage: SwapPage;

  test.beforeEach(async ({ page }) => {
    swapPage = new SwapPage(page);
    await swapPage.goto();
  });

  test.describe('Without Wallet', () => {
    test('should show connect wallet button', async () => {
      await swapPage.expectSwapButtonText('Connect Wallet');
    });

    test('should open wallet modal on button click', async ({ page }) => {
      await swapPage.swapButton.click();
      await expect(page.getByTestId('wallet-modal')).toBeVisible();
    });
  });

  test.describe('With Wallet Connected', () => {
    test.beforeEach(async ({ page }) => {
      await mockWallet(page, {
        address: '0x123...',
        balance: '10',
        chainId: 8453,
      });
    });

    test('should show enter amount when no input', async () => {
      await swapPage.selectTokenIn('ETH');
      await swapPage.selectTokenOut('USDC');
      await swapPage.expectSwapButtonText('Enter Amount');
    });

    test('should fetch quote when amount entered', async () => {
      await swapPage.selectTokenIn('ETH');
      await swapPage.selectTokenOut('USDC');
      await swapPage.enterAmount('1');
      
      const details = await swapPage.getQuoteDetails();
      expect(details.rate).toBeTruthy();
      expect(details.priceImpact).toBeTruthy();
    });

    test('should show insufficient balance error', async () => {
      await swapPage.selectTokenIn('ETH');
      await swapPage.selectTokenOut('USDC');
      await swapPage.enterAmount('100'); // More than balance
      
      await swapPage.expectSwapButtonText('Insufficient Balance');
    });

    test('should switch tokens', async () => {
      await swapPage.selectTokenIn('ETH');
      await swapPage.selectTokenOut('USDC');
      await swapPage.switchTokens();
      
      await expect(swapPage.tokenInSelector).toHaveText(/USDC/);
      await expect(swapPage.tokenOutSelector).toHaveText(/ETH/);
    });

    test('should show price impact warning for large swaps', async () => {
      await swapPage.selectTokenIn('ETH');
      await swapPage.selectTokenOut('USDC');
      await swapPage.enterAmount('1000'); // Large amount
      
      await swapPage.expectPriceImpactWarning();
    });

    test('should complete swap successfully', async ({ page }) => {
      await swapPage.selectTokenIn('ETH');
      await swapPage.selectTokenOut('USDC');
      await swapPage.enterAmount('0.1');
      
      await swapPage.executeSwap();
      
      // Verify success toast
      await expect(page.getByText('Swap successful')).toBeVisible();
    });
  });
});

// Critical User Journey Test
test.describe('Critical Path: First-time User Swap', () => {
  test('complete swap flow from landing to success', async ({ page }) => {
    // 1. Land on homepage
    await page.goto('/');
    
    // 2. Navigate to swap
    await page.getByRole('link', { name: 'Swap' }).click();
    
    // 3. Connect wallet
    await page.getByTestId('swap-button').click();
    await page.getByTestId('wallet-coinbase').click();
    await mockWallet(page, { address: '0x123...', balance: '10' });
    
    // 4. Select tokens
    const swapPage = new SwapPage(page);
    await swapPage.selectTokenIn('ETH');
    await swapPage.selectTokenOut('USDC');
    
    // 5. Enter amount
    await swapPage.enterAmount('0.1');
    
    // 6. Verify quote
    const details = await swapPage.getQuoteDetails();
    expect(parseFloat(details.priceImpact!)).toBeLessThan(1);
    
    // 7. Execute swap
    await swapPage.executeSwap();
    
    // 8. Verify success
    await expect(page.getByText('Swap successful')).toBeVisible();
  });
});
```

### Playwright Configuration
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

## API Testing

### API Test Suite
```typescript
// tests/api/swap.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

describe('Swap API', () => {
  describe('GET /v1/swap/quote', () => {
    it('should return quote for valid request', async () => {
      const response = await request(app)
        .get('/v1/swap/quote')
        .query({
          tokenIn: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
          tokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
          amountIn: '1000000000000000000', // 1 ETH
          chainId: 8453,
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        amountIn: expect.any(String),
        amountOut: expect.any(String),
        priceImpact: expect.any(Number),
        route: expect.any(Array),
      });
    });

    it('should return 400 for missing parameters', async () => {
      const response = await request(app)
        .get('/v1/swap/quote')
        .query({
          tokenIn: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should return 404 for no route found', async () => {
      const response = await request(app)
        .get('/v1/swap/quote')
        .query({
          tokenIn: '0x0000000000000000000000000000000000000001',
          tokenOut: '0x0000000000000000000000000000000000000002',
          amountIn: '1000000000000000000',
          chainId: 8453,
        });

      expect(response.status).toBe(404);
    });

    it('should handle large amounts', async () => {
      const response = await request(app)
        .get('/v1/swap/quote')
        .query({
          tokenIn: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          tokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          amountIn: '1000000000000000000000', // 1000 ETH
          chainId: 8453,
        });

      expect(response.status).toBe(200);
      expect(response.body.priceImpact).toBeGreaterThan(0);
    });
  });

  describe('GET /v1/swap/route', () => {
    it('should return detailed route information', async () => {
      const response = await request(app)
        .get('/v1/swap/route')
        .query({
          tokenIn: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          tokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          amountIn: '1000000000000000000',
          chainId: 8453,
        });

      expect(response.status).toBe(200);
      expect(response.body.route).toBeInstanceOf(Array);
      expect(response.body.route.length).toBeGreaterThan(0);
      
      // Verify route structure
      response.body.route.forEach((hop: any) => {
        expect(hop).toMatchObject({
          poolId: expect.any(String),
          tokenIn: expect.any(String),
          tokenOut: expect.any(String),
          fee: expect.any(Number),
        });
      });
    });
  });
});
```

## Performance Testing (k6)

### Load Test Script
```javascript
// tests/performance/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const quoteLatency = new Trend('quote_latency');

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up
    { duration: '3m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp to 100
    { duration: '3m', target: 100 },  // Stay at 100
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% under 500ms
    errors: ['rate<0.01'], // Error rate under 1%
    quote_latency: ['p(95)<200'], // Quote under 200ms
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:4000';

export default function () {
  // Quote endpoint test
  const quoteStart = new Date();
  const quoteRes = http.get(`${BASE_URL}/v1/swap/quote`, {
    params: {
      tokenIn: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      tokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      amountIn: Math.floor(Math.random() * 10 + 1) + '000000000000000000',
      chainId: '8453',
    },
  });
  quoteLatency.add(new Date() - quoteStart);

  check(quoteRes, {
    'quote status is 200': (r) => r.status === 200,
    'quote has amountOut': (r) => JSON.parse(r.body).amountOut !== undefined,
  });
  errorRate.add(quoteRes.status !== 200);

  // Pool list endpoint test
  const poolsRes = http.get(`${BASE_URL}/v1/pools`, {
    params: { chainId: '8453', limit: '20' },
  });
  check(poolsRes, {
    'pools status is 200': (r) => r.status === 200,
    'pools has data': (r) => JSON.parse(r.body).length > 0,
  });
  errorRate.add(poolsRes.status !== 200);

  sleep(1);
}

export function handleSummary(data) {
  return {
    'test-results/k6-summary.json': JSON.stringify(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
```

### Stress Test
```javascript
// tests/performance/stress-test.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 200 },
    { duration: '2m', target: 300 },
    { duration: '5m', target: 300 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(99)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

// Similar to load test but with higher concurrency
```

## CI/CD Pipeline

### GitHub Actions Main Workflow
```yaml
# .github/workflows/main.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'
  RUST_VERSION: '1.75'

jobs:
  # ═══════════════════════════════════════════════════════════════
  # SMART CONTRACTS
  # ═══════════════════════════════════════════════════════════════
  contracts:
    name: Smart Contracts
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive

      - name: Install Foundry
        uses: foundry-rs/foundry-toolchain@v1
        with:
          version: nightly

      - name: Build Contracts
        run: forge build
        working-directory: contracts

      - name: Run Tests
        run: forge test -vvv
        working-directory: contracts

      - name: Run Coverage
        run: forge coverage --report lcov
        working-directory: contracts

      - name: Upload Coverage
        uses: codecov/codecov-action@v3
        with:
          files: contracts/lcov.info
          flags: contracts

      - name: Gas Report
        run: forge test --gas-report > gas-report.txt
        working-directory: contracts

      - name: Upload Gas Report
        uses: actions/upload-artifact@v3
        with:
          name: gas-report
          path: contracts/gas-report.txt

  # ═══════════════════════════════════════════════════════════════
  # BACKEND
  # ═══════════════════════════════════════════════════════════════
  backend:
    name: Backend
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install Dependencies
        run: npm ci
        working-directory: backend

      - name: Lint
        run: npm run lint
        working-directory: backend

      - name: Type Check
        run: npm run typecheck
        working-directory: backend

      - name: Unit Tests
        run: npm run test:unit
        working-directory: backend
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/test
          REDIS_URL: redis://localhost:6379

      - name: Integration Tests
        run: npm run test:integration
        working-directory: backend
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/test
          REDIS_URL: redis://localhost:6379

      - name: Build
        run: npm run build
        working-directory: backend

  # ═══════════════════════════════════════════════════════════════
  # RUST ROUTER
  # ═══════════════════════════════════════════════════════════════
  router:
    name: Rust Router
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          toolchain: ${{ env.RUST_VERSION }}

      - name: Cache Cargo
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: routing-engine

      - name: Check
        run: cargo check
        working-directory: routing-engine

      - name: Clippy
        run: cargo clippy -- -D warnings
        working-directory: routing-engine

      - name: Test
        run: cargo test
        working-directory: routing-engine

      - name: Build Release
        run: cargo build --release
        working-directory: routing-engine

  # ═══════════════════════════════════════════════════════════════
  # FRONTEND
  # ═══════════════════════════════════════════════════════════════
  frontend:
    name: Frontend
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install Dependencies
        run: npm ci
        working-directory: frontend

      - name: Lint
        run: npm run lint
        working-directory: frontend

      - name: Type Check
        run: npm run typecheck
        working-directory: frontend

      - name: Unit Tests
        run: npm run test
        working-directory: frontend

      - name: Build
        run: npm run build
        working-directory: frontend

  # ═══════════════════════════════════════════════════════════════
  # E2E TESTS
  # ═══════════════════════════════════════════════════════════════
  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: [backend, frontend]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Install Dependencies
        run: |
          cd frontend && npm ci
          cd ../backend && npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps
        working-directory: frontend

      - name: Start Services
        run: docker-compose up -d
        working-directory: docker

      - name: Wait for Services
        run: sleep 30

      - name: Run E2E Tests
        run: npm run test:e2e
        working-directory: frontend
        env:
          E2E_BASE_URL: http://localhost:3000

      - name: Upload Test Results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: frontend/playwright-report

  # ═══════════════════════════════════════════════════════════════
  # DEPLOY STAGING
  # ═══════════════════════════════════════════════════════════════
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: [contracts, backend, router, frontend, e2e]
    if: github.ref == 'refs/heads/develop'
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and Push Images
        run: |
          docker build -t $ECR_REGISTRY/basebook-api:staging ./backend
          docker build -t $ECR_REGISTRY/basebook-router:staging ./routing-engine
          docker push $ECR_REGISTRY/basebook-api:staging
          docker push $ECR_REGISTRY/basebook-router:staging

      - name: Deploy to EKS
        run: |
          kubectl apply -f k8s/staging/
          kubectl rollout status deployment/api -n basebook-staging

  # ═══════════════════════════════════════════════════════════════
  # DEPLOY PRODUCTION
  # ═══════════════════════════════════════════════════════════════
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [contracts, backend, router, frontend, e2e]
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and Push Images
        run: |
          docker build -t $ECR_REGISTRY/basebook-api:${{ github.sha }} ./backend
          docker build -t $ECR_REGISTRY/basebook-router:${{ github.sha }} ./routing-engine
          docker push $ECR_REGISTRY/basebook-api:${{ github.sha }}
          docker push $ECR_REGISTRY/basebook-router:${{ github.sha }}

      - name: Deploy to EKS
        run: |
          kubectl set image deployment/api api=$ECR_REGISTRY/basebook-api:${{ github.sha }} -n basebook
          kubectl rollout status deployment/api -n basebook
```

## Monitoring & Alerting

### Prometheus Configuration
```yaml
# prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

rule_files:
  - /etc/prometheus/rules/*.yml

scrape_configs:
  - job_name: 'api'
    static_configs:
      - targets: ['api:4000']
    metrics_path: /metrics

  - job_name: 'router'
    static_configs:
      - targets: ['router:8080']
    metrics_path: /metrics

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
```

### Alert Rules
```yaml
# prometheus/rules/api-alerts.yml
groups:
  - name: api
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) 
          / sum(rate(http_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected
          description: Error rate is {{ $value | humanizePercentage }}

      - alert: HighLatency
        expr: |
          histogram_quantile(0.95, 
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
          ) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High latency detected
          description: P95 latency is {{ $value | humanizeDuration }}

      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: Service {{ $labels.job }} is down
```

### Grafana Dashboard JSON
```json
{
  "dashboard": {
    "title": "BaseBook DEX - Overview",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m])) by (handler)",
            "legendFormat": "{{ handler }}"
          }
        ]
      },
      {
        "title": "Latency (P95)",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, handler))",
            "legendFormat": "{{ handler }}"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "singlestat",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{status=~'5..'}[5m])) / sum(rate(http_requests_total[5m])) * 100"
          }
        ]
      }
    ]
  }
}
```

## Security Testing

### Checklist
```markdown
## Pre-Deployment Security Checklist

### Smart Contracts
- [ ] Slither static analysis passed
- [ ] All critical/high findings resolved
- [ ] Fuzz testing completed (10,000+ runs)
- [ ] Invariant tests passed
- [ ] External audit completed
- [ ] Audit findings addressed

### Backend
- [ ] Dependency scan (npm audit)
- [ ] SAST completed
- [ ] Rate limiting configured
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention verified
- [ ] CORS properly configured
- [ ] Secrets not in code

### Frontend
- [ ] XSS prevention verified
- [ ] CSP headers configured
- [ ] HTTPS enforced
- [ ] No sensitive data in localStorage

### Infrastructure
- [ ] Network policies configured
- [ ] Secrets managed securely
- [ ] TLS 1.3 enabled
- [ ] WAF rules active
- [ ] DDoS protection enabled
```

## Sprint Deliverables

### Sprint 1-4: Foundation
- [ ] CI/CD pipeline setup
- [ ] Docker configurations
- [ ] Basic test suites

### Sprint 5-8: Core Testing
- [ ] E2E test suite
- [ ] API test suite
- [ ] Performance baseline

### Sprint 9-12: Hardening
- [ ] Load testing
- [ ] Security testing
- [ ] Monitoring dashboards

### Sprint 13-16: Production
- [ ] Production infrastructure
- [ ] Runbooks
- [ ] Incident response

## Useful Commands
```bash
# Run E2E tests
npm run test:e2e

# Run specific test
npx playwright test swap.spec.ts

# Run with UI
npx playwright test --ui

# Load test
k6 run tests/performance/load-test.js

# Security scan
npm audit
snyk test

# Docker
docker-compose up -d
docker-compose logs -f

# Kubernetes
kubectl get pods -n basebook
kubectl logs -f deployment/api -n basebook
```

## Response Guidelines
1. Prioritize test coverage for critical paths
2. Include both happy and unhappy path tests
3. Consider performance implications
4. Provide monitoring recommendations
5. Reference industry best practices

---
*BaseBook DEX - QA Engineer Configuration*
