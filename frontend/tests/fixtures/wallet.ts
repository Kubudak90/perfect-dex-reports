import { Page } from '@playwright/test';

/**
 * Mock wallet for E2E testing
 */
export interface MockWallet {
  address: string;
  balance: string;
  chainId: number;
  connected: boolean;
}

export const defaultWallet: MockWallet = {
  address: '0x1234567890123456789012345678901234567890',
  balance: '10',
  chainId: 8453, // Base
  connected: true,
};

/**
 * Mock wallet connection in browser
 */
export async function mockWalletConnection(
  page: Page,
  wallet: Partial<MockWallet> = {}
): Promise<void> {
  const mockWallet = { ...defaultWallet, ...wallet };

  await page.addInitScript((wallet) => {
    // Mock window.ethereum
    (window as any).ethereum = {
      isMetaMask: true,
      request: async ({ method }: { method: string }) => {
        switch (method) {
          case 'eth_requestAccounts':
            return [wallet.address];
          case 'eth_accounts':
            return [wallet.address];
          case 'eth_chainId':
            return `0x${wallet.chainId.toString(16)}`;
          case 'wallet_switchEthereumChain':
            return null;
          case 'eth_getBalance':
            return `0x${BigInt(
              (parseFloat(wallet.balance) * 1e18).toString()
            ).toString(16)}`;
          default:
            return null;
        }
      },
      on: () => {},
      removeListener: () => {},
      selectedAddress: wallet.address,
      chainId: `0x${wallet.chainId.toString(16)}`,
    };

    // Mock wagmi connectors
    (window as any).__MOCK_WALLET__ = wallet;
  }, mockWallet);
}

/**
 * Wait for wallet to be connected
 */
export async function waitForWalletConnection(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="wallet-connected"]', {
    timeout: 10000,
  });
}

/**
 * Disconnect wallet
 */
export async function disconnectWallet(page: Page): Promise<void> {
  await page.click('[data-testid="wallet-menu"]');
  await page.click('[data-testid="disconnect-button"]');
  await page.waitForSelector('[data-testid="connect-wallet-button"]');
}

/**
 * Switch network
 */
export async function switchNetwork(
  page: Page,
  chainId: number
): Promise<void> {
  await page.evaluate((chainId) => {
    if ((window as any).ethereum) {
      (window as any).ethereum.chainId = `0x${chainId.toString(16)}`;
      (window as any).ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    }
  }, chainId);
}
