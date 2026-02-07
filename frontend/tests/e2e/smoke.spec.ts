import { test, expect } from '@playwright/test';
import { mockWalletConnection, waitForWalletConnection } from '../fixtures/wallet';

/**
 * Smoke Tests - Quick sanity checks for critical functionality
 * Run these first to ensure basic functionality works
 * Should complete in < 2 minutes
 */

test.describe('Smoke Tests - Critical Functionality', () => {
  test('should load homepage', async ({ page }) => {
    await page.goto('/');

    // Page should load
    await expect(page).toHaveTitle(/BaseBook/i);

    // Header should be visible
    await expect(page.locator('header')).toBeVisible();

    // Connect wallet button should be visible
    await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();
  });

  test('should connect wallet', async ({ page }) => {
    await mockWalletConnection(page);
    await page.goto('/');

    // Wait for wallet connection
    await waitForWalletConnection(page);

    // Should show connected state
    await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

    // Should show address
    await expect(page.locator('[data-testid="wallet-address"]')).toContainText('0x');
  });

  test('should navigate to swap page', async ({ page }) => {
    await mockWalletConnection(page);
    await page.goto('/');

    // Click on swap link
    await page.click('[data-testid="nav-swap"]');

    // Should navigate to swap
    await expect(page).toHaveURL(/\/swap/);

    // Swap interface should be visible
    await expect(page.locator('[data-testid="swap-widget"]')).toBeVisible();
  });

  test('should load token list', async ({ page }) => {
    await mockWalletConnection(page);
    await page.goto('/swap');
    await waitForWalletConnection(page);

    // Click token selector
    await page.click('[data-testid="token-in-select"]');

    // Token modal should open
    await expect(page.locator('[data-testid="token-selector-modal"]')).toBeVisible();

    // Should show multiple tokens
    const tokenCount = await page.locator('[data-testid^="token-"]').count();
    expect(tokenCount).toBeGreaterThan(3);
  });

  test('should get swap quote', async ({ page }) => {
    await mockWalletConnection(page);
    await page.goto('/swap');
    await waitForWalletConnection(page);

    // Select tokens (assume default is ETH/USDC)
    await page.locator('[data-testid="token-in-amount"]').fill('1');

    // Wait for quote
    await page.waitForSelector('[data-testid="quote-loading"]', { state: 'hidden', timeout: 5000 });

    // Output should have value
    const outputValue = await page.locator('[data-testid="token-out-amount"]').inputValue();
    expect(parseFloat(outputValue)).toBeGreaterThan(0);
  });

  test('should navigate to pools page', async ({ page }) => {
    await mockWalletConnection(page);
    await page.goto('/');

    // Click pools link
    await page.click('[data-testid="nav-pools"]');

    // Should navigate to pools
    await expect(page).toHaveURL(/\/pools/);

    // Pool table should be visible
    await expect(page.locator('[data-testid="pool-table"]')).toBeVisible();
  });

  test('should load pool list', async ({ page }) => {
    await mockWalletConnection(page);
    await page.goto('/pools');

    // Wait for pools to load
    await page.waitForSelector('[data-testid="pool-table"]');

    // Should have at least one pool
    const poolCount = await page.locator('[data-testid="pool-table"] tbody tr').count();
    expect(poolCount).toBeGreaterThan(0);
  });

  test('should navigate to portfolio page', async ({ page }) => {
    await mockWalletConnection(page);
    await page.goto('/');
    await waitForWalletConnection(page);

    // Click portfolio link
    await page.click('[data-testid="nav-portfolio"]');

    // Should navigate to portfolio
    await expect(page).toHaveURL(/\/portfolio/);

    // Portfolio should be visible
    await expect(page.locator('[data-testid="portfolio-container"]')).toBeVisible();
  });

  test('should show API health', async ({ page }) => {
    // Check API health endpoint
    const response = await page.request.get('http://localhost:4000/health');

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('ok');
  });

  test('should handle wrong network', async ({ page, context }) => {
    // Mock wallet on wrong network
    await mockWalletConnection(page, {
      chainId: 1, // Ethereum mainnet instead of Base
    });

    await page.goto('/swap');

    // Should show network warning
    await expect(page.locator('[data-testid="wrong-network-warning"]')).toBeVisible();

    // Should show switch network button
    await expect(page.locator('[data-testid="switch-network-button"]')).toBeVisible();
  });

  test('should disconnect wallet', async ({ page }) => {
    await mockWalletConnection(page);
    await page.goto('/');
    await waitForWalletConnection(page);

    // Click wallet menu
    await page.click('[data-testid="wallet-menu"]');

    // Click disconnect
    await page.click('[data-testid="disconnect-button"]');

    // Should show connect button again
    await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();
  });
});

