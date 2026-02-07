import { Page } from '@playwright/test';

/**
 * Test utilities and helpers
 */

/**
 * Wait for element with retry
 */
export async function waitForElementWithRetry(
  page: Page,
  selector: string,
  options: {
    timeout?: number;
    retries?: number;
    state?: 'visible' | 'hidden' | 'attached' | 'detached';
  } = {}
): Promise<void> {
  const { timeout = 5000, retries = 3, state = 'visible' } = options;

  for (let i = 0; i < retries; i++) {
    try {
      await page.waitForSelector(selector, { timeout, state });
      return;
    } catch (error) {
      if (i === retries - 1) {
        throw error;
      }
      await page.waitForTimeout(1000);
    }
  }
}

/**
 * Take screenshot on failure
 */
export async function takeScreenshotOnFailure(
  page: Page,
  testName: string
): Promise<void> {
  const sanitizedName = testName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  await page.screenshot({
    path: `test-results/screenshots/${sanitizedName}-${Date.now()}.png`,
    fullPage: true,
  });
}

/**
 * Clear all cookies
 */
export async function clearAllCookies(page: Page): Promise<void> {
  await page.context().clearCookies();
}

/**
 * Clear local storage
 */
export async function clearLocalStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
  });
}

/**
 * Clear session storage
 */
export async function clearSessionStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    sessionStorage.clear();
  });
}

/**
 * Clear all storage
 */
export async function clearAllStorage(page: Page): Promise<void> {
  await clearAllCookies(page);
  await clearLocalStorage(page);
  await clearSessionStorage(page);
}

/**
 * Get local storage item
 */
export async function getLocalStorageItem(
  page: Page,
  key: string
): Promise<string | null> {
  return await page.evaluate((key) => {
    return localStorage.getItem(key);
  }, key);
}

/**
 * Set local storage item
 */
export async function setLocalStorageItem(
  page: Page,
  key: string,
  value: string
): Promise<void> {
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    { key, value }
  );
}

/**
 * Wait for network idle
 */
export async function waitForNetworkIdle(
  page: Page,
  timeout: number = 5000
): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Wait for WebSocket connection
 */
export async function waitForWebSocketConnection(
  page: Page,
  timeout: number = 10000
): Promise<void> {
  await page.evaluate(
    ({ timeout }) => {
      return new Promise<void>((resolve, reject) => {
        const checkInterval = 100;
        let elapsed = 0;

        const check = () => {
          // Check if WebSocket is connected
          const ws = (window as any).__WS__;
          if (ws && ws.readyState === WebSocket.OPEN) {
            resolve();
          } else if (elapsed >= timeout) {
            reject(new Error('WebSocket connection timeout'));
          } else {
            elapsed += checkInterval;
            setTimeout(check, checkInterval);
          }
        };

        check();
      });
    },
    { timeout }
  );
}

/**
 * Mock API response
 */
export async function mockApiResponse(
  page: Page,
  url: string | RegExp,
  response: any
): Promise<void> {
  await page.route(url, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * Mock API error
 */
export async function mockApiError(
  page: Page,
  url: string | RegExp,
  statusCode: number = 500,
  error: string = 'Internal Server Error'
): Promise<void> {
  await page.route(url, (route) => {
    route.fulfill({
      status: statusCode,
      contentType: 'application/json',
      body: JSON.stringify({ error }),
    });
  });
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransactionConfirmation(
  page: Page,
  txHash: string,
  timeout: number = 60000
): Promise<void> {
  await page.waitForSelector(`[data-testid="tx-${txHash}-confirmed"]`, {
    timeout,
  });
}

/**
 * Generate random address
 */
export function generateRandomAddress(): string {
  const hex = '0123456789abcdef';
  let address = '0x';
  for (let i = 0; i < 40; i++) {
    address += hex[Math.floor(Math.random() * 16)];
  }
  return address;
}

/**
 * Generate random amount
 */
export function generateRandomAmount(min: number = 0.1, max: number = 10): string {
  const amount = Math.random() * (max - min) + min;
  return amount.toFixed(6);
}

/**
 * Format token amount
 */
export function formatTokenAmount(
  amount: string | bigint,
  decimals: number
): string {
  if (typeof amount === 'string') {
    amount = BigInt(amount);
  }

  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const remainder = amount % divisor;

  const remainderStr = remainder.toString().padStart(decimals, '0');

  return `${whole}.${remainderStr}`;
}

/**
 * Parse token amount
 */
export function parseTokenAmount(amount: string, decimals: number): bigint {
  const [whole, fraction = '0'] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  const amountStr = whole + paddedFraction;

  return BigInt(amountStr);
}

/**
 * Sleep for specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry operation
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: {
    retries?: number;
    delay?: number;
    exponentialBackoff?: boolean;
  } = {}
): Promise<T> {
  const { retries = 3, delay = 1000, exponentialBackoff = false } = options;

  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) {
        throw error;
      }

      const waitTime = exponentialBackoff ? delay * Math.pow(2, i) : delay;
      await sleep(waitTime);
    }
  }

  throw new Error('Retry failed');
}

/**
 * Check if element exists
 */
export async function elementExists(
  page: Page,
  selector: string
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: 1000, state: 'attached' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get element count
 */
export async function getElementCount(
  page: Page,
  selector: string
): Promise<number> {
  return await page.locator(selector).count();
}

/**
 * Scroll to element
 */
export async function scrollToElement(
  page: Page,
  selector: string
): Promise<void> {
  await page.locator(selector).scrollIntoViewIfNeeded();
}

/**
 * Fill input slowly (simulate typing)
 */
export async function fillInputSlowly(
  page: Page,
  selector: string,
  text: string,
  delay: number = 100
): Promise<void> {
  const input = page.locator(selector);
  await input.click();

  for (const char of text) {
    await input.type(char, { delay });
  }
}

/**
 * Wait for animation to complete
 */
export async function waitForAnimation(
  page: Page,
  duration: number = 500
): Promise<void> {
  await page.waitForTimeout(duration);
}

/**
 * Get console logs
 */
export function setupConsoleCapture(page: Page): string[] {
  const logs: string[] = [];

  page.on('console', (msg) => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });

  return logs;
}

/**
 * Get network requests
 */
export function setupNetworkCapture(page: Page): {
  requests: { url: string; method: string; postData?: string }[];
} {
  const requests: { url: string; method: string; postData?: string }[] = [];

  page.on('request', (request) => {
    requests.push({
      url: request.url(),
      method: request.method(),
      postData: request.postData() || undefined,
    });
  });

  return { requests };
}

/**
 * Assert URL matches pattern
 */
export async function assertUrlMatches(
  page: Page,
  pattern: string | RegExp
): Promise<void> {
  const url = page.url();

  if (typeof pattern === 'string') {
    if (!url.includes(pattern)) {
      throw new Error(`URL ${url} does not contain ${pattern}`);
    }
  } else {
    if (!pattern.test(url)) {
      throw new Error(`URL ${url} does not match ${pattern}`);
    }
  }
}
