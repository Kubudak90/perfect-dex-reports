# 🔗 Backend Integration Checklist

Quick reference for all integration points and configurations.

## ✅ Contract Addresses (Base Mainnet - Chain ID: 8453)

| Contract | Address | Status |
|----------|---------|--------|
| **PoolManager** | `0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05` | ✅ Configured |
| **SwapRouter** | `0xFf438e2d528F55fD1141382D1eB436201552d1A5` | ✅ Configured |
| **PositionManager** | `0x0000000000000000000000000000000000000000` | ⏳ TBD |
| **Quoter** | `0x0000000000000000000000000000000000000000` | ⏳ TBD |
| **Permit2** | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | ✅ Standard |

**Location:** `.env` file

---

## ✅ Service Endpoints

| Service | URL | Status |
|---------|-----|--------|
| **Backend API** | `http://localhost:3000` | ✅ Running |
| **WebSocket** | `ws://localhost:3000/ws` | ✅ Running |
| **Rust Router** | `http://localhost:3001` | 🚧 Coming Soon |
| **Subgraph** | `https://api.studio.thegraph.com/query/...` | 🚧 Coming Soon |
| **PostgreSQL** | `postgresql://localhost:5432/basebook_dev` | ✅ Running |
| **Redis** | `redis://localhost:6379` | ✅ Running |

**Location:** `.env` file, `src/config/services.ts`

---

## ✅ Contract ABIs

| Contract | File | Status |
|----------|------|--------|
| **PoolManager** | `src/blockchain/abis/poolManager.ts` | ✅ Complete |
| **SwapRouter** | `src/blockchain/abis/swapRouter.ts` | ✅ Complete |
| **PositionManager** | `src/blockchain/abis/positionManager.ts` | ✅ Complete |
| **Quoter** | `src/blockchain/abis/quoter.ts` | ✅ Complete |
| **ERC20** | `src/blockchain/abis/erc20.ts` | ✅ Complete |

**Functions Included:**
- ✅ SwapRouter: `exactInputSingle`, `exactInput`, `exactOutputSingle`, `exactOutput`, `multicall`
- ✅ PoolManager: `getPoolState`, `getSlot0`, `getLiquidity`
- ✅ PositionManager: `positions`, `ownerOf`, `balanceOf`, `tokenOfOwnerByIndex`
- ✅ Quoter: `quoteExactInputSingle`, `quoteExactInput`

---

## ✅ Contract Helpers

| Helper | File | Functions |
|--------|------|-----------|
| **Pool State** | `src/blockchain/contracts/poolManager.ts` | `getPoolState`, `getMultiplePoolStates` |
| **Swap Simulation** | `src/blockchain/contracts/swapRouter.ts` | `simulateExactInputSingle`, `encodePath`, `decodePath` |
| **Positions** | `src/blockchain/contracts/positionManager.ts` | `getPositionsByOwner`, `getPosition`, `getPositionBalance` |

---

## ✅ Configuration Files

### 1. Environment Variables

**File:** `.env`

```env
# ✅ Database
DATABASE_URL=postgresql://basebook:basebook@localhost:5432/basebook_dev

# ✅ Redis
REDIS_URL=redis://localhost:6379

# ✅ RPC
RPC_URL_BASE=https://mainnet.base.org

# ✅ Contracts (Base - 8453)
POOL_MANAGER_ADDRESS_8453=0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05
SWAP_ROUTER_ADDRESS_8453=0xFf438e2d528F55fD1141382D1eB436201552d1A5
POSITION_MANAGER_ADDRESS_8453=0x0000000000000000000000000000000000000000
QUOTER_ADDRESS_8453=0x0000000000000000000000000000000000000000
PERMIT2_ADDRESS_8453=0x000000000022D473030F116dDEE9F6B43aC78BA3

# 🚧 Services (Coming Soon)
ROUTER_API_URL=http://localhost:3001
SUBGRAPH_URL=https://api.studio.thegraph.com/query/your-subgraph-id/basebook-dex/version/latest

# Optional
COINGECKO_API_KEY=
THE_GRAPH_API_KEY=
```