test.describe('Smoke Tests - Performance', () => {
  test('homepage should load quickly', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Should load in less than 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('swap quote should be fast', async ({ page }) => {
    await mockWalletConnection(page);
    await page.goto('/swap');
    await waitForWalletConnection(page);

    const startTime = Date.now();

    // Enter amount
    await page.locator('[data-testid="token-in-amount"]').fill('1');

    // Wait for quote
    await page.waitForSelector('[data-testid="quote-loading"]', { state: 'hidden' });

    const quoteTime = Date.now() - startTime;

    // Quote should arrive in less than 2 seconds
    expect(quoteTime).toBeLessThan(2000);
  });

  test('pool list should render quickly', async ({ page }) => {
    await mockWalletConnection(page);

    const startTime = Date.now();

    await page.goto('/pools');
    await page.waitForSelector('[data-testid="pool-table"]');

    const renderTime = Date.now() - startTime;

    // Should render in less than 2 seconds
    expect(renderTime).toBeLessThan(2000);
  });
});

test.describe('Smoke Tests - Error Handling', () => {
  test('should handle network disconnection', async ({ page, context }) => {
    await mockWalletConnection(page);
    await page.goto('/swap');

    // Simulate offline
    await context.setOffline(true);

    // Try to get quote
    await page.locator('[data-testid="token-in-amount"]').fill('1');

    // Should show error
    await expect(page.locator('[data-testid="network-error"]')).toBeVisible({ timeout: 5000 });

    // Restore connection
    await context.setOffline(false);
  });

  test('should handle invalid input gracefully', async ({ page }) => {
    await mockWalletConnection(page);
    await page.goto('/swap');
    await waitForWalletConnection(page);

    // Try to enter invalid amount
    await page.locator('[data-testid="token-in-amount"]').fill('abc');

    // Should not crash
    await expect(page.locator('[data-testid="swap-widget"]')).toBeVisible();

    // Input should be empty or show error
    const value = await page.locator('[data-testid="token-in-amount"]').inputValue();
    expect(value).toBe('');
  });

  test('should show error for insufficient balance', async ({ page }) => {
    await mockWalletConnection(page, {
      balance: '0.01', // Very low balance
    });

    await page.goto('/swap');
    await waitForWalletConnection(page);

    // Try to swap more than balance
    await page.locator('[data-testid="token-in-amount"]').fill('999');

    // Should show insufficient balance
    await expect(page.locator('[data-testid="insufficient-balance-error"]')).toBeVisible();

    // Swap button should be disabled
    const swapButton = page.locator('[data-testid="swap-button"]');
    await expect(swapButton).toBeDisabled();
  });
});

test.describe('Smoke Tests - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should load on mobile', async ({ page }) => {
    await page.goto('/');

    // Should have mobile menu
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
  });

  test('should navigate on mobile', async ({ page }) => {
    await mockWalletConnection(page);
    await page.goto('/');

    // Open mobile menu
    await page.click('[data-testid="mobile-menu-button"]');

    // Click pools
    await page.click('[data-testid="mobile-nav-pools"]');

    // Should navigate
    await expect(page).toHaveURL(/\/pools/);
  });

  test('should swap on mobile', async ({ page }) => {
    await mockWalletConnection(page);
    await page.goto('/swap');
    await waitForWalletConnection(page);

    // Should show swap interface
    await expect(page.locator('[data-testid="swap-widget"]')).toBeVisible();

    // Should be able to input amount
    await page.locator('[data-testid="token-in-amount"]').fill('0.1');

    // Should get quote
    await page.waitForSelector('[data-testid="quote-loading"]', { state: 'hidden' });

    // Output should have value
    const outputValue = await page.locator('[data-testid="token-out-amount"]').inputValue();
    expect(parseFloat(outputValue)).toBeGreaterThan(0);
  });
});

test.describe('Smoke Tests - Critical User Flows', () => {
  test('CP-001: Basic swap flow (happy path)', async ({ page }) => {
    await mockWalletConnection(page);
    await page.goto('/swap');
    await waitForWalletConnection(page);

    // 1. Select tokens (default ETH/USDC)
    // 2. Enter amount
    await page.locator('[data-testid="token-in-amount"]').fill('0.1');

    // 3. Wait for quote
    await page.waitForSelector('[data-testid="quote-loading"]', { state: 'hidden' });

    // 4. Verify swap details visible
    await expect(page.locator('[data-testid="swap-details"]')).toBeVisible();

    // 5. Swap button should be enabled
    const swapButton = page.locator('[data-testid="swap-button"]');
    await expect(swapButton).toBeEnabled();

    // Success - all critical UI elements present
    expect(true).toBe(true);
  });

  test('CP-005: Wallet connection flow', async ({ page }) => {
    await page.goto('/');

    // 1. Should see connect button
    await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();

    // 2. Mock connection
    await mockWalletConnection(page);
    await page.reload();

    // 3. Wait for connection
    await waitForWalletConnection(page);

    // 4. Should show connected state
    await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

    // 5. Should show address
    await expect(page.locator('[data-testid="wallet-address"]')).toBeVisible();

    // Success
    expect(true).toBe(true);
  });

  test('CP-009: Pool discovery flow', async ({ page }) => {
    await mockWalletConnection(page);
    await page.goto('/pools');

    // 1. Pools should load
    await page.waitForSelector('[data-testid="pool-table"]');

    // 2. Search should work
    await page.locator('[data-testid="pool-search"]').fill('ETH');

    // 3. Wait for filtered results
    await page.waitForTimeout(500);

    // 4. Should have results
    const poolCount = await page.locator('[data-testid="pool-table"] tbody tr').count();
    expect(poolCount).toBeGreaterThan(0);

    // Success
    expect(true).toBe(true);
  });
});
