import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { Token } from '../fixtures/tokens';

/**
 * Add Liquidity page object
 */
export class AddLiquidityPage extends BasePage {
  // Selectors
  readonly token0Button: Locator;
  readonly token1Button: Locator;
  readonly amount0Input: Locator;
  readonly amount1Input: Locator;
  readonly feeTierSelector: Locator;
  readonly minPriceInput: Locator;
  readonly maxPriceInput: Locator;
  readonly fullRangeButton: Locator;
  readonly presetButtons: Locator;
  readonly addLiquidityButton: Locator;
  readonly approveToken0Button: Locator;
  readonly approveToken1Button: Locator;
  readonly positionPreview: Locator;

  constructor(page: Page) {
    super(page);
    this.token0Button = page.locator('[data-testid="token0-select"]');
    this.token1Button = page.locator('[data-testid="token1-select"]');
    this.amount0Input = page.locator('[data-testid="amount0-input"]');
    this.amount1Input = page.locator('[data-testid="amount1-input"]');
    this.feeTierSelector = page.locator('[data-testid="fee-tier-selector"]');
    this.minPriceInput = page.locator('[data-testid="min-price-input"]');
    this.maxPriceInput = page.locator('[data-testid="max-price-input"]');
    this.fullRangeButton = page.locator('[data-testid="full-range-button"]');
    this.presetButtons = page.locator('[data-testid^="preset-"]');
    this.addLiquidityButton = page.locator('[data-testid="add-liquidity-button"]');
    this.approveToken0Button = page.locator('[data-testid="approve-token0"]');
    this.approveToken1Button = page.locator('[data-testid="approve-token1"]');
    this.positionPreview = page.locator('[data-testid="position-preview"]');
  }

  /**
   * Navigate to add liquidity page
   */
  async navigate(token0?: string, token1?: string): Promise<void> {
    const path = token0 && token1 ? `/add/${token0}/${token1}` : '/add';
    await this.goto(path);
  }

  /**
   * Select token 0
   */
  async selectToken0(token: Token): Promise<void> {
    await this.token0Button.click();
    await this.page.locator(`[data-testid="token-${token.address}"]`).click();
    await expect(this.token0Button).toContainText(token.symbol);
  }

  /**
   * Select token 1
   */
  async selectToken1(token: Token): Promise<void> {
    await this.token1Button.click();
    await this.page.locator(`[data-testid="token-${token.address}"]`).click();
    await expect(this.token1Button).toContainText(token.symbol);
  }

  /**
   * Select fee tier
   */
  async selectFeeTier(tier: '0.01%' | '0.05%' | '0.3%' | '1%'): Promise<void> {
    await this.feeTierSelector.click();
    await this.page.locator(`[data-testid="fee-tier-${tier}"]`).click();
  }

  /**
   * Enter amount for token 0
   */
  async enterAmount0(amount: string): Promise<void> {
    await this.amount0Input.fill(amount);
    // Wait for amount1 to be calculated
    await this.page.waitForTimeout(500);
  }

  /**
   * Enter amount for token 1
   */
  async enterAmount1(amount: string): Promise<void> {
    await this.amount1Input.fill(amount);
    // Wait for amount0 to be calculated
    await this.page.waitForTimeout(500);
  }

  /**
   * Set price range
   */
  async setPriceRange(minPrice: string, maxPrice: string): Promise<void> {
    await this.minPriceInput.fill(minPrice);
    await this.maxPriceInput.fill(maxPrice);
  }

  /**
   * Select full range
   */
  async selectFullRange(): Promise<void> {
    await this.fullRangeButton.click();
  }

  /**
   * Select preset range
   */
  async selectPreset(preset: 'narrow' | 'medium' | 'wide'): Promise<void> {
    await this.page.locator(`[data-testid="preset-${preset}"]`).click();
  }

  /**
   * Approve token 0
   */
  async approveToken0(): Promise<void> {
    await this.approveToken0Button.click();
    await this.page.waitForSelector('[data-testid="approve-token0-pending"]');
    await this.page.waitForSelector('[data-testid="approve-token0-success"]', {
      timeout: 30000,
    });
  }

  /**
   * Approve token 1
   */
  async approveToken1(): Promise<void> {
    await this.approveToken1Button.click();
    await this.page.waitForSelector('[data-testid="approve-token1-pending"]');
    await this.page.waitForSelector('[data-testid="approve-token1-success"]', {
      timeout: 30000,
    });
  }

  /**
   * Check if token0 approval is needed
   */
  async isToken0ApprovalNeeded(): Promise<boolean> {
    return await this.approveToken0Button.isVisible();
  }

  /**
   * Check if token1 approval is needed
   */
  async isToken1ApprovalNeeded(): Promise<boolean> {
    return await this.approveToken1Button.isVisible();
  }

  /**
   * Add liquidity
   */
  async addLiquidity(): Promise<void> {
    await this.addLiquidityButton.click();

    // Wait for confirmation modal
    await this.page.waitForSelector('[data-testid="add-liquidity-confirm-modal"]');

    // Confirm
    await this.page.locator('[data-testid="confirm-add-liquidity-button"]').click();

    // Wait for transaction
    await this.page.waitForSelector('[data-testid="tx-pending"]');
  }

