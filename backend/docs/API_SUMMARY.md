# BaseBook DEX - API Summary

Complete API reference for BaseBook DEX backend.

## Base URL

```
http://localhost:3000
```

## Authentication

Currently, all endpoints are public. Future versions will support API key authentication for premium tiers.

## Rate Limiting

- **Public Tier**: 100 requests/minute
- **Authenticated Tier**: 500 requests/minute
- **Premium Tier**: 2000 requests/minute

## Endpoints Overview

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Basic health check |
| GET | `/health/detailed` | Detailed health with DB and Redis status |

### Tokens (7 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/tokens` | List all tokens |
| GET | `/v1/tokens/:address` | Get token details by address |

**Features:**
- Token metadata (symbol, name, decimals)
- Price data (USD, ETH)
- 24h volume and TVL
- Verification status
- Caching: 5 minutes TTL

### Pools (2 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/pools` | List pools with sorting and filtering |
| GET | `/v1/pools/:poolId` | Get pool details with on-chain state |

**Features:**
- Pool statistics (volume, TVL, APR)
- Current price and tick
- Sorting: tvl, volume, apr, fees
- Filtering: feeTier, tokens
- On-chain state synchronization
- Caching: 30 seconds TTL

### Swap (1 endpoint)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/swap/quote` | Get swap quote with on-chain calculation |

**Features:**
- Exact input/output support
- Price impact calculation
- Gas estimation
- Multi-hop routing (coming soon)
- Caching: 10 seconds TTL

### Positions (3 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/positions/:address` | Get all positions for an address |
| GET | `/v1/positions/id/:tokenId` | Get position details by NFT token ID |
| GET | `/v1/positions/ticks/:poolId` | Get tick data for a pool |

**Features:**
- NFT-based position tracking
- Unclaimed fees calculation
- In-range status
- Liquidity distribution (tick data)
- Multicall optimization
- Caching: 30 seconds TTL

### Charts (4 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/charts/ohlcv/:poolId` | Get OHLCV candlestick data |
| GET | `/v1/charts/tvl/:poolId` | Get TVL history |
| GET | `/v1/charts/volume/:poolId` | Get volume history |
| GET | `/v1/charts/fees/:poolId` | Get fees history with APR |

**Features:**
- Time intervals: 1h, 4h, 1d, 1w, 1m
- OHLCV data for price charts
- Historical TVL tracking
- Volume aggregation
- Fee earnings with APR calculation
- Smart aggregation (hourly → 4h → daily → weekly → monthly)
- Caching: 1-5 minutes TTL

### Analytics (6 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/analytics/overview` | Protocol-wide statistics |
| GET | `/v1/analytics/tvl` | Protocol TVL history |
| GET | `/v1/analytics/volume` | Protocol volume history |
| GET | `/v1/analytics/top-pools` | Top pools by metric |
| GET | `/v1/analytics/top-tokens` | Top tokens by metric |
| GET | `/v1/analytics/trending` | Trending pools (24h change) |

**Features:**
- Protocol-wide aggregations
- Historical data (daily, weekly, monthly)
- Top performers ranking
- Trending detection
- Multi-metric sorting (tvl, volume, fees, apr)
- Caching: 1-5 minutes TTL

### Oracle (2 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/oracle/prices` | Get oracle prices for tokens |
| GET | `/v1/oracle/twap/:token` | Get TWAP price for a token |

**Features:**
- Mock data for 5 tokens (WETH, USDC, DAI, WBTC, cbETH)
- USD and ETH pricing
- TWAP calculation with configurable period
- Production-ready structure for Chainlink/Uniswap integration
- Caching: 10-30 seconds TTL

## WebSocket

### Connection

```
ws://localhost:3000/ws
```

### Channels

- `prices:{chainId}` - Real-time token prices (every 10s)
- `pool:{poolId}` - Pool state updates
- `pools:{chainId}` - All pool updates
- `swaps:{chainId}` - Live swap events
- `liquidity:{chainId}` - Live liquidity events

See [WEBSOCKET_API.md](./WEBSOCKET_API.md) for full documentation.

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "statusCode": 400,
  "requestId": "req-abc123",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Error Codes

- `VALIDATION_ERROR` (400) - Invalid input
- `NOT_FOUND` (404) - Resource not found
- `RATE_LIMIT_EXCEEDED` (429) - Too many requests
- `INSUFFICIENT_LIQUIDITY` (400) - Not enough liquidity
- `PRICE_IMPACT_TOO_HIGH` (400) - Price impact > threshold
- `INTERNAL_ERROR` (500) - Server error

## Response Format

All successful responses follow this format:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": 1699999999,
    "requestId": "req-abc123"
  }
}
```

## Caching Strategy

- **Prices**: 10 seconds
- **Pool State**: 15-30 seconds
- **Pool List**: 5 minutes
- **Tokens**: 5 minutes
- **Charts**: 1-5 minutes
- **Analytics**: 1-5 minutes
- **Oracle**: 10-30 seconds

All caches are stored in Redis with automatic invalidation.

## Database Tables

- **tokens**: Token metadata and stats (7 tokens seeded)
- **pools**: Pool state and statistics (3 pools seeded)
- **swaps**: Swap transaction history
- **user_positions**: LP positions (NFT-based)
- **pool_hour_data**: Hourly OHLCV data
- **pool_day_data**: Daily aggregated data

## Development Status

### ✅ Completed

- [x] Health check endpoints
- [x] Token endpoints with caching
- [x] Pool endpoints with on-chain sync
- [x] Swap quote endpoint
- [x] Position endpoints with multicall
- [x] Charts endpoints (OHLCV, TVL, Volume, Fees)
- [x] Analytics endpoints (Overview, TVL, Volume, Top, Trending)
- [x] Oracle endpoints (mock data)
- [x] WebSocket server with pub/sub
- [x] Redis caching layer
- [x] Rate limiting (multi-tier)
- [x] Error handling (20+ error types)
- [x] Database schema (PostgreSQL + Drizzle)
- [x] Seed data (7 tokens, 3 pools)

### 🚧 Coming Soon

- [ ] Rust Router Engine (multi-hop, split routing)
- [ ] Swap route endpoint (optimal path finding)
- [ ] Swap build endpoint (transaction builder)
- [ ] The Graph subgraph (event indexing)
- [ ] Background workers (price sync, analytics aggregation)
- [ ] Production oracle integration (Chainlink + Uniswap TWAP)

## Quick Start

```bash
# Install dependencies
pnpm install

# Setup database
pnpm db:push

# Seed data
pnpm db:seed

# Start development server
pnpm dev
```

Server starts at `http://localhost:3000`

## Testing

```bash
# Type check
pnpm typecheck

# Lint
pnpm lint

# Run tests
pnpm test

# WebSocket tests
pnpm test:ws

# Load testing
pnpm test:ws:load
```

## Documentation

- [README.md](../README.md) - Setup and overview
- [ORACLE_API.md](./ORACLE_API.md) - Oracle endpoint details
- [WEBSOCKET_API.md](./WEBSOCKET_API.md) - WebSocket API details
- [API_SUMMARY.md](./API_SUMMARY.md) - This document

## Support

For issues or questions, contact the BaseBook DEX team.

---

**Last Updated**: 2026-02-03
**API Version**: v1
**Status**: Development Complete ✅
