import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Portfolio page object
 */
export class PortfolioPage extends BasePage {
  // Selectors
  readonly positionsList: Locator;
  readonly swapHistoryList: Locator;
  readonly totalValueCard: Locator;
  readonly pnlCard: Locator;
  readonly feesEarnedCard: Locator;
  readonly tabPositions: Locator;
  readonly tabHistory: Locator;
  readonly filterOpen: Locator;
  readonly filterClosed: Locator;

  constructor(page: Page) {
    super(page);
    this.positionsList = page.locator('[data-testid="positions-list"]');
    this.swapHistoryList = page.locator('[data-testid="swap-history-list"]');
    this.totalValueCard = page.locator('[data-testid="total-value"]');
    this.pnlCard = page.locator('[data-testid="pnl-card"]');
    this.feesEarnedCard = page.locator('[data-testid="fees-earned"]');
    this.tabPositions = page.locator('[data-testid="tab-positions"]');
    this.tabHistory = page.locator('[data-testid="tab-history"]');
    this.filterOpen = page.locator('[data-testid="filter-open"]');
    this.filterClosed = page.locator('[data-testid="filter-closed"]');
  }

  /**
   * Navigate to portfolio page
   */
  async navigate(): Promise<void> {
    await this.goto('/portfolio');
  }

  /**
   * Switch to positions tab
   */
  async switchToPositions(): Promise<void> {
    await this.tabPositions.click();
  }

  /**
   * Switch to history tab
   */
  async switchToHistory(): Promise<void> {
    await this.tabHistory.click();
  }

  /**
   * Filter open positions
   */
  async filterOpenPositions(): Promise<void> {
    await this.filterOpen.click();
  }

  /**
   * Filter closed positions
   */
  async filterClosedPositions(): Promise<void> {
    await this.filterClosed.click();
  }

  /**
   * Get position count
   */
  async getPositionCount(): Promise<number> {
    return await this.positionsList.locator('[data-testid^="position-"]').count();
  }

  /**
   * Click on position by index
   */
  async clickPosition(index: number): Promise<void> {
    await this.positionsList
      .locator('[data-testid^="position-"]')
      .nth(index)
      .click();
    await this.page.waitForURL(/\/positions\/\d+/);
  }

  /**
   * Click on position by token ID
   */
  async clickPositionByTokenId(tokenId: string): Promise<void> {
    await this.page.locator(`[data-testid="position-${tokenId}"]`).click();
    await this.page.waitForURL(/\/positions\/\d+/);
  }

  /**
   * Get total portfolio value
   */
  async getTotalValue(): Promise<string> {
    return (await this.totalValueCard.textContent()) || '';
  }

  /**
   * Get total PnL
   */
  async getTotalPnL(): Promise<string> {
    return (await this.pnlCard.textContent()) || '';
  }

  /**
   * Get total fees earned
   */
  async getFeesEarned(): Promise<string> {
    return (await this.feesEarnedCard.textContent()) || '';
  }

  /**
   * Get swap history count
   */
  async getSwapHistoryCount(): Promise<number> {
    return await this.swapHistoryList.locator('[data-testid^="swap-"]').count();
  }

  /**
   * Verify position appears in list
   */
  async verifyPositionAppears(tokenId: string): Promise<void> {
    await expect(
      this.page.locator(`[data-testid="position-${tokenId}"]`)
    ).toBeVisible({ timeout: 30000 });
  }

  /**
   * Verify swap appears in history
   */
  async verifySwapInHistory(txHash: string): Promise<void> {
    await this.switchToHistory();
    await expect(
      this.swapHistoryList.locator(`[data-testid="swap-${txHash}"]`)
    ).toBeVisible({ timeout: 30000 });
  }

  /**
   * Verify portfolio stats are displayed
   */
  async verifyPortfolioStats(): Promise<void> {
    await expect(this.totalValueCard).toBeVisible();
    await expect(this.pnlCard).toBeVisible();
    await expect(this.feesEarnedCard).toBeVisible();
  }
}