  /**
   * Wait for liquidity addition to complete
   */
  async waitForAddComplete(): Promise<void> {
    await this.page.waitForSelector('[data-testid="tx-success"]', {
      timeout: 60000,
    });
  }

  /**
   * Get position preview liquidity
   */
  async getPreviewLiquidity(): Promise<string> {
    const liquidityElement = this.positionPreview.locator(
      '[data-testid="preview-liquidity"]'
    );
    return (await liquidityElement.textContent()) || '';
  }

  /**
   * Get estimated APR
   */
  async getEstimatedAPR(): Promise<string> {
    const aprElement = this.positionPreview.locator('[data-testid="estimated-apr"]');
    return (await aprElement.textContent()) || '';
  }

  /**
   * Verify position preview is displayed
   */
  async verifyPositionPreview(): Promise<void> {
    await expect(this.positionPreview).toBeVisible();
    await expect(
      this.positionPreview.locator('[data-testid="preview-liquidity"]')
    ).toBeVisible();
    await expect(
      this.positionPreview.locator('[data-testid="estimated-apr"]')
    ).toBeVisible();
  }

  /**
   * Complete add liquidity flow
   */
  async performAddLiquidity(
    token0: Token,
    token1: Token,
    amount0: string,
    feeTier: '0.01%' | '0.05%' | '0.3%' | '1%',
    options: {
      amount1?: string;
      priceRange?: { min: string; max: string };
      preset?: 'narrow' | 'medium' | 'wide';
      fullRange?: boolean;
    } = {}
  ): Promise<void> {
    await this.selectToken0(token0);
    await this.selectToken1(token1);
    await this.selectFeeTier(feeTier);

    if (options.fullRange) {
      await this.selectFullRange();
    } else if (options.preset) {
      await this.selectPreset(options.preset);
    } else if (options.priceRange) {
      await this.setPriceRange(options.priceRange.min, options.priceRange.max);
    }

    await this.enterAmount0(amount0);
    if (options.amount1) {
      await this.enterAmount1(options.amount1);
    }

    // Handle approvals
    if (await this.isToken0ApprovalNeeded()) {
      await this.approveToken0();
    }
    if (await this.isToken1ApprovalNeeded()) {
      await this.approveToken1();
    }

    await this.addLiquidity();
    await this.waitForAddComplete();
  }
}

/**
 * Remove Liquidity page object
 */
export class RemoveLiquidityPage extends BasePage {
  // Selectors
  readonly percentageSlider: Locator;
  readonly percentageButtons: Locator;
  readonly amount0Display: Locator;
  readonly amount1Display: Locator;
  readonly removeLiquidityButton: Locator;
  readonly collectFeesCheckbox: Locator;

  constructor(page: Page) {
    super(page);
    this.percentageSlider = page.locator('[data-testid="percentage-slider"]');
    this.percentageButtons = page.locator('[data-testid^="percentage-"]');
    this.amount0Display = page.locator('[data-testid="remove-amount0"]');
    this.amount1Display = page.locator('[data-testid="remove-amount1"]');
    this.removeLiquidityButton = page.locator(
      '[data-testid="remove-liquidity-button"]'
    );
    this.collectFeesCheckbox = page.locator('[data-testid="collect-fees-checkbox"]');
  }

  /**
   * Navigate to remove liquidity page
   */
  async navigate(tokenId: string): Promise<void> {
    await this.goto(`/remove/${tokenId}`);
  }

  /**
   * Set removal percentage
   */
  async setPercentage(percentage: number): Promise<void> {
    await this.percentageSlider.fill(percentage.toString());
  }

  /**
   * Click percentage button
   */
  async clickPercentageButton(percentage: '25' | '50' | '75' | '100'): Promise<void> {
    await this.page.locator(`[data-testid="percentage-${percentage}"]`).click();
  }

  /**
   * Toggle collect fees
   */
  async toggleCollectFees(): Promise<void> {
    await this.collectFeesCheckbox.click();
  }

  /**
   * Remove liquidity
   */
  async removeLiquidity(): Promise<void> {
    await this.removeLiquidityButton.click();

    // Wait for confirmation modal
    await this.page.waitForSelector('[data-testid="remove-liquidity-confirm-modal"]');

    // Confirm
    await this.page
      .locator('[data-testid="confirm-remove-liquidity-button"]')
      .click();

    // Wait for transaction
    await this.page.waitForSelector('[data-testid="tx-pending"]');
  }

  /**
   * Wait for removal to complete
   */
  async waitForRemoveComplete(): Promise<void> {
    await this.page.waitForSelector('[data-testid="tx-success"]', {
      timeout: 60000,
    });
  }

  /**
   * Get amount0 to receive
   */
  async getAmount0(): Promise<string> {
    return (await this.amount0Display.textContent()) || '';
  }

  /**
   * Get amount1 to receive
   */
  async getAmount1(): Promise<string> {
    return (await this.amount1Display.textContent()) || '';
  }

  /**
   * Perform complete remove liquidity flow
   */
  async performRemoveLiquidity(
    percentage: number,
    collectFees: boolean = false
  ): Promise<void> {
    await this.setPercentage(percentage);

    if (collectFees) {
      await this.toggleCollectFees();
    }

    await this.removeLiquidity();
    await this.waitForRemoveComplete();
  }
}
