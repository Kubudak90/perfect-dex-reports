# BaseBook DEX - Backend API

Backend API service for BaseBook DEX, built with Fastify, PostgreSQL, and Redis.

## 🏗️ Architecture

- **Framework**: Fastify 4.x
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL 15+ with Drizzle ORM
- **Cache**: Redis 7+
- **Blockchain**: viem 2.x
- **Queue**: BullMQ

## 📋 Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optional)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Setup Environment Variables

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Database Setup

```bash
# Generate migration files
pnpm db:generate

# Run migrations
pnpm db:migrate

# Or push schema directly (development)
pnpm db:push
```

### 4. Start Development Server

```bash
pnpm dev
```

Server will be available at:
- HTTP API: `http://localhost:3000`
- WebSocket: `ws://localhost:3000/ws`

## 🔌 WebSocket Real-time Updates

Connect to WebSocket for real-time price updates, pool changes, and swap events:

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

// Subscribe to price updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'prices:8453'
}));

// Subscribe to pool updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'pool:0x1234...'
}));
```

### Available Channels:
- `prices:{chainId}` - Real-time token price updates (every 10s)
- `pool:{poolId}` - Specific pool updates (on swap/mint/burn)
- `pools:{chainId}` - All pool updates on a chain
- `swaps:{chainId}` - Live swap events
- `liquidity:{chainId}` - Live mint/burn events

### Test Clients:
- **HTML Client**: Open `examples/websocket-client.html` in browser
- **Node.js Client**: `node examples/websocket-client.js`

## 🐳 Docker Setup

Start all services (PostgreSQL, Redis, API):

```bash
docker-compose up -d
```

View logs:

```bash
docker-compose logs -f api
```

Stop services:

```bash
docker-compose down
```

## 📚 API Endpoints

### Health Check
```
GET /health
GET /health/detailed
```

### Tokens
```
GET /v1/tokens              # List tokens
GET /v1/tokens/:address     # Get token details
```

### Pools
```
GET /v1/pools               # List pools (with sorting, filtering)
GET /v1/pools/:poolId       # Get pool details (with on-chain state)
```

### Swap
```
GET /v1/swap/quote          # Get swap quote (on-chain)
POST /v1/swap/route         # Get optimal route (Coming Soon)
POST /v1/swap/build         # Build swap transaction (Coming Soon)
```

### Positions
```
GET /v1/positions/:address        # Get user positions
GET /v1/positions/id/:tokenId     # Get position details
GET /v1/positions/ticks/:poolId   # Get pool tick data
```

### Charts
```
GET /v1/charts/ohlcv/:poolId      # Get OHLCV candlestick data
GET /v1/charts/tvl/:poolId        # Get TVL history
GET /v1/charts/volume/:poolId     # Get volume history
GET /v1/charts/fees/:poolId       # Get fees history with APR
```

### Analytics
```
GET /v1/analytics/overview        # Protocol overview statistics
GET /v1/analytics/tvl             # Protocol TVL history
GET /v1/analytics/volume          # Protocol volume history
GET /v1/analytics/top-pools       # Top pools by metric
GET /v1/analytics/top-tokens      # Top tokens by metric
GET /v1/analytics/trending        # Trending pools
```

### Oracle
```
GET /v1/oracle/prices             # Get oracle prices for tokens
GET /v1/oracle/twap/:token        # Get TWAP price for a token
```

## 🗄️ Database Schema

### Tables
- **tokens**: Token metadata and cached stats
- **pools**: Pool state and statistics
- **swaps**: Swap transaction history
- **user_positions**: LP positions (NFT-based)

### Schema Management

```bash
# Generate migration from schema changes
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Open Drizzle Studio (GUI)
pnpm db:studio
```

## 🔧 Scripts

```bash
# Development
pnpm dev              # Start dev server with hot reload
pnpm build            # Build for production
pnpm start            # Start production server

# Database
pnpm db:generate      # Generate migrations
pnpm db:migrate       # Run migrations
pnpm db:push          # Push schema (dev only)
pnpm db:seed          # Seed database with sample data
pnpm db:studio        # Open Drizzle Studio

# Testing
pnpm test             # Run tests
pnpm test:coverage    # Run tests with coverage

# Code Quality
pnpm lint             # Run ESLint
pnpm typecheck        # Type check with TypeScript
```

## 🏗️ Project Structure

```
backend/
├── src/
│   ├── api/
│   │   ├── routes/         # Route definitions
│   │   ├── handlers/       # Route handlers
│   │   ├── schemas/        # Zod validation schemas
│   │   └── middleware/     # Custom middleware
│   │
│   ├── db/
│   │   ├── schema/         # Database schema (Drizzle)
│   │   └── index.ts        # Database client
│   │
│   ├── cache/
│   │   ├── index.ts        # Redis client
│   │   └── keys.ts         # Cache key patterns
│   │
│   ├── config/             # Configuration
│   │   ├── env.ts          # Environment validation
│   │   ├── chains.ts       # Chain configurations
│   │   └── addresses.ts    # Contract addresses
│   │
│   ├── app.ts              # Fastify app setup
│   └── index.ts            # Entry point
│
├── docker-compose.yml      # Docker services
├── Dockerfile              # Production image
├── drizzle.config.ts       # Drizzle configuration
├── package.json
└── tsconfig.json
```

## 🔐 Environment Variables

See `.env.example` for all available configuration options.

Required variables:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `RPC_URL_BASE`: Base chain RPC URL
- `POOL_MANAGER_ADDRESS_8453`: PoolManager contract address
- `SWAP_ROUTER_ADDRESS_8453`: SwapRouter contract address

## 📊 Monitoring

The API includes health check endpoints:

- `/health`: Basic health status
- `/health/detailed`: Detailed health with dependency checks (DB, Redis)

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run specific test file
pnpm test path/to/test.ts
```

## 📝 Development Guidelines

1. **TypeScript**: Strict mode enabled, no `any` types
2. **Validation**: Use Zod schemas for all API inputs
3. **Error Handling**: Always use try-catch and proper error responses
4. **Logging**: Use Fastify's built-in logger
5. **Database**: Use Drizzle ORM, no raw SQL
6. **Cache**: Always consider cache strategy for expensive operations

## 🚢 Deployment

### Production Build

```bash
pnpm build
pnpm start
```

### Docker Production

```bash
docker build -t basebook-api .
docker run -p 3000:3000 --env-file .env basebook-api
```

## 📄 License

MIT

## 👥 Team

Backend Senior Developer - BaseBook DEX Team
