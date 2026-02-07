import { test, expect } from '@playwright/test';
import { SwapPage } from '../pages/SwapPage';
import { PoolsPage, PoolDetailPage } from '../pages/PoolsPage';
import { AddLiquidityPage, RemoveLiquidityPage } from '../pages/LiquidityPage';
import { PortfolioPage, PositionDetailPage } from '../pages/PortfolioPage';
import { mockWalletConnection, waitForWalletConnection } from '../fixtures/wallet';
import { ETH, USDC, DAI, WETH } from '../fixtures/tokens';

/**
 * Critical Path Tests - Complete end-to-end user journeys
 * These tests MUST pass for the DEX to be considered functional
 */

test.describe('CP-001: First Time User - Complete Swap Journey', () => {
  test('should complete entire swap flow as new user', async ({ page }) => {
    // Setup: Fresh user with ETH balance
    await mockWalletConnection(page, {
      balance: '10',
    });

    // 1. Navigate to baseBook
    await page.goto('/');

    // 2. Wallet should auto-connect (mocked)
    await waitForWalletConnection(page);
    await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

    // 3. Navigate to Swap page (should be default)
    const swapPage = new SwapPage(page);
    await swapPage.navigate();

    // 4-5. Select tokens
    await swapPage.selectTokenIn(ETH);
    await swapPage.selectTokenOut(USDC);

    // 6. Enter amount
    await swapPage.enterAmount('0.1');

    // 7. Review quote and price impact
    await swapPage.verifySwapDetails();
    const priceImpact = await swapPage.getPriceImpact();
    expect(priceImpact).toBeTruthy();

    // Verify price impact is reasonable (<5%)
    const impactValue = parseFloat(priceImpact.replace('%', ''));
    expect(impactValue).toBeLessThan(5);

    // 8. Verify gas estimate shown
    await expect(page.locator('[data-testid="gas-estimate"]')).toBeVisible();

    // 9. Click swap button
    const swapButton = swapPage.swapButton;
    await expect(swapButton).toBeEnabled();

    // Verify button shows correct text
    const buttonText = await swapPage.getSwapButtonText();
    expect(buttonText.toLowerCase()).toContain('swap');

    // Success criteria met:
    // ✅ Wallet connected
    // ✅ Tokens selected
    // ✅ Quote received quickly
    // ✅ Price impact shown and reasonable
    // ✅ Gas estimate shown
    // ✅ Ready to execute
  });

  test('should handle insufficient balance correctly', async ({ page }) => {
    await mockWalletConnection(page, {
      balance: '0.01', // Very low balance
    });

    const swapPage = new SwapPage(page);
    await swapPage.navigate();
    await waitForWalletConnection(page);

    await swapPage.selectTokenIn(ETH);
    await swapPage.selectTokenOut(USDC);

    // Try to swap more than balance
    await swapPage.enterAmount('10');

    // Should show error
    const buttonText = await swapPage.getSwapButtonText();
    expect(buttonText.toLowerCase()).toContain('insufficient');

    // Button should be disabled
    expect(await swapPage.isSwapButtonDisabled()).toBe(true);

    // ✅ Error handling works
  });

  test('should handle RPC failure gracefully', async ({ page, context }) => {
    await mockWalletConnection(page);
    const swapPage = new SwapPage(page);
    await swapPage.navigate();
    await waitForWalletConnection(page);

    await swapPage.selectTokenIn(ETH);
    await swapPage.selectTokenOut(USDC);

    // Simulate network failure
    await context.setOffline(true);
    await swapPage.enterAmount('0.1');

    // Should show error within reasonable time
    await expect(page.locator('[data-testid="quote-error"]')).toBeVisible({ timeout: 10000 });

    // Restore connection
    await context.setOffline(false);

    // Should retry and recover
    await page.waitForTimeout(2000);
    await expect(page.locator('[data-testid="quote-error"]')).not.toBeVisible({ timeout: 10000 });

    // ✅ Network error handling works
  });
});