### 2. Service Configuration

**File:** `src/config/services.ts`

```typescript
export const services = {
  router: {
    url: 'http://localhost:3001',      // ✅ Configured
    timeout: 5000,
    endpoints: { quote: '/quote', route: '/route', health: '/health' }
  },
  subgraph: {
    url: env.SUBGRAPH_URL,              // 🚧 Coming Soon
    timeout: 10000,
  },
  coingecko: {
    apiKey: env.COINGECKO_API_KEY,      // Optional
    baseUrl: 'https://api.coingecko.com/api/v3',
  }
}
```

### 3. Contract Addresses

**File:** `src/config/addresses.ts`

```typescript
export const contractAddresses: Record<number, ContractAddresses> = {
  8453: { // Base
    poolManager: '0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05',    // ✅
    swapRouter: '0xFf438e2d528F55fD1141382D1eB436201552d1A5',     // ✅
    positionManager: '0x0000000000000000000000000000000000000000', // ⏳
    quoter: '0x0000000000000000000000000000000000000000',          // ⏳
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',         // ✅
  }
}
```

---

## ✅ API Endpoints (25 Total)

### Health (2)
- ✅ `GET /health`
- ✅ `GET /health/detailed`

### Tokens (2)
- ✅ `GET /v1/tokens`
- ✅ `GET /v1/tokens/:address`

### Pools (2)
- ✅ `GET /v1/pools`
- ✅ `GET /v1/pools/:poolId`

### Swap (1)
- ✅ `GET /v1/swap/quote`
- 🚧 `POST /v1/swap/route` (Requires Rust Router)
- 🚧 `POST /v1/swap/build` (Coming Soon)

### Positions (3)
- ✅ `GET /v1/positions/:address`
- ✅ `GET /v1/positions/id/:tokenId`
- ✅ `GET /v1/positions/ticks/:poolId`

### Charts (4)
- ✅ `GET /v1/charts/ohlcv/:poolId`
- ✅ `GET /v1/charts/tvl/:poolId`
- ✅ `GET /v1/charts/volume/:poolId`
- ✅ `GET /v1/charts/fees/:poolId`

### Analytics (6)
- ✅ `GET /v1/analytics/overview`
- ✅ `GET /v1/analytics/tvl`
- ✅ `GET /v1/analytics/volume`
- ✅ `GET /v1/analytics/top-pools`
- ✅ `GET /v1/analytics/top-tokens`
- ✅ `GET /v1/analytics/trending`

### Oracle (2)
- ✅ `GET /v1/oracle/prices`
- ✅ `GET /v1/oracle/twap/:token`

### WebSocket (1)
- ✅ `WS /ws` (5 channel types)

---

## ✅ Database Schema

| Table | Records | Status |
|-------|---------|--------|
| **tokens** | 7 seeded | ✅ Complete |
| **pools** | 3 seeded | ✅ Complete |
| **pool_hour_data** | - | ✅ Ready |
| **pool_day_data** | - | ✅ Ready |
| **swaps** | - | ✅ Ready |
| **user_positions** | - | ✅ Ready |

**Seeded Data:**
- Tokens: WETH, USDC, DAI, WBTC, cbETH, USDbC, ETH
- Pools: WETH/USDC, USDC/DAI, WETH/DAI

---

## ✅ Cache Strategy (Redis)

| Cache Key | TTL | Purpose |
|-----------|-----|---------|
| `price:{chainId}:{address}` | 10s | Token prices |
| `pool:{chainId}:{poolId}` | 30s | Pool data |
| `pool:state:{chainId}:{poolId}` | 15s | Pool on-chain state |
| `oracle:prices:{chainId}` | 10s | Oracle prices |
| `oracle:twap:{chainId}:{token}:{period}` | 30s | TWAP prices |
| `user:{chainId}:{address}:positions` | 30s | User positions |
| `ratelimit:ip:{ip}` | 60s | Rate limiting |

---

## ✅ Rate Limiting

| Tier | Limit | Window |
|------|-------|--------|
| **Public** | 100 req | 1 minute |
| **Authenticated** | 500 req | 1 minute |
| **Premium** | 2000 req | 1 minute |
| **WebSocket** | 10 msg | 1 second |

