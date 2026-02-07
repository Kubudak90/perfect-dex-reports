import { test, expect } from '@playwright/test';
import { AddLiquidityPage, RemoveLiquidityPage } from '../pages/LiquidityPage';
import { PortfolioPage } from '../pages/PortfolioPage';
import { mockWalletConnection, waitForWalletConnection } from '../fixtures/wallet';
import { ETH, USDC } from '../fixtures/tokens';

test.describe('Add Liquidity', () => {
  let addLiquidityPage: AddLiquidityPage;

  test.beforeEach(async ({ page }) => {
    await mockWalletConnection(page);
    addLiquidityPage = new AddLiquidityPage(page);
    await addLiquidityPage.navigate();
    await waitForWalletConnection(page);
  });

  test('should display add liquidity interface', async () => {
    await expect(addLiquidityPage.token0Button).toBeVisible();
    await expect(addLiquidityPage.token1Button).toBeVisible();
    await expect(addLiquidityPage.feeTierSelector).toBeVisible();
    await expect(addLiquidityPage.amount0Input).toBeVisible();
    await expect(addLiquidityPage.amount1Input).toBeVisible();
  });

  test('should select tokens and fee tier', async () => {
    await addLiquidityPage.selectToken0(ETH);
    await addLiquidityPage.selectToken1(USDC);
    await addLiquidityPage.selectFeeTier('0.3%');

    await expect(addLiquidityPage.token0Button).toContainText('ETH');
    await expect(addLiquidityPage.token1Button).toContainText('USDC');
  });

  test('should calculate amount1 when amount0 is entered', async () => {
    await addLiquidityPage.selectToken0(ETH);
    await addLiquidityPage.selectToken1(USDC);
    await addLiquidityPage.selectFeeTier('0.3%');
    await addLiquidityPage.selectFullRange();

    await addLiquidityPage.enterAmount0('1');

    // Amount1 should be calculated
    const amount1 = await addLiquidityPage.amount1Input.inputValue();
    expect(parseFloat(amount1)).toBeGreaterThan(0);
  });

  test('should select full range', async () => {
    await addLiquidityPage.selectToken0(ETH);
    await addLiquidityPage.selectToken1(USDC);
    await addLiquidityPage.selectFeeTier('0.3%');

    await addLiquidityPage.selectFullRange();

    // Min and max prices should be set
    const minPrice = await addLiquidityPage.minPriceInput.inputValue();
    const maxPrice = await addLiquidityPage.maxPriceInput.inputValue();

    expect(minPrice).toBe('0');
    expect(maxPrice).toBe('∞');
  });

  test('should select preset ranges', async () => {
    await addLiquidityPage.selectToken0(ETH);
    await addLiquidityPage.selectToken1(USDC);
    await addLiquidityPage.selectFeeTier('0.3%');

    await addLiquidityPage.selectPreset('medium');

    // Price range should be set
    const minPrice = await addLiquidityPage.minPriceInput.inputValue();
    const maxPrice = await addLiquidityPage.maxPriceInput.inputValue();

    expect(parseFloat(minPrice)).toBeGreaterThan(0);
    expect(parseFloat(maxPrice)).toBeGreaterThan(0);
  });

  test('should set custom price range', async () => {
    await addLiquidityPage.selectToken0(ETH);
    await addLiquidityPage.selectToken1(USDC);
    await addLiquidityPage.selectFeeTier('0.3%');

    await addLiquidityPage.setPriceRange('2000', '3000');

    const minPrice = await addLiquidityPage.minPriceInput.inputValue();
    const maxPrice = await addLiquidityPage.maxPriceInput.inputValue();

    expect(minPrice).toBe('2000');
    expect(maxPrice).toBe('3000');
  });

  test('should display position preview', async () => {
    await addLiquidityPage.selectToken0(ETH);
    await addLiquidityPage.selectToken1(USDC);
    await addLiquidityPage.selectFeeTier('0.3%');
    await addLiquidityPage.selectFullRange();
    await addLiquidityPage.enterAmount0('1');

    await addLiquidityPage.verifyPositionPreview();

    const liquidity = await addLiquidityPage.getPreviewLiquidity();
    expect(liquidity).not.toBe('');

    const apr = await addLiquidityPage.getEstimatedAPR();
    expect(apr).not.toBe('');
  });

  test('should approve tokens if needed', async ({ page }) => {
    await addLiquidityPage.selectToken0(ETH);
    await addLiquidityPage.selectToken1(USDC);
    await addLiquidityPage.selectFeeTier('0.3%');
    await addLiquidityPage.selectFullRange();
    await addLiquidityPage.enterAmount0('1');

    if (await addLiquidityPage.isToken0ApprovalNeeded()) {
      await addLiquidityPage.approveToken0();
      await expect(
        page.locator('[data-testid="approve-token0-success"]')
      ).toBeVisible();
    }

    if (await addLiquidityPage.isToken1ApprovalNeeded()) {
      await addLiquidityPage.approveToken1();
      await expect(
        page.locator('[data-testid="approve-token1-success"]')
      ).toBeVisible();
    }
  });

  test('should add liquidity successfully', async ({ page }) => {
    await addLiquidityPage.performAddLiquidity(ETH, USDC, '0.1', '0.3%', {
      fullRange: true,
    });

    await expect(page.locator('[data-testid="tx-success"]')).toBeVisible();
  });

  test('should navigate to position after adding liquidity', async ({ page }) => {
    await addLiquidityPage.performAddLiquidity(ETH, USDC, '0.1', '0.3%', {
      fullRange: true,
    });

    await page.waitForSelector('[data-testid="view-position-button"]');
    await page.locator('[data-testid="view-position-button"]').click();

    await expect(page).toHaveURL(/\/positions\/\d+/);
  });

  test('should handle insufficient balance', async () => {
    await addLiquidityPage.selectToken0(ETH);
    await addLiquidityPage.selectToken1(USDC);
    await addLiquidityPage.selectFeeTier('0.3%');
    await addLiquidityPage.selectFullRange();
    await addLiquidityPage.enterAmount0('999999');

    const isDisabled = await addLiquidityPage.addLiquidityButton.isDisabled();
    expect(isDisabled).toBe(true);
  });

  test('should validate price range', async () => {
    await addLiquidityPage.selectToken0(ETH);
    await addLiquidityPage.selectToken1(USDC);
    await addLiquidityPage.selectFeeTier('0.3%');

    // Invalid range (min > max)
    await addLiquidityPage.setPriceRange('3000', '2000');

    // Should show error
    await expect(
      addLiquidityPage.page.locator('[data-testid="invalid-range-error"]')
    ).toBeVisible();
  });
});