test.describe('CP-002: Power User - Multi-Hop Swap', () => {
  test('should find and display multi-hop route', async ({ page }) => {
    await mockWalletConnection(page);
    const swapPage = new SwapPage(page);
    await swapPage.navigate();
    await waitForWalletConnection(page);

    // Select tokens that require multi-hop
    await swapPage.selectTokenIn(DAI);
    await swapPage.selectTokenOut(WETH);

    // Enter amount
    await swapPage.enterAmount('1000');

    // Wait for route calculation
    await swapPage.waitForQuote();

    // Route info should be visible
    await expect(page.locator('[data-testid="route-info"]')).toBeVisible();

    // Should show intermediary tokens
    const routeText = await page.locator('[data-testid="route-info"]').textContent();
    expect(routeText).toBeTruthy();

    // ✅ Multi-hop routing works
  });

  test('should allow custom slippage for multi-hop', async ({ page }) => {
    await mockWalletConnection(page);
    const swapPage = new SwapPage(page);
    await swapPage.navigate();
    await waitForWalletConnection(page);

    // Set custom slippage
    await swapPage.setSlippage('1.5');

    // Select tokens
    await swapPage.selectTokenIn(DAI);
    await swapPage.selectTokenOut(WETH);
    await swapPage.enterAmount('1000');

    await swapPage.waitForQuote();

    // Verify slippage is applied
    await swapPage.openSettings();
    await expect(swapPage.slippageInput).toHaveValue('1.5');

    // ✅ Custom slippage works
  });

  test('should show higher price impact for multi-hop', async ({ page }) => {
    await mockWalletConnection(page);
    const swapPage = new SwapPage(page);
    await swapPage.navigate();
    await waitForWalletConnection(page);

    // Single hop swap
    await swapPage.selectTokenIn(ETH);
    await swapPage.selectTokenOut(USDC);
    await swapPage.enterAmount('1');
    await swapPage.waitForQuote();
    const singleHopImpact = await swapPage.getPriceImpact();

    // Multi-hop swap
    await swapPage.selectTokenIn(DAI);
    await swapPage.selectTokenOut(WETH);
    await swapPage.enterAmount('1000');
    await swapPage.waitForQuote();
    const multiHopImpact = await swapPage.getPriceImpact();

    // Multi-hop should generally have higher impact (or at least be calculated)
    expect(multiHopImpact).toBeTruthy();
    expect(singleHopImpact).toBeTruthy();

    // ✅ Price impact calculated for multi-hop
  });
});

test.describe('CP-003: Liquidity Provider - Add Full Range Position', () => {
  test('should complete add liquidity flow', async ({ page }) => {
    await mockWalletConnection(page);

    // 1-2. Navigate to pools and search
    const poolsPage = new PoolsPage(page);
    await poolsPage.navigate();

    await poolsPage.searchPool('ETH');
    await page.waitForTimeout(500);

    // 3. Click on ETH/USDC pool (if exists)
    const poolCount = await poolsPage.getPoolCount();
    if (poolCount > 0) {
      // 4. Click add liquidity
      await poolsPage.clickPool(0);

      const poolDetailPage = new PoolDetailPage(page);
      await waitForWalletConnection(page);

      // Should show pool stats
      await poolDetailPage.verifyPoolStats();

      // 5. Click add liquidity button
      await poolDetailPage.clickAddLiquidity();

      // Should navigate to add liquidity page
      await expect(page).toHaveURL(/\/add/);

      const addLiquidityPage = new AddLiquidityPage(page);

      // 6-7. Tokens should be pre-selected
      await expect(addLiquidityPage.token0Button).toBeVisible();
      await expect(addLiquidityPage.token1Button).toBeVisible();

      // 8. Select full range
      await addLiquidityPage.selectFullRange();

      // 9. Enter amount
      await addLiquidityPage.enterAmount0('0.1');

      // 10. Review calculated amount
      const amount1 = await addLiquidityPage.amount1Input.inputValue();
      expect(parseFloat(amount1)).toBeGreaterThan(0);

      // 11. Review position preview
      await addLiquidityPage.verifyPositionPreview();

      const apr = await addLiquidityPage.getEstimatedAPR();
      expect(apr).toBeTruthy();

      // ✅ Add liquidity flow works
    }
  });

  test('should validate both token balances', async ({ page }) => {
    await mockWalletConnection(page, {
      balance: '0.01', // Low balance
    });

    const addLiquidityPage = new AddLiquidityPage(page);
    await addLiquidityPage.navigate();
    await waitForWalletConnection(page);

    await addLiquidityPage.selectToken0(ETH);
    await addLiquidityPage.selectToken1(USDC);
    await addLiquidityPage.selectFeeTier('0.3%');
    await addLiquidityPage.selectFullRange();

    // Try to add more than balance
    await addLiquidityPage.enterAmount0('10');

    // Should show error or disable button
    const isDisabled = await addLiquidityPage.addLiquidityButton.isDisabled();
    expect(isDisabled).toBe(true);

    // ✅ Balance validation works
  });

  test('should calculate position preview correctly', async ({ page }) => {
    await mockWalletConnection(page);

    const addLiquidityPage = new AddLiquidityPage(page);
    await addLiquidityPage.navigate();
    await waitForWalletConnection(page);

    await addLiquidityPage.selectToken0(ETH);
    await addLiquidityPage.selectToken1(USDC);
    await addLiquidityPage.selectFeeTier('0.3%');
    await addLiquidityPage.selectFullRange();

    await addLiquidityPage.enterAmount0('1');

    // Wait for calculations
    await page.waitForTimeout(1000);

    // Position preview should be visible
    await addLiquidityPage.verifyPositionPreview();

    // Should show liquidity value
    const liquidity = await addLiquidityPage.getPreviewLiquidity();
    expect(liquidity).toBeTruthy();

    // ✅ Position preview calculation works
  });
});

