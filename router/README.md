# BaseBook DEX Routing Engine

High-performance routing engine for BaseBook DEX built with Rust. Provides optimal swap routes across liquidity pools with multi-hop and split routing capabilities.

## Features

- **Ultra-Fast Routing**: <10ms latency for route calculation
- **Multi-Hop Support**: Up to 4 hops for optimal price execution
- **Split Routing**: Up to 3-way split for large trades
- **Intelligent Caching**: LRU cache with amount bucketing for high hit rates
- **Parallel Computation**: rayon-powered parallel route discovery
- **Real-Time Updates**: WebSocket support for live price feeds
- **Production Ready**: Comprehensive test coverage and benchmarks

## Architecture

```
┌─────────────┐
│   Frontend  │
└──────┬──────┘
       │ HTTP/WebSocket
       ▼
┌─────────────┐
│  API Server │ (Axum)
└──────┬──────┘
       │
   ┌───┴───┐
   ▼       ▼
┌──────┐ ┌────────┐
│Cache │ │ Router │ (Smart Router Engine)
└──────┘ └───┬────┘
             │
             ▼
      ┌─────────────┐
      │ Pool Graph  │ (petgraph)
      └─────────────┘
```

## API Documentation

### Base URL

```
http://localhost:3001
```

### Endpoints

#### 1. Health Check

Check API server health and graph statistics.

**Endpoint:** `GET /health`

**Request:**
```bash
curl http://localhost:3001/health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "chain_id": 8453,
  "graph_stats": {
    "token_count": 150,
    "pool_count": 300,
    "last_update": 1706134538
  }
}
```

**Response Fields:**
- `status`: Server health status ("healthy" | "degraded")
- `version`: API version
- `chain_id`: Chain ID (8453 for Base mainnet)
- `graph_stats.token_count`: Number of tokens in graph
- `graph_stats.pool_count`: Number of pools in graph
- `graph_stats.last_update`: Last graph update timestamp (Unix)

---

#### 2. Get Quote

Get a swap quote with optimal routing.

**Endpoint:** `GET /v1/quote`

**Query Parameters:**

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `token_in` | address | Yes | Input token address | - |
| `token_out` | address | Yes | Output token address | - |
| `amount_in` | string | Yes | Input amount in wei | - |
| `slippage` | number | No | Slippage tolerance (%) | 0.5 |
| `max_hops` | number | No | Max hops (1-4) | 4 |
| `max_splits` | number | No | Max splits (1-3) | 3 |

**Request Example:**
```bash
# Single-hop swap
curl "http://localhost:3001/v1/quote?token_in=0x4200000000000000000000000000000000000006&token_out=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&amount_in=1000000000000000000"

# Multi-hop with custom slippage
curl "http://localhost:3001/v1/quote?token_in=0x4200000000000000000000000000000000000006&token_out=0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb&amount_in=5000000000000000000&slippage=1.0&max_hops=3"
```

**Response:**
```json
{
  "quote": {
    "amount_in": "1000000000000000000",
    "amount_out": "2450123456789012345",
    "amount_out_min": "2437622629761442282",
    "price_impact": 0.15,
    "gas_estimate": 180000,
    "gas_estimate_usd": 0.0054,
    "route_string": "WETH → USDC → DAI",
    "route": {
      "total_amount_in": "0xde0b6b3a7640000",
      "total_amount_out": "0x21fea40768ad03e9",
      "total_gas_estimate": 180000,
      "combined_price_impact": 0.15,
      "routes": [
        [
          {
            "hops": [
              {
                "pool": {
                  "pool_id": [1, 2, 3, ...],
                  "token0": "0x4200000000000000000000000000000000000006",
                  "token1": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                  "fee": 3000,
                  "tick_spacing": 60,
                  "liquidity": 1000000000000000000000,
                  "sqrt_price_x96": "0x1000000000000000000000000",
                  "tick": -200345,
                  "hook_address": "0x0000000000000000000000000000000000000000"
                },
                "token_in": "0x4200000000000000000000000000000000000006",
                "token_out": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                "amount_in": "0xde0b6b3a7640000",
                "amount_out": "0x21fea40768ad03e9"
              }
            ],
            "total_amount_in": "0xde0b6b3a7640000",
            "total_amount_out": "0x21fea40768ad03e9",
            "price_impact": 0.15,
            "gas_estimate": 180000
          },
          100
        ]
      ]
    }
  },
  "timestamp": 1706134538,
  "cached": false
}
```

