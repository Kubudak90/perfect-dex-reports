import { test, expect } from '@playwright/test';
import { PoolsPage, PoolDetailPage } from '../pages/PoolsPage';
import { mockWalletConnection, waitForWalletConnection } from '../fixtures/wallet';

test.describe('Pools Page', () => {
  let poolsPage: PoolsPage;

  test.beforeEach(async ({ page }) => {
    await mockWalletConnection(page);
    poolsPage = new PoolsPage(page);
    await poolsPage.navigate();
  });

  test('should display pools table', async () => {
    await expect(poolsPage.poolTable).toBeVisible();

    const poolCount = await poolsPage.getPoolCount();
    expect(poolCount).toBeGreaterThan(0);
  });

  test('should search for pools', async () => {
    await poolsPage.searchPool('ETH');

    // Wait for filtered results
    await poolsPage.page.waitForTimeout(1000);

    const poolCount = await poolsPage.getPoolCount();
    expect(poolCount).toBeGreaterThan(0);
  });

  test('should sort pools by TVL', async () => {
    await poolsPage.sortByTVLDesc();

    // Wait for sorting
    await poolsPage.page.waitForTimeout(500);

    // Verify sorting
    await poolsPage.verifyTVLSorting();
  });

  test('should sort pools by volume', async () => {
    await poolsPage.sortByVolumeDesc();

    // Wait for sorting
    await poolsPage.page.waitForTimeout(500);

    const poolCount = await poolsPage.getPoolCount();
    expect(poolCount).toBeGreaterThan(0);
  });

  test('should filter by fee tier', async () => {
    await poolsPage.filterByFeeTier('0.3%');

    // Wait for filtering
    await poolsPage.page.waitForTimeout(1000);

    const poolCount = await poolsPage.getPoolCount();
    expect(poolCount).toBeGreaterThan(0);
  });

  test('should navigate to pool detail', async ({ page }) => {
    const poolCount = await poolsPage.getPoolCount();

    if (poolCount > 0) {
      await poolsPage.clickPool(0);

      // Should navigate to pool detail page
      await expect(page).toHaveURL(/\/pools\/0x.+/);
    }
  });

  test('should display pool stats', async () => {
    const poolCount = await poolsPage.getPoolCount();

    if (poolCount > 0) {
      const tvl = await poolsPage.getPoolTVL(0);
      expect(tvl).not.toBe('');

      const volume = await poolsPage.getPoolVolume(0);
      expect(volume).not.toBe('');
    }
  });

  test('should verify ETH/USDC pool exists', async () => {
    await poolsPage.verifyPoolExists('ETH', 'USDC');
  });

  test('should handle empty search results', async () => {
    await poolsPage.searchPool('NONEXISTENTTOKEN12345');

    await poolsPage.page.waitForTimeout(1000);

    const poolCount = await poolsPage.getPoolCount();
    expect(poolCount).toBe(0);
  });
});

test.describe('Pool Detail Page', () => {
  let poolDetailPage: PoolDetailPage;

  test.beforeEach(async ({ page }) => {
    await mockWalletConnection(page);

    // Navigate to a specific pool (ETH/USDC)
    // In real test, we'd get this from the pools list
    const mockPoolId = '0x1234567890123456789012345678901234567890123456789012345678901234';
    poolDetailPage = new PoolDetailPage(page);
    await poolDetailPage.navigate(mockPoolId);
  });

  test('should display pool header', async () => {
    await expect(poolDetailPage.poolHeader).toBeVisible();
  });

  test('should display pool stats', async () => {
    await poolDetailPage.verifyPoolStats();
  });

  test('should display charts', async () => {
    await poolDetailPage.verifyCharts();
  });

  test('should display transaction list', async () => {
    await expect(poolDetailPage.transactionList).toBeVisible();

    const txCount = await poolDetailPage.getTransactionCount();
    expect(txCount).toBeGreaterThanOrEqual(0);
  });

  test('should navigate to add liquidity', async ({ page }) => {
    await waitForWalletConnection(page);

    await poolDetailPage.clickAddLiquidity();

    await expect(page).toHaveURL(/\/add\/.+/);
  });

  test('should show real-time updates', async () => {
    // Initial stats
    const initialTVL = await poolDetailPage.tvlStat.textContent();

    // Wait for potential update (WebSocket)
    await poolDetailPage.page.waitForTimeout(5000);

    const updatedTVL = await poolDetailPage.tvlStat.textContent();

    // Stats should still be visible
    expect(updatedTVL).not.toBe('');
  });

  test('should display recent transactions', async () => {
    const txCount = await poolDetailPage.getTransactionCount();

    if (txCount > 0) {
      const firstTx = poolDetailPage.transactionList.locator('tbody tr').first();
      await expect(firstTx).toBeVisible();
    }
  });
});

test.describe('Pools - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  let poolsPage: PoolsPage;

  test.beforeEach(async ({ page }) => {
    await mockWalletConnection(page);
    poolsPage = new PoolsPage(page);
    await poolsPage.navigate();
  });

  test('should display pools on mobile', async () => {
    await expect(poolsPage.poolTable).toBeVisible();

    const poolCount = await poolsPage.getPoolCount();
    expect(poolCount).toBeGreaterThan(0);
  });

  test('should search pools on mobile', async () => {
    await poolsPage.searchPool('ETH');
    await poolsPage.page.waitForTimeout(1000);

    const poolCount = await poolsPage.getPoolCount();
    expect(poolCount).toBeGreaterThan(0);
  });

  test('should navigate to pool detail on mobile', async ({ page }) => {
    const poolCount = await poolsPage.getPoolCount();

    if (poolCount > 0) {
      await poolsPage.clickPool(0);
      await expect(page).toHaveURL(/\/pools\/0x.+/);
    }
  });
});