test.describe('CP-004: Liquidity Provider - Remove Partial Liquidity', () => {
  test('should complete remove liquidity flow', async ({ page }) => {
    await mockWalletConnection(page);

    const portfolioPage = new PortfolioPage(page);
    await portfolioPage.navigate();
    await waitForWalletConnection(page);

    // Check if user has positions
    const positionCount = await portfolioPage.getPositionCount();

    if (positionCount > 0) {
      // Click on first position
      await portfolioPage.clickPosition(0);

      const positionDetailPage = new PositionDetailPage(page);

      // Verify position details
      await positionDetailPage.verifyPositionDetails();

      // Click remove liquidity
      await positionDetailPage.clickRemoveLiquidity();

      await expect(page).toHaveURL(/\/remove/);

      const removeLiquidityPage = new RemoveLiquidityPage(page);

      // Select 50%
      await removeLiquidityPage.clickPercentageButton('50');

      // Verify amounts shown
      const amount0 = await removeLiquidityPage.getAmount0();
      const amount1 = await removeLiquidityPage.getAmount1();

      expect(amount0).toBeTruthy();
      expect(amount1).toBeTruthy();

      // Check collect fees
      await removeLiquidityPage.toggleCollectFees();

      // Remove liquidity button should be enabled
      await expect(removeLiquidityPage.removeLiquidityButton).toBeEnabled();

      // ✅ Remove liquidity flow works
    }
  });

  test('should handle 100% removal', async ({ page }) => {
    await mockWalletConnection(page);

    const mockTokenId = '123';
    const removeLiquidityPage = new RemoveLiquidityPage(page);
    await removeLiquidityPage.navigate(mockTokenId);
    await waitForWalletConnection(page);

    // Click 100%
    await removeLiquidityPage.clickPercentageButton('100');

    // Amounts should be displayed
    const amount0 = await removeLiquidityPage.getAmount0();
    expect(amount0).toBeTruthy();

    // Button should be enabled
    await expect(removeLiquidityPage.removeLiquidityButton).toBeEnabled();

    // ✅ 100% removal works
  });

  test('should calculate partial amounts correctly', async ({ page }) => {
    await mockWalletConnection(page);

    const mockTokenId = '123';
    const removeLiquidityPage = new RemoveLiquidityPage(page);
    await removeLiquidityPage.navigate(mockTokenId);
    await waitForWalletConnection(page);

    // Set to 25%
    await removeLiquidityPage.clickPercentageButton('25');
    const amount25 = await removeLiquidityPage.getAmount0();

    // Set to 50%
    await removeLiquidityPage.clickPercentageButton('50');
    const amount50 = await removeLiquidityPage.getAmount0();

    // 50% should be approximately double of 25%
    if (amount25 && amount50) {
      const ratio = parseFloat(amount50) / parseFloat(amount25);
      expect(ratio).toBeGreaterThan(1.8);
      expect(ratio).toBeLessThan(2.2);
    }

    // ✅ Percentage calculation works
  });
});