**Response Fields:**

- `quote.amount_in`: Input amount (wei, string)
- `quote.amount_out`: Expected output amount (wei, string)
- `quote.amount_out_min`: Minimum output after slippage (wei, string)
- `quote.price_impact`: Price impact percentage (0.15 = 0.15%)
- `quote.gas_estimate`: Estimated gas cost (units)
- `quote.gas_estimate_usd`: Estimated gas cost in USD
- `quote.route_string`: Human-readable route description
- `quote.route`: Detailed route information
- `timestamp`: Quote generation timestamp (Unix)
- `cached`: Whether result came from cache

**Error Responses:**

**400 Bad Request - Invalid Amount**
```json
{
  "error": "Bad Request",
  "message": "Invalid amount"
}
```

**404 Not Found - No Route**
```json
{
  "error": "Not Found",
  "message": "No route found from 0x... to 0x..."
}
```

**500 Internal Server Error**
```json
{
  "error": "Internal Server Error",
  "message": "Internal error description"
}
```

---

## Frontend Integration

### TypeScript Example

```typescript
import axios from 'axios';

const ROUTER_API = 'http://localhost:3001';

interface QuoteRequest {
  tokenIn: string;      // Address
  tokenOut: string;     // Address
  amountIn: string;     // Wei amount as string
  slippage?: number;    // Default: 0.5
  maxHops?: number;     // Default: 4
  maxSplits?: number;   // Default: 3
}

interface QuoteResponse {
  quote: {
    amount_in: string;
    amount_out: string;
    amount_out_min: string;
    price_impact: number;
    gas_estimate: number;
    gas_estimate_usd: number;
    route_string: string;
    route: any; // Full route details
  };
  timestamp: number;
  cached: boolean;
}

async function getSwapQuote(params: QuoteRequest): Promise<QuoteResponse> {
  const response = await axios.get(`${ROUTER_API}/v1/quote`, {
    params: {
      token_in: params.tokenIn,
      token_out: params.tokenOut,
      amount_in: params.amountIn,
      slippage: params.slippage,
      max_hops: params.maxHops,
      max_splits: params.maxSplits,
    },
  });

  return response.data;
}

// Usage example
async function example() {
  try {
    const quote = await getSwapQuote({
      tokenIn: '0x4200000000000000000000000000000000000006', // WETH
      tokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
      amountIn: '1000000000000000000', // 1 ETH
      slippage: 0.5,
    });

    console.log(`Route: ${quote.quote.route_string}`);
    console.log(`Expected output: ${quote.quote.amount_out}`);
    console.log(`Price impact: ${quote.quote.price_impact}%`);
    console.log(`Gas estimate: ${quote.quote.gas_estimate} (${quote.quote.gas_estimate_usd} USD)`);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('API Error:', error.response?.data);
    }
  }
}
```

### React Hook Example

```typescript
import { useQuery } from '@tanstack/react-query';
import { Address, parseEther } from 'viem';

interface UseSwapQuoteParams {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string; // User input (e.g., "1.5")
  decimals: number;
  slippage?: number;
  enabled?: boolean;
}

function useSwapQuote({
  tokenIn,
  tokenOut,
  amountIn,
  decimals,
  slippage = 0.5,
  enabled = true,
}: UseSwapQuoteParams) {
  return useQuery({
    queryKey: ['swap-quote', tokenIn, tokenOut, amountIn, slippage],
    queryFn: async () => {
      // Convert user input to wei
      const amountInWei = parseEther(amountIn).toString();

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_ROUTER_API}/v1/quote?` +
        new URLSearchParams({
          token_in: tokenIn,
          token_out: tokenOut,
          amount_in: amountInWei,
          slippage: slippage.toString(),
        })
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      return response.json() as Promise<QuoteResponse>;
    },
    enabled: enabled && !!tokenIn && !!tokenOut && parseFloat(amountIn) > 0,
    staleTime: 10_000, // 10 seconds
    refetchInterval: 15_000, // Refetch every 15 seconds
    retry: 2,
  });
}

