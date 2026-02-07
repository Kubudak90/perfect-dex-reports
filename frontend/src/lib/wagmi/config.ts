import { createConfig, http } from 'wagmi';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';
import { SUPPORTED_CHAINS, DEFAULT_CHAIN, CHAIN_IDS } from '../constants/chains';

// Get environment variables
const walletConnectProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || '';

/**
 * wagmi configuration for BaseBook DEX
 * Supports Base, Arbitrum, and Optimism
 */
export const config = createConfig({
  chains: SUPPORTED_CHAINS,
  connectors: [
    injected({
      shimDisconnect: true,
    }),
    coinbaseWallet({
      appName: 'BaseBook DEX',
      appLogoUrl: 'https://basebook.exchange/logo.png',
    }),
    walletConnect({
      projectId: walletConnectProjectId,
      metadata: {
        name: 'BaseBook DEX',
        description: 'Next-generation decentralized exchange on Base',
        url: 'https://basebook.exchange',
        icons: ['https://basebook.exchange/logo.png'],
      },
      showQrModal: true,
    }),
  ],
  transports: {
    [CHAIN_IDS.BASE]: http(
      process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'
    ),
    [CHAIN_IDS.ARBITRUM]: http(
      process.env.NEXT_PUBLIC_ARB_RPC || 'https://arb1.arbitrum.io/rpc'
    ),
    [CHAIN_IDS.OPTIMISM]: http(
      process.env.NEXT_PUBLIC_OP_RPC || 'https://mainnet.optimism.io'
    ),
  },
  ssr: true,
});