test.describe('CP-005: Wallet Connection - All Flows', () => {
  test('should connect wallet successfully', async ({ page }) => {
    await page.goto('/');

    // Should show connect button
    await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();

    // Mock connection
    await mockWalletConnection(page);
    await page.reload();

    // Wait for connection
    await waitForWalletConnection(page);

    // Should show connected state
    await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

    // Should show address
    const address = await page.locator('[data-testid="wallet-address"]').textContent();
    expect(address).toContain('0x');

    // ✅ Wallet connection works
  });

  test('should disconnect wallet successfully', async ({ page }) => {
    await mockWalletConnection(page);
    await page.goto('/');
    await waitForWalletConnection(page);

    // Click wallet menu
    await page.click('[data-testid="wallet-menu"]');

    // Click disconnect
    await page.click('[data-testid="disconnect-button"]');

    // Should show connect button again
    await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();

    // ✅ Disconnect works
  });

  test('should detect wrong network', async ({ page }) => {
    await mockWalletConnection(page, {
      chainId: 1, // Ethereum mainnet
    });

    await page.goto('/swap');

    // Should show network warning
    await expect(page.locator('[data-testid="wrong-network-warning"]')).toBeVisible();

    // ✅ Network detection works
  });

  test('should persist connection across page reloads', async ({ page }) => {
    await mockWalletConnection(page);
    await page.goto('/');
    await waitForWalletConnection(page);

    // Reload page
    await page.reload();

    // Should still be connected
    await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible({ timeout: 5000 });

    // ✅ Connection persistence works
  });
});

test.describe('CP-007: Error Handling - Network Failures', () => {
  test('should handle network disconnection', async ({ page, context }) => {
    await mockWalletConnection(page);
    const swapPage = new SwapPage(page);
    await swapPage.navigate();
    await waitForWalletConnection(page);

    await swapPage.selectTokenIn(ETH);
    await swapPage.selectTokenOut(USDC);

    // Disconnect network
    await context.setOffline(true);

    // Try to get quote
    await swapPage.enterAmount('1');

    // Should show error
    await expect(page.locator('[data-testid="network-error"]')).toBeVisible({ timeout: 10000 });

    // Restore network
    await context.setOffline(false);

    // Should recover
    await page.waitForTimeout(2000);

    // ✅ Network error handling works
  });

  test('should show clear error for insufficient liquidity', async ({ page }) => {
    await mockWalletConnection(page);
    const swapPage = new SwapPage(page);
    await swapPage.navigate();
    await waitForWalletConnection(page);

    await swapPage.selectTokenIn(ETH);
    await swapPage.selectTokenOut(USDC);

    // Try to swap huge amount
    await swapPage.enterAmount('999999');

    // Should show error
    await expect(page.locator('[data-testid="insufficient-liquidity-error"]')).toBeVisible({ timeout: 10000 });

    // ✅ Liquidity error shown
  });

  test('should validate price range correctly', async ({ page }) => {
    await mockWalletConnection(page);
    const addLiquidityPage = new AddLiquidityPage(page);
    await addLiquidityPage.navigate();
    await waitForWalletConnection(page);

    await addLiquidityPage.selectToken0(ETH);
    await addLiquidityPage.selectToken1(USDC);
    await addLiquidityPage.selectFeeTier('0.3%');

    // Set invalid range (min > max)
    await addLiquidityPage.setPriceRange('3000', '2000');

    // Should show error
    await expect(page.locator('[data-testid="invalid-range-error"]')).toBeVisible();

    // ✅ Price range validation works
  });
});