/**
 * Position detail page object
 */
export class PositionDetailPage extends BasePage {
  // Selectors
  readonly positionHeader: Locator;
  readonly liquidityValue: Locator;
  readonly unclaimedFees: Locator;
  readonly currentValue: Locator;
  readonly pnlCard: Locator;
  readonly collectFeesButton: Locator;
  readonly increaseLiquidityButton: Locator;
  readonly removeLiquidityButton: Locator;
  readonly priceRangeChart: Locator;
  readonly positionHistory: Locator;

  constructor(page: Page) {
    super(page);
    this.positionHeader = page.locator('[data-testid="position-header"]');
    this.liquidityValue = page.locator('[data-testid="liquidity-value"]');
    this.unclaimedFees = page.locator('[data-testid="unclaimed-fees"]');
    this.currentValue = page.locator('[data-testid="current-value"]');
    this.pnlCard = page.locator('[data-testid="position-pnl"]');
    this.collectFeesButton = page.locator('[data-testid="collect-fees-button"]');
    this.increaseLiquidityButton = page.locator(
      '[data-testid="increase-liquidity-button"]'
    );
    this.removeLiquidityButton = page.locator(
      '[data-testid="remove-liquidity-button"]'
    );
    this.priceRangeChart = page.locator('[data-testid="price-range-chart"]');
    this.positionHistory = page.locator('[data-testid="position-history"]');
  }

  /**
   * Navigate to position detail page
   */
  async navigate(tokenId: string): Promise<void> {
    await this.goto(`/positions/${tokenId}`);
  }

  /**
   * Collect fees
   */
  async collectFees(): Promise<void> {
    await this.collectFeesButton.click();

    // Wait for confirmation modal
    await this.page.waitForSelector('[data-testid="collect-fees-confirm-modal"]');

    // Confirm
    await this.page.locator('[data-testid="confirm-collect-fees-button"]').click();

    // Wait for transaction
    await this.page.waitForSelector('[data-testid="tx-pending"]');
    await this.page.waitForSelector('[data-testid="tx-success"]', {
      timeout: 60000,
    });
  }

  /**
   * Click increase liquidity
   */
  async clickIncreaseLiquidity(): Promise<void> {
    await this.increaseLiquidityButton.click();
    await this.page.waitForURL(/\/increase\/.+/);
  }

  /**
   * Click remove liquidity
   */
  async clickRemoveLiquidity(): Promise<void> {
    await this.removeLiquidityButton.click();
    await this.page.waitForURL(/\/remove\/.+/);
  }

  /**
   * Get liquidity value
   */
  async getLiquidityValue(): Promise<string> {
    return (await this.liquidityValue.textContent()) || '';
  }

  /**
   * Get unclaimed fees
   */
  async getUnclaimedFees(): Promise<string> {
    return (await this.unclaimedFees.textContent()) || '';
  }

  /**
   * Get current value
   */
  async getCurrentValue(): Promise<string> {
    return (await this.currentValue.textContent()) || '';
  }

  /**
   * Get PnL
   */
  async getPnL(): Promise<string> {
    return (await this.pnlCard.textContent()) || '';
  }

  /**
   * Verify position details are displayed
   */
  async verifyPositionDetails(): Promise<void> {
    await expect(this.positionHeader).toBeVisible();
    await expect(this.liquidityValue).toBeVisible();
    await expect(this.currentValue).toBeVisible();
    await expect(this.pnlCard).toBeVisible();
  }

  /**
   * Verify price range chart is displayed
   */
  async verifyPriceRangeChart(): Promise<void> {
    await expect(this.priceRangeChart).toBeVisible();
  }

  /**
   * Check if position is in range
   */
  async isInRange(): Promise<boolean> {
    const inRangeBadge = this.page.locator('[data-testid="in-range-badge"]');
    return await inRangeBadge.isVisible();
  }

  /**
   * Get position history count
   */
  async getHistoryCount(): Promise<number> {
    return await this.positionHistory.locator('tbody tr').count();
  }
}
