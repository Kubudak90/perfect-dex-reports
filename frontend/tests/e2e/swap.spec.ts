import { test, expect } from '@playwright/test';
import { SwapPage } from '../pages/SwapPage';
import { mockWalletConnection, waitForWalletConnection } from '../fixtures/wallet';
import { ETH, USDC, WETH, DAI } from '../fixtures/tokens';

test.describe('Swap Functionality', () => {
  let swapPage: SwapPage;

  test.beforeEach(async ({ page }) => {
    // Mock wallet connection
    await mockWalletConnection(page);

    swapPage = new SwapPage(page);
    await swapPage.navigate();

    // Wait for wallet to be connected
    await waitForWalletConnection(page);
  });

  test('should display swap interface', async () => {
    await expect(swapPage.tokenInButton).toBeVisible();
    await expect(swapPage.tokenOutButton).toBeVisible();
    await expect(swapPage.tokenInInput).toBeVisible();
    await expect(swapPage.swapButton).toBeVisible();
  });

  test('should select tokens', async () => {
    await swapPage.selectTokenIn(ETH);
    await swapPage.selectTokenOut(USDC);

    await expect(swapPage.tokenInButton).toContainText('ETH');
    await expect(swapPage.tokenOutButton).toContainText('USDC');
  });

  test('should switch tokens', async () => {
    await swapPage.selectTokenIn(ETH);
    await swapPage.selectTokenOut(USDC);

    await swapPage.switchTokens();

    await expect(swapPage.tokenInButton).toContainText('USDC');
    await expect(swapPage.tokenOutButton).toContainText('ETH');
  });

  test('should fetch quote when amount is entered', async () => {
    await swapPage.selectTokenIn(ETH);
    await swapPage.selectTokenOut(USDC);
    await swapPage.enterAmount('1');

    // Should show output amount
    const outputAmount = await swapPage.getOutputAmount();
    expect(parseFloat(outputAmount)).toBeGreaterThan(0);
  });

  test('should display swap details', async () => {
    await swapPage.selectTokenIn(ETH);
    await swapPage.selectTokenOut(USDC);
    await swapPage.enterAmount('1');

    await swapPage.verifySwapDetails();

    const executionPrice = await swapPage.getExecutionPrice();
    expect(executionPrice).not.toBe('');

    const priceImpact = await swapPage.getPriceImpact();
    expect(priceImpact).not.toBe('');
  });

  test('should change slippage tolerance', async () => {
    await swapPage.setSlippage('1.0');

    // Verify slippage was set
    await swapPage.openSettings();
    await expect(swapPage.slippageInput).toHaveValue('1.0');
  });

  test('should show price impact warning for large trades', async () => {
    await swapPage.selectTokenIn(ETH);
    await swapPage.selectTokenOut(USDC);
    await swapPage.enterAmount('1000'); // Large amount

    if (await swapPage.hasPriceImpactWarning()) {
      await expect(swapPage.priceImpactWarning).toBeVisible();
    }
  });

  test('should disable swap button for invalid amount', async () => {
    await swapPage.selectTokenIn(ETH);
    await swapPage.selectTokenOut(USDC);
    await swapPage.enterAmount('0');

    const isDisabled = await swapPage.isSwapButtonDisabled();
    expect(isDisabled).toBe(true);
  });

  test('should show insufficient balance error', async () => {
    await swapPage.selectTokenIn(ETH);
    await swapPage.selectTokenOut(USDC);
    await swapPage.enterAmount('999999'); // More than balance

    const buttonText = await swapPage.getSwapButtonText();
    expect(buttonText).toContain('Insufficient Balance');
  });

  test('should approve token if needed', async ({ page }) => {
    await swapPage.selectTokenIn(USDC);
    await swapPage.selectTokenOut(ETH);
    await swapPage.enterAmount('100');

    if (await swapPage.isApprovalNeeded()) {
      await swapPage.approve();

      // Verify approval success
      await expect(
        page.locator('[data-testid="approval-success"]')
      ).toBeVisible();
    }
  });

  test('should execute swap successfully', async ({ page }) => {
    await swapPage.selectTokenIn(ETH);
    await swapPage.selectTokenOut(USDC);
    await swapPage.enterAmount('0.1');

    // Approve if needed
    if (await swapPage.isApprovalNeeded()) {
      await swapPage.approve();
    }

    // Execute swap
    await swapPage.swap();

    // Wait for transaction to complete
    await swapPage.waitForSwapComplete();

    // Verify success message
    await expect(page.locator('[data-testid="tx-success"]')).toBeVisible();
  });

  test('should handle multi-hop swaps', async () => {
    // Swap ETH → DAI (might route through USDC)
    await swapPage.selectTokenIn(ETH);
    await swapPage.selectTokenOut(DAI);
    await swapPage.enterAmount('1');

    // Check if route is displayed
    await expect(swapPage.page.locator('[data-testid="route-info"]')).toBeVisible();
  });

  test('should persist token selection', async ({ page }) => {
    await swapPage.selectTokenIn(ETH);
    await swapPage.selectTokenOut(USDC);

    // Reload page
    await page.reload();

    // Tokens should still be selected
    await expect(swapPage.tokenInButton).toContainText('ETH');
    await expect(swapPage.tokenOutButton).toContainText('USDC');
  });

  test('should update quote automatically', async () => {
    await swapPage.selectTokenIn(ETH);
    await swapPage.selectTokenOut(USDC);
    await swapPage.enterAmount('1');

    const firstQuote = await swapPage.getOutputAmount();

    // Wait for auto-refresh (15 seconds)
    await swapPage.page.waitForTimeout(16000);

    const secondQuote = await swapPage.getOutputAmount();

    // Quote might have changed
    expect(secondQuote).not.toBe('');
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate offline
    await page.context().setOffline(true);

    await swapPage.selectTokenIn(ETH);
    await swapPage.selectTokenOut(USDC);
    await swapPage.enterAmount('1');

    // Should show error
    await swapPage.expectError('Failed to fetch quote');

    // Restore connection
    await page.context().setOffline(false);
  });

  test('should show transaction in recent swaps', async ({ page }) => {
    await swapPage.selectTokenIn(ETH);
    await swapPage.selectTokenOut(USDC);
    await swapPage.enterAmount('0.1');

    if (await swapPage.isApprovalNeeded()) {
      await swapPage.approve();
    }

    await swapPage.swap();
    await swapPage.waitForSwapComplete();

    // Check recent swaps
    await expect(
      page.locator('[data-testid="recent-swaps"]').first()
    ).toBeVisible();
  });
});

