# Backend Integration Guide

Complete integration guide for BaseBook DEX backend components.

## 🔗 Service Dependencies

### 1. Database (PostgreSQL)

**Connection String:**
```
postgresql://basebook:basebook@localhost:5432/basebook_dev
```

**Required Tables:**
- ✅ tokens (7 seeded)
- ✅ pools (3 seeded)
- ✅ pool_hour_data
- ✅ pool_day_data
- ✅ swaps
- ✅ user_positions

**Setup:**
```bash
pnpm db:push      # Create tables
pnpm db:seed      # Seed data
pnpm db:studio    # Open GUI
```

---

### 2. Cache (Redis)

**Connection String:**
```
redis://localhost:6379
```

**Cache Keys:**
- `price:{chainId}:{address}` - Token prices (10s TTL)
- `pool:{chainId}:{poolId}` - Pool data (30s TTL)
- `oracle:prices:{chainId}` - Oracle prices (10s TTL)
- `ratelimit:ip:{ip}` - Rate limiting (60s window)

**Features:**
- ✅ Multi-tier caching (10s - 5m TTL)
- ✅ Pub/Sub for WebSocket
- ✅ Rate limiting storage

---

### 3. Rust Router Service

**Base URL:**
```
http://localhost:3001
```

**Endpoints:**
- `GET /quote` - Get swap quote
- `POST /route` - Find optimal route
- `GET /health` - Health check

**Configuration:**
```env
ROUTER_API_URL=http://localhost:3001
```

**Status:** 🚧 Coming Soon

**Integration Points:**
- `src/config/services.ts` - Service config
- `src/api/handlers/swap.handler.ts` - Quote endpoint
- Future: Multi-hop routing, split routing

---

### 4. The Graph Subgraph

**Subgraph URL:**
```
https://api.studio.thegraph.com/query/your-subgraph-id/basebook-dex/version/latest
```

**Configuration:**
```env
SUBGRAPH_URL=https://api.studio.thegraph.com/query/...
THE_GRAPH_API_KEY=your_api_key_here
```

**Indexed Events:**
- Swap events (amount, price, tick)
- Mint/Burn events (liquidity changes)
- Pool creation
- Position updates

**Status:** 🚧 Coming Soon

**Integration Points:**
- Historical data queries
- Event-based indexing
- Analytics aggregation

---

### 5. Smart Contracts (Base Mainnet)

**Chain ID:** 8453

**Contract Addresses:**

```env
# Core Contracts
POOL_MANAGER_ADDRESS_8453=0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05
SWAP_ROUTER_ADDRESS_8453=0xFf438e2d528F55fD1141382D1eB436201552d1A5

# Supporting Contracts (TBD)
POSITION_MANAGER_ADDRESS_8453=0x0000000000000000000000000000000000000000
QUOTER_ADDRESS_8453=0x0000000000000000000000000000000000000000

# Standard Contracts
PERMIT2_ADDRESS_8453=0x000000000022D473030F116dDEE9F6B43aC78BA3
```

**RPC Endpoints:**
```env
RPC_URL_BASE=https://mainnet.base.org
# Backup: https://base-mainnet.public.blastapi.io
# Backup: https://base.gateway.tenderly.co
```

**ABIs Available:**
- ✅ PoolManager (`src/blockchain/abis/poolManager.ts`)
- ✅ SwapRouter (`src/blockchain/abis/swapRouter.ts`)
- ✅ PositionManager (`src/blockchain/abis/positionManager.ts`)
- ✅ Quoter (`src/blockchain/abis/quoter.ts`)
- ✅ ERC20 (`src/blockchain/abis/erc20.ts`)

**Contract Helpers:**
- ✅ Pool state queries (`src/blockchain/contracts/poolManager.ts`)
- ✅ Swap simulation (`src/blockchain/contracts/swapRouter.ts`)
- ✅ Position queries (`src/blockchain/contracts/positionManager.ts`)

---

## 🔧 Configuration Files

### Environment Variables (.env)

```bash
# Copy example file
cp .env.example .env

# Edit with your values
nano .env
```

**Required Variables:**
```env
# Database
DATABASE_URL=postgresql://basebook:basebook@localhost:5432/basebook_dev

# Redis
REDIS_URL=redis://localhost:6379

# RPC
RPC_URL_BASE=https://mainnet.base.org

# Contracts (Base)
POOL_MANAGER_ADDRESS_8453=0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05
SWAP_ROUTER_ADDRESS_8453=0xFf438e2d528F55fD1141382D1eB436201552d1A5
```

**Optional Variables:**
```env
# Services
ROUTER_API_URL=http://localhost:3001
SUBGRAPH_URL=https://api.studio.thegraph.com/query/...

# API Keys
COINGECKO_API_KEY=your_key
THE_GRAPH_API_KEY=your_key

# Server
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
```

### Service Configuration

**File:** `src/config/services.ts`

