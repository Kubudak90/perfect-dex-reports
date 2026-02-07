# BaseBook DEX - Frontend

Next.js 14 frontend application for BaseBook DEX.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS + Radix UI
- **Web3**: wagmi v2 + viem + RainbowKit
- **State Management**: Zustand + TanStack Query
- **Testing**: Vitest + Playwright

## Getting Started

### Prerequisites

- **Node.js v20 (LTS)** - **REQUIRED** ⚠️
  - Node.js v24 is **not compatible** with Next.js 14
  - Use [nvm](https://github.com/nvm-sh/nvm) for easy version management
- npm or yarn

### Installation

```bash
# 1. Use the correct Node version (reads .nvmrc automatically)
nvm use

# If you don't have Node v20 installed:
# nvm install 20
# nvm use 20

# 2. Verify Node version
node --version
# Should show: v20.x.x

# 3. Install dependencies
npm install

# 4. Copy environment variables
cp .env.example .env.local

# 5. Update .env.local if needed (defaults are usually correct)
```

### Development

```bash
# Start development server
npm run dev

# Open http://localhost:3000 in your browser
```

**Note**: The frontend can run independently with mock data if the backend is not available.

### Available Scripts

```bash
# Development
npm run dev          # Start dev server (port 3000)
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Auto-fix lint issues
npm run typecheck    # Run TypeScript type checking

# Testing
npm test             # Run unit tests
npm run test:watch   # Run tests in watch mode
npm run test:e2e     # Run E2E tests with Playwright
```

## Project Structure

```
src/
├── app/                    # Next.js 14 App Router
│   ├── swap/              # Swap interface
│   ├── pools/             # Pool list and details
│   ├── add/               # Add liquidity
│   ├── remove/            # Remove liquidity
│   ├── positions/         # Position management
│   ├── portfolio/         # User portfolio
│   ├── analytics/         # Analytics dashboard
│   ├── governance/        # Governance proposals
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home (redirects to /swap)
│   └── providers.tsx      # All providers wrapper
│
├── components/
│   ├── ui/                # Primitive UI (Button, Input, Modal, etc.)
│   ├── swap/              # Swap widget components
│   ├── pool/              # Pool table, cards, charts
│   ├── liquidity/         # Add/remove liquidity forms
│   ├── portfolio/         # Portfolio components
│   ├── governance/        # Governance components
│   ├── analytics/         # Analytics charts and stats
│   ├── charts/            # Chart components (TradingView, etc.)
│   ├── layout/            # Header, Footer, Navigation
│   ├── wallet/            # Wallet connection components
│   └── common/            # Shared components
│
├── hooks/                 # Custom React hooks
│   ├── contracts/         # usePoolManager, useSwapRouter, etc.
│   ├── swap/              # useSwap, useSwapQuote, useSwapRoute
│   ├── pool/              # usePools, usePool, usePoolStats
│   ├── liquidity/         # useAddLiquidity, usePositions
│   ├── token/             # useToken, useTokenBalance, useTokenPrice
│   ├── analytics/         # useProtocolStats, useVolumeData
│   └── common/            # useWebSocket, useDebounce, etc.
│
├── lib/
│   ├── api/               # API client and endpoint functions
│   │   ├── client.ts      # HTTP client with error handling
│   │   ├── swap.ts        # Swap API functions
│   │   ├── pools.ts       # Pool API functions
│   │   └── tokens.ts      # Token API functions
│   ├── websocket/         # WebSocket client
│   │   └── client.ts      # WS with auto-reconnect
│   ├── constants/
│   │   ├── addresses.ts   # Contract addresses
│   │   ├── chains.ts      # Chain configurations
│   │   ├── tokens.ts      # Default token lists
│   │   └── abis/          # Contract ABIs
│   │       ├── PoolManager.ts
│   │       ├── SwapRouter.ts
│   │       ├── Quoter.ts
│   │       ├── PositionManager.ts
│   │       ├── ERC20.ts
│   │       ├── Permit2.ts
│   │       └── index.ts
│   ├── config/
│   │   └── api.ts         # API configuration
│   ├── utils/             # Utility functions
│   │   ├── format.ts      # Number/currency formatting
│   │   ├── math.ts        # BigInt math helpers
│   │   ├── price.ts       # Price calculations
│   │   └── validation.ts  # Input validation
│   └── wagmi/
│       ├── config.ts      # wagmi configuration
│       └── connectors.ts  # Wallet connectors
│
├── stores/                # Zustand state management
│   ├── useSwapStore.ts    # Swap state
│   ├── useTokenStore.ts   # Token state
│   ├── useSettingsStore.ts # User settings
│   └── useTransactionStore.ts # Pending transactions
│
├── types/                 # TypeScript types
│   ├── token.ts
│   ├── pool.ts
│   ├── swap.ts
│   ├── position.ts
│   └── api.ts
│
└── styles/
    ├── globals.css        # Global styles
    └── tailwind.css       # Tailwind imports
```

## Environment Variables

Key environment variables (see `.env.example` for complete list):

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/v1    # Backend API
NEXT_PUBLIC_WS_URL=ws://localhost:3000          # WebSocket for real-time updates

# Chain Configuration
NEXT_PUBLIC_DEFAULT_CHAIN_ID=8453               # Base mainnet

# Contract Addresses (Base Mainnet)
NEXT_PUBLIC_POOL_MANAGER=0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05
NEXT_PUBLIC_SWAP_ROUTER=0xFf438e2d528F55fD1141382D1eB436201552d1A5
NEXT_PUBLIC_QUOTER=0x3e3D0d2cC349F42825B5cF58fd34d3bDFE25404b
NEXT_PUBLIC_POSITION_MANAGER=0xCf31fbdBD7A44ba1bCF99642E64a1d0B56a372bA
NEXT_PUBLIC_PERMIT2=0x000000000022D473030F116dDEE9F6B43aC78BA3

# WalletConnect
NEXT_PUBLIC_WC_PROJECT_ID=placeholder_project_id  # Get from cloud.walletconnect.com

# RPC URLs
NEXT_PUBLIC_BASE_RPC=https://mainnet.base.org
NEXT_PUBLIC_BASE_SEPOLIA_RPC=https://sepolia.base.org
NEXT_PUBLIC_ARB_RPC=https://arb1.arbitrum.io/rpc
NEXT_PUBLIC_OP_RPC=https://mainnet.optimism.io
```

## Features

### Core Functionality ✅
- Token swaps with smart routing
- Add/remove concentrated liquidity
- NFT-based position management
- Real-time price updates via WebSocket
- Multi-chain support (Base, Arbitrum, Optimism)

### Integrations ✅
- **API Client**: REST API with graceful fallback to mock data
- **WebSocket**: Real-time updates with auto-reconnect
- **Contracts**: Direct on-chain interaction via wagmi v2
- **Wallet**: Multi-wallet support (MetaMask, WalletConnect, Coinbase, etc.)

## API Integration

The frontend uses a **graceful fallback strategy**:

1. **Primary**: Attempts to connect to backend API (port 3000)
2. **Fallback**: Uses mock data if backend is unavailable
3. **Logging**: Warns in console when using fallback mode

This allows frontend development to continue independently of backend availability.

### Available API Endpoints

```typescript
// Quote endpoint
POST /v1/swap/quote
{
  tokenIn: Address,
  tokenOut: Address,
  amountIn: string,
  slippage?: number,
  chainId?: number
}

// Pools endpoint
GET /v1/pools?chainId=8453&limit=100

// Token endpoints
GET /v1/tokens?chainId=8453
GET /v1/tokens/:address
```

### WebSocket Channels

```typescript
// Price updates (real-time)
subscribe: { channel: 'prices', chainId: 8453 }
message: { type: 'price_update', data: { token, price } }

// Swap notifications
subscribe: { channel: 'swaps', chainId: 8453 }
message: { type: 'swap', data: { poolId, txHash, ... } }

// Pool updates
subscribe: { channel: 'pools', chainId: 8453 }
message: { type: 'pool_update', data: { poolId, ... } }
```

## Troubleshooting

### Node.js Version Errors

**Error**: `TypeError: _semver.default.lt is not a function`

**Solution**:
```bash
# Check current version
node --version

# If v24.x, switch to v20
nvm install 20
nvm use 20

# Verify
node --version  # Should show v20.x.x

# Restart dev server
npm run dev
```

### Backend Connection Failed

If you see "Using mock quote data (backend unavailable)" in the console:

1. **Check backend is running**: `curl http://localhost:3000/v1/health`
2. **Verify .env.local**: `NEXT_PUBLIC_API_URL=http://localhost:3000/v1`
3. **Check port**: Backend should be on port 3000 (not 3001)

This is expected behavior - the frontend will work with mock data until the backend is available.

### Contract ABIs Missing

Some contract ABIs in `src/lib/constants/abis/` are placeholders:
- ✅ Complete: `ERC20.ts`, `Permit2.ts`
- ⏳ Pending: `PoolManager.ts`, `SwapRouter.ts`, `Quoter.ts`, `PositionManager.ts`

See `ABI-UPDATE-INSTRUCTIONS.md` for Solidity team export process.

### TypeScript Errors

```bash
# Run type check
npm run typecheck

# Run linter
npm run lint

# Auto-fix lint issues
npm run lint -- --fix
```

## Documentation

- **[INTEGRATION.md](./INTEGRATION.md)** - Complete API and WebSocket integration guide
- **[INTEGRATION-SUMMARY.md](./INTEGRATION-SUMMARY.md)** - Quick reference with architecture
- **[ABI-UPDATE-INSTRUCTIONS.md](./ABI-UPDATE-INSTRUCTIONS.md)** - Instructions for Solidity team
- **[CLAUDE.md](../CLAUDE.md)** - Complete technical architecture (root directory)

## Contributing

### Development Workflow

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes with proper TypeScript types
3. Run quality checks: `npm run lint && npm run typecheck`
4. Test your changes: `npm run dev`
5. Commit with descriptive message
6. Create pull request

### Code Standards

- **TypeScript**: Strict mode enabled
- **Linting**: ESLint with custom rules
- **Formatting**: Prettier (automatic on save)
- **Naming**: camelCase for variables/functions, PascalCase for components/types
- **Max line length**: 100 characters
- **Test coverage**: Aim for 70%+ on new code

## License

Proprietary - BaseBook Team © 2024