// Component usage
function SwapWidget() {
  const [amountIn, setAmountIn] = useState('');
  const [slippage, setSlippage] = useState(0.5);

  const { data: quote, isLoading, error } = useSwapQuote({
    tokenIn: '0x4200000000000000000000000000000000000006',
    tokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    amountIn,
    decimals: 18,
    slippage,
    enabled: amountIn.length > 0,
  });

  return (
    <div>
      <input
        value={amountIn}
        onChange={(e) => setAmountIn(e.target.value)}
        placeholder="Amount"
      />

      {isLoading && <div>Calculating route...</div>}
      {error && <div>Error: {error.message}</div>}
      {quote && (
        <div>
          <div>Route: {quote.quote.route_string}</div>
          <div>Output: {formatUnits(BigInt(quote.quote.amount_out), 6)} USDC</div>
          <div>Price Impact: {quote.quote.price_impact.toFixed(2)}%</div>
          <div>Gas: ~${quote.quote.gas_estimate_usd.toFixed(4)}</div>
        </div>
      )}
    </div>
  );
}
```

---

## Running the Server

### Development

```bash
# Install dependencies
cd router
cargo build

# Run server
cargo run --bin routing-engine

# Server starts on http://localhost:3001
```

### Production

```bash
# Build optimized binary
cargo build --release

# Run
./target/release/routing-engine
```

### Docker

```bash
# Build image
docker build -t basebook-router .

# Run container
docker run -p 3001:3001 basebook-router
```

### Environment Variables

```bash
# Server
SERVER_HOST=0.0.0.0
SERVER_PORT=3001

# Chain
CHAIN_ID=8453
RPC_URL=https://mainnet.base.org

# Contracts (Base mainnet)
POOL_MANAGER=0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05

# Routing
MAX_HOPS=4
MAX_SPLITS=3
```

**Contract Addresses (Base Mainnet - Chain ID: 8453):**
- **PoolManager:** `0x91B9463d0e4d99BB2D922cba2C9D4cd13c9a7C05` ✅
- **SwapRouter:** TBD (to be deployed)
- **PositionManager:** TBD (to be deployed)
- **Quoter:** TBD (to be deployed)

---

## Testing

### Unit Tests

```bash
cargo test --lib
```

### Integration Tests

```bash
cargo test --test api_test
cargo test --test integration_test
cargo test --test multi_hop_split_test
```

### All Tests

```bash
cargo test
```

**Test Coverage:**
- ✅ 49 unit tests
- ✅ 8 API integration tests
- ✅ 9 backend integration tests
- ✅ 8 multi-hop & split tests
- ✅ Total: 74 tests passing

### Benchmarks

```bash
cargo bench
```

**Performance Targets:**
- Single-hop routing: <1ms
- Multi-hop (4 hops): <5ms
- Cache hit: <100μs
- Full quote generation: <10ms

**Benchmark Results:**
```
single_hop_routing      time:   [188.17 ns 190.19 ns 192.98 ns]   ✅ 5,263x faster than target
multi_hop_routing/2     time:   [2.6176 µs 2.6805 µs 2.7426 µs]
multi_hop_routing/3     time:   [9.1913 µs 9.6625 µs 10.283 µs]
multi_hop_routing/4     time:   [18.041 µs 18.861 µs 19.725 µs]   ✅ 265x faster than target
parallel_routing        time:   [63.706 µs 66.244 µs 69.062 µs]
cache_hit               time:   [653.87 ns 672.28 ns 694.44 ns]   ✅ 148x faster than target
split_optimization      time:   [28.220 ns 28.829 ns 29.527 ns]
```

**Performance Summary:**
- Single-hop: 190ns (target: <1ms) - **5,263x faster!** 🚀
- 4-hop routing: 18.8µs (target: <5ms) - **265x faster!** 🚀
- Cache hit: 672ns (target: <100µs) - **148x faster!** 🚀
- Full quote: <2ms (target: <10ms) - **5x faster!** 🚀

---

## Performance Optimization

### Caching Strategy

The router implements multi-level caching:

1. **Route Cache**: Caches complete routes (15s TTL)
2. **Quote Cache**: Caches quote responses (15s TTL)
3. **Amount Bucketing**: Groups similar amounts for higher cache hit rate

**Amount Bucketing Example:**
```
1,234,567,890 → 1,200,000,000 (2 significant figures)
9,876,543,210 → 9,800,000,000
```

This improves cache hit rate by ~3x for similar amounts.

### Parallel Evaluation

For routes with >2 hops, the router uses parallel evaluation:

```rust
// Routes are evaluated concurrently using rayon
let routes: Vec<Route> = (1..=max_hops)
    .into_par_iter() // Parallel iterator
    .flat_map(|hops| find_routes_for_hops(hops))
    .collect();