**Per-Endpoint Limits:**
- `/v1/swap/quote`: 60 req/min
- `/v1/charts/*`: 30 req/min
- `/v1/analytics/*`: 30 req/min

---

## ✅ Documentation

| Document | Location | Status |
|----------|----------|--------|
| **Main README** | `README.md` | ✅ Complete |
| **API Summary** | `docs/API_SUMMARY.md` | ✅ Complete |
| **Oracle API** | `docs/ORACLE_API.md` | ✅ Complete |
| **WebSocket API** | `docs/WEBSOCKET_API.md` | ✅ Complete |
| **Integration Guide** | `docs/INTEGRATION.md` | ✅ Complete |
| **This Checklist** | `INTEGRATION_CHECKLIST.md` | ✅ Complete |

---

## 🧪 Quick Test Commands

```bash
# Type check
npm run typecheck          # ✅ PASSING

# Health check
curl http://localhost:3000/health

# Detailed health (includes DB, Redis)
curl http://localhost:3000/health/detailed

# Get tokens
curl http://localhost:3000/v1/tokens?chainId=8453

# Get pools
curl http://localhost:3000/v1/pools?chainId=8453

# Get oracle prices
curl http://localhost:3000/v1/oracle/prices?chainId=8453

# WebSocket test
wscat -c ws://localhost:3000/ws
> {"type":"ping"}
< {"type":"pong","timestamp":...}
```

---

## 🚀 Startup Commands

```bash
# Development
pnpm install              # Install dependencies
pnpm db:push              # Create database tables
pnpm db:seed              # Seed sample data
pnpm dev                  # Start development server

# Production
pnpm build                # Build TypeScript
pnpm start                # Start production server

# Database
pnpm db:generate          # Generate migrations
pnpm db:migrate           # Run migrations
pnpm db:studio            # Open Drizzle Studio GUI

# Testing
pnpm test                 # Run tests
pnpm test:ws              # WebSocket tests
pnpm test:ws:load         # Load testing
pnpm typecheck            # TypeScript check
pnpm lint                 # ESLint
```

---

## 📋 Pre-Deployment Checklist

### Environment
- [ ] `.env` file configured with production values
- [ ] Database URL points to production PostgreSQL
- [ ] Redis URL points to production Redis instance
- [ ] RPC URL configured (Alchemy/Infura recommended)
- [ ] Contract addresses verified on-chain

### Services
- [ ] Rust Router deployed and accessible
- [ ] Subgraph deployed to The Graph
- [ ] Load balancer configured
- [ ] SSL certificates installed

### Security
- [ ] Rate limiting tested under load
- [ ] CORS origins restricted to production domains
- [ ] Error messages don't leak sensitive data
- [ ] Database credentials rotated
- [ ] API keys for external services configured

### Monitoring
- [ ] Prometheus metrics endpoint exposed
- [ ] Grafana dashboards created
- [ ] PagerDuty/alerts configured
- [ ] Log aggregation setup (ELK/Loki)
- [ ] Uptime monitoring configured

### Performance
- [ ] Database indexes created
- [ ] Connection pooling configured
- [ ] Redis cluster setup (high availability)
- [ ] CDN configured for static assets
- [ ] Cache warming strategy implemented

---

## 🔗 Integration Summary

### ✅ Ready Now
- Backend API (25 endpoints)
- WebSocket server
- PostgreSQL database
- Redis caching
- Contract integration (PoolManager, SwapRouter)
- Rate limiting
- Error handling
- Documentation

### 🚧 Coming Soon
- Rust Router integration (multi-hop, split routing)
- The Graph subgraph (event indexing)
- Production oracle (Chainlink + Uniswap TWAP)
- Background workers (price sync, analytics)

### ⏳ Future Enhancements
- Multi-chain support (Arbitrum, Optimism)
- Advanced analytics
- Historical data backfill
- Governance endpoints
- Admin dashboard

---

**Last Updated:** 2026-02-03
**Backend Version:** 1.0.0
**Status:** Production Ready for Development/Testing ✅