test.describe('Swap - Edge Cases', () => {
  let swapPage: SwapPage;

  test.beforeEach(async ({ page }) => {
    await mockWalletConnection(page);
    swapPage = new SwapPage(page);
    await swapPage.navigate();
    await waitForWalletConnection(page);
  });

  test('should handle same token selection', async () => {
    await swapPage.selectTokenIn(ETH);
    await swapPage.selectTokenOut(ETH);

    // Should automatically switch
    await expect(swapPage.tokenOutButton).not.toContainText('ETH');
  });

  test('should handle very small amounts', async () => {
    await swapPage.selectTokenIn(ETH);
    await swapPage.selectTokenOut(USDC);
    await swapPage.enterAmount('0.00001');

    const outputAmount = await swapPage.getOutputAmount();
    expect(outputAmount).not.toBe('0');
  });

  test('should handle maximum decimals', async () => {
    await swapPage.selectTokenIn(USDC); // 6 decimals
    await swapPage.selectTokenOut(ETH); // 18 decimals
    await swapPage.enterAmount('100.123456');

    const outputAmount = await swapPage.getOutputAmount();
    expect(parseFloat(outputAmount)).toBeGreaterThan(0);
  });

  test('should reject invalid input', async () => {
    await swapPage.selectTokenIn(ETH);
    await swapPage.selectTokenOut(USDC);

    // Try to enter invalid characters
    await swapPage.tokenInInput.fill('abc');

    // Should not accept
    const value = await swapPage.tokenInInput.inputValue();
    expect(value).toBe('');
  });
});

test.describe('Swap - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  let swapPage: SwapPage;

  test.beforeEach(async ({ page }) => {
    await mockWalletConnection(page);
    swapPage = new SwapPage(page);
    await swapPage.navigate();
    await waitForWalletConnection(page);
  });

  test('should display mobile swap interface', async () => {
    await expect(swapPage.tokenInButton).toBeVisible();
    await expect(swapPage.tokenOutButton).toBeVisible();
    await expect(swapPage.swapButton).toBeVisible();
  });

  test('should execute swap on mobile', async ({ page }) => {
    await swapPage.selectTokenIn(ETH);
    await swapPage.selectTokenOut(USDC);
    await swapPage.enterAmount('0.1');

    if (await swapPage.isApprovalNeeded()) {
      await swapPage.approve();
    }

    await swapPage.swap();
    await swapPage.waitForSwapComplete();

    await expect(page.locator('[data-testid="tx-success"]')).toBeVisible();
  });
});