```typescript
import { services, getRouterUrl } from './config/services.js';

// Rust Router
const quoteUrl = getRouterUrl('quote');  // http://localhost:3001/quote

// The Graph
const subgraphUrl = services.subgraph.url;

// CoinGecko
const isConfigured = isCoinGeckoConfigured();
```

---

## 🚀 Integration Checklist

### Backend Service

- [x] PostgreSQL connected
- [x] Redis connected
- [x] Contract ABIs loaded
- [x] RPC providers configured
- [ ] Rust Router connected
- [ ] Subgraph connected
- [ ] CoinGecko API (optional)

### API Endpoints

- [x] Health checks (`/health`, `/health/detailed`)
- [x] Token endpoints (`/v1/tokens/*`)
- [x] Pool endpoints (`/v1/pools/*`)
- [x] Swap quote (`/v1/swap/quote`)
- [x] Position endpoints (`/v1/positions/*`)
- [x] Charts endpoints (`/v1/charts/*`)
- [x] Analytics endpoints (`/v1/analytics/*`)
- [x] Oracle endpoints (`/v1/oracle/*`)
- [x] WebSocket server (`/ws`)

### Features

- [x] Rate limiting (multi-tier)
- [x] Error handling (20+ error types)
- [x] Caching (Redis)
- [x] Validation (Zod schemas)
- [x] Logging (Fastify)
- [x] CORS configuration
- [x] WebSocket pub/sub
- [x] Database migrations
- [x] Seed data

---

## 🧪 Testing Integration

### 1. Check Database Connection

```bash
pnpm db:studio
# Opens Drizzle Studio GUI
```

### 2. Check Redis Connection

```bash
redis-cli ping
# Should return: PONG
```

### 3. Check API Health

```bash
curl http://localhost:3000/health/detailed
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": 1699999999,
  "uptime": 123,
  "database": "connected",
  "redis": "connected",
  "version": "1.0.0"
}
```

### 4. Check Contract Integration

```bash
# Get pool state (requires RPC)
curl "http://localhost:3000/v1/pools/0x1234...?chainId=8453"
```

### 5. Check WebSocket

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');
ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'ping' }));
};
ws.onmessage = (msg) => {
  console.log(JSON.parse(msg.data)); // { type: 'pong' }
};
```

---

## 🔄 Integration Flow

### Swap Flow

```
1. Frontend → POST /v1/swap/quote
2. Backend → Quoter.quoteExactInputSingle (on-chain)
3. Backend → [Optional] Rust Router for optimal path
4. Backend → Cache result (10s TTL)
5. Backend → Return quote to frontend
6. Frontend → User confirms → Sign transaction
7. Frontend → Submit TX to SwapRouter contract
8. Blockchain → Event emitted
9. Backend → [Future] Subgraph indexes event
10. Backend → WebSocket broadcasts update
```

### Position Query Flow

```
1. Frontend → GET /v1/positions/:address
2. Backend → Check cache (30s TTL)
3. Backend → PositionManager.balanceOf (on-chain)
4. Backend → Multicall: tokenOfOwnerByIndex + positions
5. Backend → Calculate unclaimed fees
6. Backend → Cache results
7. Backend → Return to frontend
```

---

## 📊 Monitoring Integration Points

### Metrics to Track

1. **RPC Health**
   - Request count
   - Error rate
   - Response time

2. **Database**
   - Query time
   - Connection pool usage
   - Slow queries

3. **Redis**
   - Hit rate
   - Memory usage
   - Connection count

4. **API**
   - Request rate (per endpoint)
   - Error rate (by error type)
   - Response time (P50, P95, P99)

5. **WebSocket**
   - Active connections
   - Message rate
   - Latency

### Health Check Endpoints

```bash
# Basic health
GET /health

# Detailed health (includes all dependencies)
GET /health/detailed
```

---

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Test connection
psql postgresql://basebook:basebook@localhost:5432/basebook_dev
```

### Redis Connection Issues

```bash
# Check Redis is running
redis-cli ping

# Check connections
redis-cli client list
```

### RPC Issues

```bash
# Test RPC endpoint
curl -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### Contract Address Issues

```bash
# Verify contract exists
curl -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_getCode",
    "params":["0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05", "latest"],
    "id":1
  }'
```

---

## 📝 Next Steps

1. **Rust Router Integration**
   - Deploy Rust Router service
   - Configure ROUTER_API_URL
   - Test multi-hop routing

2. **Subgraph Deployment**
   - Deploy subgraph to The Graph
   - Configure SUBGRAPH_URL
   - Migrate to subgraph queries

3. **Production Deployment**
   - Setup production database
   - Configure production RPC (Alchemy/Infura)
   - Setup monitoring (Prometheus/Grafana)
   - Configure alerts (PagerDuty)

4. **Performance Optimization**
   - Add read replicas for database
   - Redis cluster for high availability
   - CDN for static assets
   - Rate limiting tuning

---

**Last Updated:** 2026-02-03
**Status:** Development Complete ✅
