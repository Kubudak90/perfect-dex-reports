import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Pools page object
 */
export class PoolsPage extends BasePage {
  // Selectors
  readonly poolTable: Locator;
  readonly searchInput: Locator;
  readonly sortByVolume: Locator;
  readonly sortByTVL: Locator;
  readonly sortByAPR: Locator;
  readonly feeTierFilter: Locator;

  constructor(page: Page) {
    super(page);
    this.poolTable = page.locator('[data-testid="pool-table"]');
    this.searchInput = page.locator('[data-testid="pool-search"]');
    this.sortByVolume = page.locator('[data-testid="sort-volume"]');
    this.sortByTVL = page.locator('[data-testid="sort-tvl"]');
    this.sortByAPR = page.locator('[data-testid="sort-apr"]');
    this.feeTierFilter = page.locator('[data-testid="fee-tier-filter"]');
  }

  /**
   * Navigate to pools page
   */
  async navigate(): Promise<void> {
    await this.goto('/pools');
  }

  /**
   * Search for a pool
   */
  async searchPool(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500); // Debounce
  }

  /**
   * Sort pools by volume
   */
  async sortByVolumeDesc(): Promise<void> {
    await this.sortByVolume.click();
  }

  /**
   * Sort pools by TVL
   */
  async sortByTVLDesc(): Promise<void> {
    await this.sortByTVL.click();
  }

  /**
   * Filter by fee tier
   */
  async filterByFeeTier(tier: '0.01%' | '0.05%' | '0.3%' | '1%'): Promise<void> {
    await this.feeTierFilter.click();
    await this.page.locator(`[data-testid="fee-tier-${tier}"]`).click();
  }

  /**
   * Get pool count
   */
  async getPoolCount(): Promise<number> {
    const rows = await this.poolTable.locator('tbody tr').count();
    return rows;
  }

  /**
   * Click on a pool by index
   */
  async clickPool(index: number): Promise<void> {
    await this.poolTable.locator('tbody tr').nth(index).click();
    await this.page.waitForURL(/\/pools\/0x.+/);
  }

  /**
   * Click on a pool by token pair
   */
  async clickPoolByPair(token0: string, token1: string): Promise<void> {
    const poolRow = this.page.locator(
      `[data-testid="pool-${token0}-${token1}"]`
    );
    await poolRow.click();
    await this.page.waitForURL(/\/pools\/0x.+/);
  }

  /**
   * Verify pool is displayed
   */
  async verifyPoolExists(token0: string, token1: string): Promise<void> {
    await expect(
      this.page.locator(`[data-testid="pool-${token0}-${token1}"]`)
    ).toBeVisible();
  }

  /**
   * Get pool TVL
   */
  async getPoolTVL(index: number): Promise<string> {
    const tvlCell = this.poolTable
      .locator('tbody tr')
      .nth(index)
      .locator('[data-testid="pool-tvl"]');
    return (await tvlCell.textContent()) || '';
  }

  /**
   * Get pool volume
   */
  async getPoolVolume(index: number): Promise<string> {
    const volumeCell = this.poolTable
      .locator('tbody tr')
      .nth(index)
      .locator('[data-testid="pool-volume"]');
    return (await volumeCell.textContent()) || '';
  }

  /**
   * Verify pools are sorted by TVL
   */
  async verifyTVLSorting(): Promise<void> {
    const tvlValues: number[] = [];
    const count = await this.getPoolCount();

    for (let i = 0; i < Math.min(count, 5); i++) {
      const tvlText = await this.getPoolTVL(i);
      const tvl = parseFloat(tvlText.replace(/[$,]/g, ''));
      tvlValues.push(tvl);
    }

    // Check descending order
    for (let i = 0; i < tvlValues.length - 1; i++) {
      expect(tvlValues[i]).toBeGreaterThanOrEqual(tvlValues[i + 1]);
    }
  }
}

/**
 * Pool detail page object
 */
export class PoolDetailPage extends BasePage {
  // Selectors
  readonly poolHeader: Locator;
  readonly tvlStat: Locator;
  readonly volumeStat: Locator;
  readonly feesStat: Locator;
  readonly aprStat: Locator;
  readonly addLiquidityButton: Locator;
  readonly priceChart: Locator;
  readonly liquidityChart: Locator;
  readonly transactionList: Locator;

  constructor(page: Page) {
    super(page);
    this.poolHeader = page.locator('[data-testid="pool-header"]');
    this.tvlStat = page.locator('[data-testid="pool-tvl"]');
    this.volumeStat = page.locator('[data-testid="pool-volume"]');
    this.feesStat = page.locator('[data-testid="pool-fees"]');
    this.aprStat = page.locator('[data-testid="pool-apr"]');
    this.addLiquidityButton = page.locator('[data-testid="add-liquidity-button"]');
    this.priceChart = page.locator('[data-testid="price-chart"]');
    this.liquidityChart = page.locator('[data-testid="liquidity-chart"]');
    this.transactionList = page.locator('[data-testid="transaction-list"]');
  }

  /**
   * Navigate to pool detail page
   */
  async navigate(poolId: string): Promise<void> {
    await this.goto(`/pools/${poolId}`);
  }

  /**
   * Click add liquidity button
   */
  async clickAddLiquidity(): Promise<void> {
    await this.addLiquidityButton.click();
    await this.page.waitForURL(/\/add\/.+/);
  }

  /**
   * Verify pool stats are displayed
   */
  async verifyPoolStats(): Promise<void> {
    await expect(this.tvlStat).toBeVisible();
    await expect(this.volumeStat).toBeVisible();
    await expect(this.feesStat).toBeVisible();
    await expect(this.aprStat).toBeVisible();
  }

  /**
   * Verify charts are displayed
   */
  async verifyCharts(): Promise<void> {
    await expect(this.priceChart).toBeVisible();
    await expect(this.liquidityChart).toBeVisible();
  }

  /**
   * Get transaction count
   */
  async getTransactionCount(): Promise<number> {
    return await this.transactionList.locator('tbody tr').count();
  }

  /**
   * Verify transaction appears
   */
  async verifyTransactionAppears(txHash: string): Promise<void> {
    await expect(
      this.transactionList.locator(`[data-testid="tx-${txHash}"]`)
    ).toBeVisible({ timeout: 30000 });
  }
}