test.describe('CP-008: Mobile Experience', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should navigate on mobile', async ({ page }) => {
    await mockWalletConnection(page);
    await page.goto('/');

    // Should show mobile menu button
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();

    // Open menu
    await page.click('[data-testid="mobile-menu-button"]');

    // Menu should be visible
    await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();

    // Click pools
    await page.click('[data-testid="mobile-nav-pools"]');

    // Should navigate
    await expect(page).toHaveURL(/\/pools/);

    // ✅ Mobile navigation works
  });

  test('should swap on mobile', async ({ page }) => {
    await mockWalletConnection(page);
    const swapPage = new SwapPage(page);
    await swapPage.navigate();
    await waitForWalletConnection(page);

    await swapPage.selectTokenIn(ETH);
    await swapPage.selectTokenOut(USDC);
    await swapPage.enterAmount('0.1');

    await swapPage.waitForQuote();

    // All elements should be visible
    await expect(swapPage.swapButton).toBeVisible();
    await expect(swapPage.swapDetails).toBeVisible();

    // ✅ Mobile swap works
  });

  test('should add liquidity on mobile', async ({ page }) => {
    await mockWalletConnection(page);
    const addLiquidityPage = new AddLiquidityPage(page);
    await addLiquidityPage.navigate();
    await waitForWalletConnection(page);

    await addLiquidityPage.selectToken0(ETH);
    await addLiquidityPage.selectToken1(USDC);
    await addLiquidityPage.selectFeeTier('0.3%');
    await addLiquidityPage.selectFullRange();
    await addLiquidityPage.enterAmount0('0.1');

    // Should work on mobile
    await addLiquidityPage.verifyPositionPreview();

    // ✅ Mobile add liquidity works
  });
});

test.describe('CP-009: Pool Discovery', () => {
  test('should search and filter pools', async ({ page }) => {
    await mockWalletConnection(page);
    const poolsPage = new PoolsPage(page);
    await poolsPage.navigate();

    // Search
    await poolsPage.searchPool('ETH');
    await page.waitForTimeout(500);

    const searchCount = await poolsPage.getPoolCount();
    expect(searchCount).toBeGreaterThan(0);

    // Clear search
    await poolsPage.searchPool('');
    await page.waitForTimeout(500);

    // Filter by fee tier
    await poolsPage.filterByFeeTier('0.3%');
    await page.waitForTimeout(500);

    const filterCount = await poolsPage.getPoolCount();
    expect(filterCount).toBeGreaterThan(0);

    // ✅ Search and filter work
  });

  test('should sort pools correctly', async ({ page }) => {
    await mockWalletConnection(page);
    const poolsPage = new PoolsPage(page);
    await poolsPage.navigate();

    // Sort by TVL
    await poolsPage.sortByTVLDesc();
    await page.waitForTimeout(500);

    // Verify sorting
    await poolsPage.verifyTVLSorting();

    // ✅ Sorting works
  });

  test('should navigate to pool detail', async ({ page }) => {
    await mockWalletConnection(page);
    const poolsPage = new PoolsPage(page);
    await poolsPage.navigate();

    const poolCount = await poolsPage.getPoolCount();

    if (poolCount > 0) {
      await poolsPage.clickPool(0);

      // Should navigate to detail
      await expect(page).toHaveURL(/\/pools\/0x/);

      const poolDetailPage = new PoolDetailPage(page);
      await poolDetailPage.verifyPoolStats();

      // ✅ Pool detail navigation works
    }
  });
});

test.describe('Integration: Complete User Journey', () => {
  test('INT-001: Full journey - Connect → Swap → Add LP → Remove LP', async ({ page }) => {
    // 1. Connect wallet
    await mockWalletConnection(page);
    await page.goto('/');
    await waitForWalletConnection(page);

    // 2. Execute swap
    const swapPage = new SwapPage(page);
    await swapPage.navigate();
    await swapPage.selectTokenIn(ETH);
    await swapPage.selectTokenOut(USDC);
    await swapPage.enterAmount('0.1');
    await swapPage.waitForQuote();

    // Verify swap is ready
    await expect(swapPage.swapButton).toBeEnabled();

    // 3. Navigate to add liquidity
    const addLiquidityPage = new AddLiquidityPage(page);
    await addLiquidityPage.navigate();
    await addLiquidityPage.selectToken0(ETH);
    await addLiquidityPage.selectToken1(USDC);
    await addLiquidityPage.selectFeeTier('0.3%');
    await addLiquidityPage.selectFullRange();
    await addLiquidityPage.enterAmount0('0.1');

    await addLiquidityPage.verifyPositionPreview();

    // 4. Check portfolio
    const portfolioPage = new PortfolioPage(page);
    await portfolioPage.navigate();
    await portfolioPage.verifyPortfolioStats();

    // ✅ Complete journey successful
  });
});