```

### Gas Optimization

Gas estimates include:
- Base swap gas: 100,000 per hop
- Hook gas: Variable based on hook address
- Token transfer gas: 50,000 per token

---

## Architecture Details

### Pool Graph

Uses `petgraph` for efficient graph algorithms:

```rust
pub struct PoolGraph {
    graph: DiGraph<TokenNode, PoolEdge>,
    token_index: DashMap<Address, NodeIndex>,
    pool_index: DashMap<[u8; 32], Vec<Edge>>,
}
```

### Routing Algorithm

1. **Single-hop**: Direct pool lookup (O(1))
2. **Multi-hop**: Modified Dijkstra with pruning
3. **Split routing**: Binary search for 2-way, combinatorial for 3-way

### Thread Safety

All shared state uses lock-free concurrency:
- `Arc` for shared ownership
- `DashMap` for concurrent HashMap
- `parking_lot::Mutex` for rare locks

---

## Troubleshooting

### Common Issues

**1. "No route found" error**

Possible causes:
- Tokens not in pool graph
- No liquidity path exists
- Liquidity too low for amount

Solution: Check token addresses and liquidity.

**2. High price impact (>5%)**

Possible causes:
- Large trade size relative to liquidity
- Illiquid pools in route

Solution: Split trade or use different route.

**3. Slow response times**

Possible causes:
- Graph not loaded
- No cache hits
- Complex multi-hop routing

Solution: Check graph stats at `/health`.

### Debug Mode

Enable debug logging:

```bash
RUST_LOG=debug cargo run
```

### Monitoring

Health check includes graph statistics:
```bash
watch -n 1 'curl -s http://localhost:3001/health | jq'
```

---

## Project Status

### Phase 1 (Week 1-2) ✅ Complete

- ✅ Cargo workspace setup
- ✅ Pool graph data structure
- ✅ HTTP API skeleton (Axum)
- ✅ Basic routing infrastructure

### Phase 2 (Week 3-4) ✅ Complete

- ✅ **Single-hop routing** (Task #14)
  - Direct pool lookup optimization
  - Best pool selection
  - Swap simulation
  - Price impact calculation
  - Gas estimation

- ✅ **Multi-hop routing** (Task #27)
  - Up to 4 hops support
  - Cycle prevention
  - Multiple route discovery
  - Top-N route selection

- ✅ **Split routing** (Task #27)
  - Up to 3-way splits
  - Optimal split ratio calculation
  - Combined price impact
  - Gas-aware optimization

### Phase 3 (Week 5-6) ✅ Complete

- ✅ **Performance optimization** (Task #28)
  - LRU caching with TTL
  - Amount bucketing strategy
  - Parallel route evaluation
  - <10ms latency achieved

- ✅ **HTTP API & Testing** (RUST_DOC)
  - Comprehensive API tests (8 passing)
  - API documentation
  - Frontend integration examples
  - Production-ready error handling

### Test Summary

- ✅ **49 unit tests** (routing algorithms)
- ✅ **8 API tests** (HTTP endpoints)
- ✅ **9 backend integration tests** (TypeScript client)
- ✅ **8 multi-hop/split tests** (advanced routing)
- ✅ **Total: 74 tests passing**

### Benchmarks

All performance targets exceeded by orders of magnitude:
- ✅ Single-hop: <1ms (achieved: 190ns) - **5,263x faster** 🚀
- ✅ 4-hop: <5ms (achieved: 18.8µs) - **265x faster** 🚀
- ✅ Cache hit: <100µs (achieved: 672ns) - **148x faster** 🚀
- ✅ Full quote: <10ms (achieved: ~2ms) - **5x faster** 🚀

See [PERFORMANCE_REPORT.md](./PERFORMANCE_REPORT.md) for detailed analysis.

---

## Contributing

### Code Style

- Follow Rust style guide
- Use `cargo fmt` before committing
- Run `cargo clippy` for linting

### Testing

- Write tests for new features
- Maintain >90% code coverage
- Add benchmarks for performance-critical code

### Pull Requests

1. Create feature branch
2. Write tests
3. Update documentation
4. Submit PR with description

---

## License

MIT License - see LICENSE file

---

## Support

- **Documentation**: This README
- **Issues**: [GitHub Issues](https://github.com/basebook/dex/issues)
- **Discord**: [BaseBook Community](https://discord.gg/basebook)

---

**Built with ❤️ by the BaseBook Team**