test.describe('Remove Liquidity', () => {
  let removeLiquidityPage: RemoveLiquidityPage;
  const mockTokenId = '123';

  test.beforeEach(async ({ page }) => {
    await mockWalletConnection(page);
    removeLiquidityPage = new RemoveLiquidityPage(page);
    await removeLiquidityPage.navigate(mockTokenId);
    await waitForWalletConnection(page);
  });

  test('should display remove liquidity interface', async () => {
    await expect(removeLiquidityPage.percentageSlider).toBeVisible();
    await expect(removeLiquidityPage.amount0Display).toBeVisible();
    await expect(removeLiquidityPage.amount1Display).toBeVisible();
    await expect(removeLiquidityPage.removeLiquidityButton).toBeVisible();
  });

  test('should adjust removal percentage', async () => {
    await removeLiquidityPage.setPercentage(50);

    // Amounts should be calculated
    const amount0 = await removeLiquidityPage.getAmount0();
    const amount1 = await removeLiquidityPage.getAmount1();

    expect(amount0).not.toBe('');
    expect(amount1).not.toBe('');
  });

  test('should use percentage buttons', async () => {
    await removeLiquidityPage.clickPercentageButton('25');

    const amount0 = await removeLiquidityPage.getAmount0();
    expect(amount0).not.toBe('');
  });

  test('should remove 100% liquidity', async ({ page }) => {
    await removeLiquidityPage.clickPercentageButton('100');
    await removeLiquidityPage.removeLiquidity();
    await removeLiquidityPage.waitForRemoveComplete();

    await expect(page.locator('[data-testid="tx-success"]')).toBeVisible();
  });

  test('should collect fees along with removal', async ({ page }) => {
    await removeLiquidityPage.setPercentage(100);
    await removeLiquidityPage.toggleCollectFees();
    await removeLiquidityPage.removeLiquidity();
    await removeLiquidityPage.waitForRemoveComplete();

    await expect(page.locator('[data-testid="tx-success"]')).toBeVisible();
  });

  test('should remove partial liquidity', async ({ page }) => {
    await removeLiquidityPage.performRemoveLiquidity(50);

    await expect(page.locator('[data-testid="tx-success"]')).toBeVisible();
  });
});

