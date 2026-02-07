# BaseBook DEX - The Graph Subgraph

This subgraph indexes all events from the BaseBook DEX protocol on Base (and other chains).

## 🏗️ Schema

The subgraph indexes the following entities:

### Core Entities
- **Protocol**: Global protocol statistics
- **Token**: ERC20 token metadata and stats
- **Pool**: Pool state and statistics
- **Transaction**: On-chain transaction wrapper

### Events
- **Swap**: Swap events with amounts and prices
- **Mint**: Add liquidity events
- **Burn**: Remove liquidity events

### Time-Series Data
- **PoolHourData**: Hourly OHLCV data per pool
- **PoolDayData**: Daily OHLCV data per pool
- **TokenDayData**: Daily token statistics
- **ProtocolDayData**: Daily protocol statistics

## 🚀 Setup

### Prerequisites

```bash
npm install -g @graphprotocol/graph-cli
```

### Configuration

1. Update `subgraph.yaml`:
   - Set correct contract address
   - Set correct start block
   - Choose network (base, arbitrum-one, optimism)

2. Place contract ABIs in `./abis/`:
   - `PoolManager.json`
   - `ERC20.json`

### Build

```bash
# Generate code from schema
pnpm codegen

# Build subgraph
pnpm build
```

## 📦 Deployment

### Local (for testing)

```bash
# Start local Graph Node (Docker)
git clone https://github.com/graphprotocol/graph-node
cd graph-node/docker
docker-compose up

# Create subgraph
pnpm create:local

# Deploy
pnpm deploy:local
```

### The Graph Studio (recommended)

```bash
# Deploy to The Graph Studio
pnpm deploy:studio
```

### Hosted Service (legacy)

```bash
# Deploy to hosted service
pnpm deploy:hosted
```

## 📊 Example Queries

### Get Top Pools by TVL

```graphql
{
  pools(first: 10, orderBy: totalValueLockedUSD, orderDirection: desc) {
    id
    token0 {
      symbol
    }
    token1 {
      symbol
    }
    feeTier
    totalValueLockedUSD
    volumeUSD
    txCount
  }
}
```

### Get Recent Swaps

```graphql
{
  swaps(first: 10, orderBy: timestamp, orderDirection: desc) {
    id
    pool {
      token0 {
        symbol
      }
      token1 {
        symbol
      }
    }
    amount0
    amount1
    amountUSD
    timestamp
  }
}
```

### Get Pool Hourly Data

```graphql
{
  poolHourDatas(
    first: 24
    where: { pool: "0x..." }
    orderBy: periodStartUnix
    orderDirection: desc
  ) {
    periodStartUnix
    open
    high
    low
    close
    volumeUSD
    tvlUSD
  }
}
```

### Get Protocol Stats

```graphql
{
  protocol(id: "1") {
    poolCount
    txCount
    totalVolumeUSD
    totalValueLockedUSD
    totalFeesUSD
  }
}
```

## 🔧 Development

### Mappings

Event handlers are in `src/mappings/poolManager.ts`:

- `handleInitialize`: Called when a new pool is created
- `handleSwap`: Called on every swap
- `handleModifyLiquidity`: Called on mint/burn

### Schema Updates

After modifying `schema.graphql`:

```bash
pnpm codegen
```

This regenerates TypeScript types in `generated/`.

## 📝 TODO

- [ ] Implement price oracle for USD calculations
- [ ] Calculate token amounts from liquidity delta (mint/burn)
- [ ] Implement time-series data updates (hourly/daily)
- [ ] Add fee calculation logic
- [ ] Add derived ETH price calculation
- [ ] Optimize query performance with proper indexing

## 🔗 Resources

- [The Graph Docs](https://thegraph.com/docs/)
- [AssemblyScript Docs](https://www.assemblyscript.org/)
- [BaseBook Contracts](../src/blockchain/abis/)
