import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { Token } from '../fixtures/tokens';

/**
 * Swap page object
 */
export class SwapPage extends BasePage {
  // Selectors
  readonly tokenInButton: Locator;
  readonly tokenOutButton: Locator;
  readonly tokenInInput: Locator;
  readonly tokenOutInput: Locator;
  readonly swapButton: Locator;
  readonly settingsButton: Locator;
  readonly slippageInput: Locator;
  readonly switchTokensButton: Locator;
  readonly swapDetails: Locator;
  readonly priceImpactWarning: Locator;
  readonly approveButton: Locator;

  constructor(page: Page) {
    super(page);
    this.tokenInButton = page.locator('[data-testid="token-in-select"]');
    this.tokenOutButton = page.locator('[data-testid="token-out-select"]');
    this.tokenInInput = page.locator('[data-testid="token-in-amount"]');
    this.tokenOutInput = page.locator('[data-testid="token-out-amount"]');
    this.swapButton = page.locator('[data-testid="swap-button"]');
    this.settingsButton = page.locator('[data-testid="swap-settings"]');
    this.slippageInput = page.locator('[data-testid="slippage-input"]');
    this.switchTokensButton = page.locator('[data-testid="switch-tokens"]');
    this.swapDetails = page.locator('[data-testid="swap-details"]');
    this.priceImpactWarning = page.locator('[data-testid="price-impact-warning"]');
    this.approveButton = page.locator('[data-testid="approve-button"]');
  }

  /**
   * Navigate to swap page
   */
  async navigate(): Promise<void> {
    await this.goto('/swap');
  }

  /**
   * Select token in
   */
  async selectTokenIn(token: Token): Promise<void> {
    await this.tokenInButton.click();
    await this.page.locator(`[data-testid="token-${token.address}"]`).click();
    await expect(this.tokenInButton).toContainText(token.symbol);
  }

  /**
   * Select token out
   */
  async selectTokenOut(token: Token): Promise<void> {
    await this.tokenOutButton.click();
    await this.page.locator(`[data-testid="token-${token.address}"]`).click();
    await expect(this.tokenOutButton).toContainText(token.symbol);
  }

  /**
   * Enter amount to swap
   */
  async enterAmount(amount: string): Promise<void> {
    await this.tokenInInput.fill(amount);
    // Wait for quote to load
    await this.waitForQuote();
  }

  /**
   * Wait for quote to be calculated
   */
  async waitForQuote(): Promise<void> {
    await this.page.waitForSelector('[data-testid="quote-loading"]', {
      state: 'hidden',
      timeout: 10000,
    });
    await expect(this.tokenOutInput).not.toHaveValue('');
  }

  /**
   * Switch token positions
   */
  async switchTokens(): Promise<void> {
    await this.switchTokensButton.click();
  }

  /**
   * Open settings modal
   */
  async openSettings(): Promise<void> {
    await this.settingsButton.click();
    await this.page.waitForSelector('[data-testid="settings-modal"]');
  }

  /**
   * Set slippage tolerance
   */
  async setSlippage(slippage: string): Promise<void> {
    await this.openSettings();
    await this.slippageInput.fill(slippage);
    await this.page.keyboard.press('Escape');
  }

  /**
   * Get output amount
   */
  async getOutputAmount(): Promise<string> {
    return (await this.tokenOutInput.inputValue()) || '';
  }

  /**
   * Get execution price
   */
  async getExecutionPrice(): Promise<string> {
    const priceElement = this.page.locator('[data-testid="execution-price"]');
    return (await priceElement.textContent()) || '';
  }

  /**
   * Get price impact
   */
  async getPriceImpact(): Promise<string> {
    const impactElement = this.page.locator('[data-testid="price-impact"]');
    return (await impactElement.textContent()) || '';
  }

  /**
   * Check if approval is needed
   */
  async isApprovalNeeded(): Promise<boolean> {
    return await this.approveButton.isVisible();
  }

  /**
   * Approve token
   */
  async approve(): Promise<void> {
    await this.approveButton.click();
    await this.page.waitForSelector('[data-testid="approval-pending"]');
    await this.page.waitForSelector('[data-testid="approval-success"]', {
      timeout: 30000,
    });
  }

  /**
   * Execute swap
   */
  async swap(): Promise<void> {
    await this.swapButton.click();

    // Wait for confirmation modal
    await this.page.waitForSelector('[data-testid="swap-confirm-modal"]');

    // Confirm swap
    await this.page.locator('[data-testid="confirm-swap-button"]').click();

    // Wait for transaction to be submitted
    await this.page.waitForSelector('[data-testid="tx-pending"]');
  }

  /**
   * Wait for swap to complete
   */
  async waitForSwapComplete(): Promise<void> {
    await this.page.waitForSelector('[data-testid="tx-success"]', {
      timeout: 60000,
    });
  }

  /**
   * Check if swap button is disabled
   */
  async isSwapButtonDisabled(): Promise<boolean> {
    return await this.swapButton.isDisabled();
  }

  /**
   * Get swap button text
   */
  async getSwapButtonText(): Promise<string> {
    return (await this.swapButton.textContent()) || '';
  }

  /**
   * Check if price impact warning is visible
   */
  async hasPriceImpactWarning(): Promise<boolean> {
    return await this.priceImpactWarning.isVisible();
  }

  /**
   * Perform complete swap flow
   */
  async performSwap(
    tokenIn: Token,
    tokenOut: Token,
    amount: string,
    options: {
      approve?: boolean;
      slippage?: string;
    } = {}
  ): Promise<void> {
    await this.selectTokenIn(tokenIn);
    await this.selectTokenOut(tokenOut);

    if (options.slippage) {
      await this.setSlippage(options.slippage);
    }

    await this.enterAmount(amount);

    if (options.approve && (await this.isApprovalNeeded())) {
      await this.approve();
    }

    await this.swap();
    await this.waitForSwapComplete();
  }

  /**
   * Check for error message
   */
  async expectError(message: string): Promise<void> {
    await expect(
      this.page.locator('[data-testid="swap-error"]', { hasText: message })
    ).toBeVisible();
  }

  /**
   * Verify swap details are displayed
   */
  async verifySwapDetails(): Promise<void> {
    await expect(this.swapDetails).toBeVisible();
    await expect(this.page.locator('[data-testid="execution-price"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="price-impact"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="route-info"]')).toBeVisible();
  }
}