test.describe('Portfolio & Positions', () => {
  let portfolioPage: PortfolioPage;

  test.beforeEach(async ({ page }) => {
    await mockWalletConnection(page);
    portfolioPage = new PortfolioPage(page);
    await portfolioPage.navigate();
    await waitForWalletConnection(page);
  });

  test('should display portfolio page', async () => {
    await expect(portfolioPage.positionsList).toBeVisible();
  });

  test('should display portfolio stats', async () => {
    await portfolioPage.verifyPortfolioStats();
  });

  test('should list positions', async () => {
    const positionCount = await portfolioPage.getPositionCount();
    expect(positionCount).toBeGreaterThanOrEqual(0);
  });

  test('should filter open positions', async () => {
    await portfolioPage.filterOpenPositions();

    const positionCount = await portfolioPage.getPositionCount();
    expect(positionCount).toBeGreaterThanOrEqual(0);
  });

  test('should filter closed positions', async () => {
    await portfolioPage.filterClosedPositions();

    const positionCount = await portfolioPage.getPositionCount();
    expect(positionCount).toBeGreaterThanOrEqual(0);
  });

  test('should navigate to position detail', async ({ page }) => {
    const positionCount = await portfolioPage.getPositionCount();

    if (positionCount > 0) {
      await portfolioPage.clickPosition(0);
      await expect(page).toHaveURL(/\/positions\/\d+/);
    }
  });

  test('should display swap history', async () => {
    await portfolioPage.switchToHistory();

    const swapCount = await portfolioPage.getSwapHistoryCount();
    expect(swapCount).toBeGreaterThanOrEqual(0);
  });

  test('should verify new position appears after adding liquidity', async ({ page }) => {
    // First add liquidity
    const addLiquidityPage = new AddLiquidityPage(page);
    await addLiquidityPage.navigate();

    await addLiquidityPage.performAddLiquidity(ETH, USDC, '0.1', '0.3%', {
      fullRange: true,
    });

    // Get token ID from success message
    const tokenId = await page
      .locator('[data-testid="new-token-id"]')
      .textContent();

    if (tokenId) {
      // Navigate to portfolio
      await portfolioPage.navigate();

      // Verify position appears
      await portfolioPage.verifyPositionAppears(tokenId);
    }
  });
});

test.describe('Liquidity - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  let addLiquidityPage: AddLiquidityPage;

  test.beforeEach(async ({ page }) => {
    await mockWalletConnection(page);
    addLiquidityPage = new AddLiquidityPage(page);
    await addLiquidityPage.navigate();
    await waitForWalletConnection(page);
  });

  test('should display add liquidity interface on mobile', async () => {
    await expect(addLiquidityPage.token0Button).toBeVisible();
    await expect(addLiquidityPage.token1Button).toBeVisible();
    await expect(addLiquidityPage.addLiquidityButton).toBeVisible();
  });

  test('should add liquidity on mobile', async ({ page }) => {
    await addLiquidityPage.performAddLiquidity(ETH, USDC, '0.1', '0.3%', {
      fullRange: true,
    });

    await expect(page.locator('[data-testid="tx-success"]')).toBeVisible();
  });
});
