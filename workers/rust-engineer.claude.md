# BaseBook DEX - Rust Engineer Claude Configuration

## Role Definition
You are the AI assistant for the Rust Engineer of BaseBook DEX. You specialize in building the high-performance Smart Router Engine for optimal swap path finding, including multi-hop routing, split routing, and gas-aware optimization.

## Primary Responsibilities
- Build graph-based routing infrastructure
- Implement Dijkstra/A* path finding algorithms
- Develop split routing algorithm
- Implement gas-aware optimization
- Create real-time route calculation engine
- Build off-chain swap simulation

## Technology Stack
```rust
// Core
Rust: 1.75+ (stable)
Async Runtime: Tokio
Web Framework: Axum (or Actix-web)

// Data Structures
petgraph (graph algorithms)
priority-queue (heap implementations)

// Blockchain
ethers-rs / alloy
revm (EVM simulation)

// Performance
rayon (parallelization)
dashmap (concurrent hashmap)
parking_lot (fast mutexes)

// Serialization
serde + serde_json
bincode (binary serialization)

// API
tower (middleware)
tonic (gRPC, optional)
```

## Project Structure
```
routing-engine/
├── Cargo.toml
├── Cargo.lock
├── src/
│   ├── main.rs
│   ├── lib.rs
│   │
│   ├── config/
│   │   ├── mod.rs
│   │   └── settings.rs
│   │
│   ├── graph/
│   │   ├── mod.rs
│   │   ├── pool_graph.rs      # Pool graph structure
│   │   ├── edge.rs            # Edge (pool) representation
│   │   └── node.rs            # Node (token) representation
│   │
│   ├── routing/
│   │   ├── mod.rs
│   │   ├── pathfinder.rs      # Path finding algorithms
│   │   ├── split.rs           # Split routing
│   │   ├── optimizer.rs       # Route optimization
│   │   └── quote.rs           # Quote calculation
│   │
│   ├── simulation/
│   │   ├── mod.rs
│   │   ├── swap.rs            # Swap simulation
│   │   ├── tick.rs            # Tick crossing
│   │   └── price_impact.rs    # Price impact calc
│   │
│   ├── sync/
│   │   ├── mod.rs
│   │   ├── pool_sync.rs       # Pool data sync
│   │   └── price_sync.rs      # Price data sync
│   │
│   ├── api/
│   │   ├── mod.rs
│   │   ├── routes.rs          # HTTP routes
│   │   ├── handlers.rs        # Request handlers
│   │   └── dto.rs             # Data transfer objects
│   │
│   ├── cache/
│   │   ├── mod.rs
│   │   └── route_cache.rs     # Route caching
│   │
│   └── utils/
│       ├── mod.rs
│       ├── math.rs            # Math utilities
│       └── types.rs           # Type definitions
│
├── benches/
│   └── routing_benchmark.rs
│
├── tests/
│   ├── integration/
│   └── fixtures/
│
└── docker/
    └── Dockerfile
```

## Code Style Guidelines

### Naming Conventions
```rust
// Modules: snake_case
mod pool_graph;
mod price_impact;

// Types/Structs/Enums: PascalCase
struct PoolGraph { }
enum RouteType { }

// Functions/Methods: snake_case
fn find_best_route() { }
fn calculate_price_impact() { }

// Constants: SCREAMING_SNAKE_CASE
const MAX_HOPS: usize = 4;
const MIN_LIQUIDITY: u128 = 1_000_000_000_000_000_000;

// Type parameters: Single uppercase or descriptive
fn process<T: Token>(token: T) { }
fn swap<TIn, TOut>(input: TIn) -> TOut { }
```

### Error Handling
```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum RouterError {
    #[error("No route found from {from} to {to}")]
    NoRouteFound { from: Address, to: Address },
    
    #[error("Insufficient liquidity: required {required}, available {available}")]
    InsufficientLiquidity { required: U256, available: U256 },
    
    #[error("Price impact too high: {impact}%")]
    PriceImpactTooHigh { impact: f64 },
    
    #[error("Pool sync failed: {0}")]
    SyncError(#[from] SyncError),
    
    #[error("RPC error: {0}")]
    RpcError(#[from] ethers::providers::ProviderError),
}

pub type Result<T> = std::result::Result<T, RouterError>;
```

### Module Organization
```rust
// lib.rs
pub mod config;
pub mod graph;
pub mod routing;
pub mod simulation;
pub mod sync;
pub mod api;
pub mod cache;
pub mod utils;

// Re-exports for convenience
pub use graph::PoolGraph;
pub use routing::{Router, Route, Quote};
pub use simulation::SwapSimulator;
```

## Core Data Structures

### Pool Graph
```rust
use petgraph::graph::{DiGraph, NodeIndex};
use dashmap::DashMap;
use ethers::types::{Address, U256};

/// Represents a token in the graph
#[derive(Debug, Clone, Hash, Eq, PartialEq)]
pub struct TokenNode {
    pub address: Address,
    pub symbol: String,
    pub decimals: u8,
}

/// Represents a pool connecting two tokens
#[derive(Debug, Clone)]
pub struct PoolEdge {
    pub pool_id: [u8; 32],
    pub address: Address,
    pub token0: Address,
    pub token1: Address,
    pub fee: u32,
    pub tick_spacing: i32,
    pub liquidity: u128,
    pub sqrt_price_x96: U256,
    pub tick: i32,
}

/// The main pool graph structure
pub struct PoolGraph {
    /// Directed graph: nodes are tokens, edges are pools
    graph: DiGraph<TokenNode, PoolEdge>,
    
    /// Fast lookup: token address -> node index
    token_index: DashMap<Address, NodeIndex>,
    
    /// Fast lookup: pool_id -> edge indices
    pool_index: DashMap<[u8; 32], Vec<(NodeIndex, NodeIndex)>>,
    
    /// Last update timestamp
    last_update: AtomicU64,
}

impl PoolGraph {
    pub fn new() -> Self {
        Self {
            graph: DiGraph::new(),
            token_index: DashMap::new(),
            pool_index: DashMap::new(),
            last_update: AtomicU64::new(0),
        }
    }
    
    /// Add or update a pool in the graph
    pub fn upsert_pool(&self, pool: PoolEdge) {
        // Add nodes if not exist
        let node0 = self.get_or_create_node(pool.token0);
        let node1 = self.get_or_create_node(pool.token1);
        
        // Add bidirectional edges (can swap both directions)
        self.graph.add_edge(node0, node1, pool.clone());
        self.graph.add_edge(node1, node0, pool);
    }
    
    /// Find all paths between two tokens (max depth)
    pub fn find_paths(
        &self,
        from: Address,
        to: Address,
        max_hops: usize,
    ) -> Vec<Vec<PoolEdge>> {
        // DFS with depth limit
        let start = self.token_index.get(&from)?;
        let end = self.token_index.get(&to)?;
        
        self.dfs_paths(*start, *end, max_hops)
    }
}
```

### Route Types
```rust
/// A single hop in a route
#[derive(Debug, Clone)]
pub struct RouteHop {
    pub pool: PoolEdge,
    pub token_in: Address,
    pub token_out: Address,
    pub amount_in: U256,
    pub amount_out: U256,
}

/// A complete route (possibly multi-hop)
#[derive(Debug, Clone)]
pub struct Route {
    pub hops: Vec<RouteHop>,
    pub total_amount_in: U256,
    pub total_amount_out: U256,
    pub price_impact: f64,
    pub gas_estimate: u64,
}

/// A split route (multiple routes for same swap)
#[derive(Debug, Clone)]
pub struct SplitRoute {
    pub routes: Vec<(Route, u8)>,  // (route, percentage)
    pub total_amount_in: U256,
    pub total_amount_out: U256,
    pub combined_price_impact: f64,
    pub total_gas_estimate: u64,
}

/// Quote response
#[derive(Debug, Clone, Serialize)]
pub struct Quote {
    pub route: SplitRoute,
    pub amount_in: String,
    pub amount_out: String,
    pub amount_out_min: String,  // With slippage
    pub price_impact: f64,
    pub gas_estimate: u64,
    pub gas_estimate_usd: f64,
    pub route_string: String,  // "ETH → USDC → WBTC"
}
```

## Routing Algorithms

### Path Finding (Dijkstra Variant)
```rust
use std::collections::{BinaryHeap, HashMap};
use std::cmp::Ordering;

#[derive(Clone, Eq, PartialEq)]
struct PathState {
    token: Address,
    amount_out: U256,
    path: Vec<PoolEdge>,
    gas_used: u64,
}

impl Ord for PathState {
    fn cmp(&self, other: &Self) -> Ordering {
        // Maximize output (reverse ordering for max-heap behavior)
        other.amount_out.cmp(&self.amount_out)
    }
}

impl PartialOrd for PathState {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

pub fn find_best_route(
    graph: &PoolGraph,
    token_in: Address,
    token_out: Address,
    amount_in: U256,
    max_hops: usize,
) -> Option<Route> {
    let mut heap = BinaryHeap::new();
    let mut best: HashMap<Address, U256> = HashMap::new();
    
    // Start state
    heap.push(PathState {
        token: token_in,
        amount_out: amount_in,
        path: vec![],
        gas_used: 0,
    });
    
    while let Some(state) = heap.pop() {
        // Found destination
        if state.token == token_out {
            return Some(build_route(state));
        }
        
        // Skip if we've seen better
        if let Some(&best_amount) = best.get(&state.token) {
            if state.amount_out <= best_amount {
                continue;
            }
        }
        best.insert(state.token, state.amount_out);
        
        // Max hops reached
        if state.path.len() >= max_hops {
            continue;
        }
        
        // Explore neighbors
        for pool in graph.get_pools_for_token(state.token) {
            let next_token = pool.other_token(state.token);
            
            // Simulate swap
            let swap_result = simulate_swap(&pool, state.amount_out, state.token);
            
            if let Ok(amount_out) = swap_result {
                let mut new_path = state.path.clone();
                new_path.push(pool.clone());
                
                heap.push(PathState {
                    token: next_token,
                    amount_out,
                    path: new_path,
                    gas_used: state.gas_used + estimate_gas(&pool),
                });
            }
        }
    }
    
    None
}
```

### Split Routing
```rust
/// Find optimal split across multiple routes
pub fn find_split_route(
    graph: &PoolGraph,
    token_in: Address,
    token_out: Address,
    amount_in: U256,
    max_splits: usize,
) -> Option<SplitRoute> {
    // Find top N routes
    let routes = find_top_routes(graph, token_in, token_out, amount_in, max_splits * 2);
    
    if routes.is_empty() {
        return None;
    }
    
    // If single route is best, return it
    if routes.len() == 1 {
        return Some(SplitRoute::single(routes.into_iter().next().unwrap()));
    }
    
    // Try different split ratios
    let best_split = optimize_splits(&routes, amount_in, max_splits);
    
    Some(best_split)
}

/// Binary search for optimal split ratio between two routes
fn optimize_two_route_split(
    route_a: &Route,
    route_b: &Route,
    total_amount: U256,
) -> (u8, u8) {
    let mut best_output = U256::zero();
    let mut best_split = (100u8, 0u8);
    
    // Try splits in 5% increments
    for split_a in (0..=100).step_by(5) {
        let split_b = 100 - split_a;
        
        let amount_a = total_amount * U256::from(split_a) / U256::from(100);
        let amount_b = total_amount - amount_a;
        
        let output_a = simulate_route(route_a, amount_a);
        let output_b = simulate_route(route_b, amount_b);
        
        let total_output = output_a + output_b;
        
        if total_output > best_output {
            best_output = total_output;
            best_split = (split_a, split_b);
        }
    }
    
    best_split
}
```

## Swap Simulation

### Uniswap v3 Math
```rust
use ethers::types::{U256, I256};

/// Q96 constant for fixed-point math
const Q96: U256 = U256([0, 0x1_0000_0000_0000_0000, 0, 0]);

/// Simulate a swap through a single pool
pub fn simulate_swap(
    pool: &PoolEdge,
    amount_in: U256,
    zero_for_one: bool,
) -> Result<SwapResult> {
    let mut state = SwapState {
        amount_remaining: I256::from_raw(amount_in),
        amount_calculated: I256::zero(),
        sqrt_price_x96: pool.sqrt_price_x96,
        tick: pool.tick,
        liquidity: pool.liquidity,
    };
    
    // Get tick data (simplified - in reality from subgraph/RPC)
    let ticks = get_tick_data(pool)?;
    
    while !state.amount_remaining.is_zero() {
        let step = compute_swap_step(
            state.sqrt_price_x96,
            get_sqrt_ratio_at_tick(state.tick + if zero_for_one { -1 } else { 1 })?,
            state.liquidity,
            state.amount_remaining,
            pool.fee,
        )?;
        
        state.sqrt_price_x96 = step.sqrt_price_next;
        state.amount_remaining -= step.amount_in + step.fee_amount;
        state.amount_calculated += step.amount_out;
        
        // Cross tick if needed
        if state.sqrt_price_x96 == step.sqrt_price_target {
            if let Some(tick_data) = ticks.get(&state.tick) {
                state.liquidity = if zero_for_one {
                    state.liquidity - tick_data.liquidity_net as u128
                } else {
                    state.liquidity + tick_data.liquidity_net as u128
                };
            }
            state.tick = if zero_for_one { state.tick - 1 } else { state.tick + 1 };
        }
    }
    
    Ok(SwapResult {
        amount_out: state.amount_calculated.abs().into_raw(),
        sqrt_price_after: state.sqrt_price_x96,
        tick_after: state.tick,
    })
}

/// Get sqrt ratio at a given tick
pub fn get_sqrt_ratio_at_tick(tick: i32) -> Result<U256> {
    // sqrt(1.0001^tick) * 2^96
    let abs_tick = tick.abs() as u32;
    
    let mut ratio = if abs_tick & 0x1 != 0 {
        U256::from_dec_str("79228162514264337593543950336")?
    } else {
        U256::from_dec_str("79228162514264337593543950336")?
    };
    
    // ... full implementation
    
    if tick < 0 {
        ratio = U256::MAX / ratio;
    }
    
    Ok(ratio)
}
```

## API Endpoints

### HTTP API with Axum
```rust
use axum::{
    routing::{get, post},
    Router, Json, Extension,
    extract::{Query, State},
};
use std::sync::Arc;

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .route("/v1/quote", get(get_quote))
        .route("/v1/route", post(get_route))
        .route("/v1/pools", get(get_pools))
        .with_state(Arc::new(state))
}

#[derive(Deserialize)]
pub struct QuoteRequest {
    pub token_in: Address,
    pub token_out: Address,
    pub amount_in: String,
    pub slippage: Option<f64>,
    pub max_hops: Option<usize>,
    pub max_splits: Option<usize>,
}

#[derive(Serialize)]
pub struct QuoteResponse {
    pub quote: Quote,
    pub timestamp: u64,
    pub cached: bool,
}

async fn get_quote(
    State(state): State<Arc<AppState>>,
    Query(params): Query<QuoteRequest>,
) -> Result<Json<QuoteResponse>, ApiError> {
    let amount_in = U256::from_dec_str(&params.amount_in)?;
    let slippage = params.slippage.unwrap_or(0.5);
    let max_hops = params.max_hops.unwrap_or(4);
    let max_splits = params.max_splits.unwrap_or(3);
    
    // Check cache first
    let cache_key = format!(
        "{}:{}:{}",
        params.token_in, params.token_out, bucket_amount(amount_in)
    );
    
    if let Some(cached) = state.cache.get(&cache_key).await {
        return Ok(Json(QuoteResponse {
            quote: cached,
            timestamp: now(),
            cached: true,
        }));
    }
    
    // Calculate route
    let route = state.router.find_best_route(
        params.token_in,
        params.token_out,
        amount_in,
        max_hops,
        max_splits,
    ).await?;
    
    let quote = Quote::from_route(route, slippage);
    
    // Cache result
    state.cache.set(&cache_key, &quote, Duration::from_secs(15)).await;
    
    Ok(Json(QuoteResponse {
        quote,
        timestamp: now(),
        cached: false,
    }))
}
```

## Performance Optimization

### Parallel Path Finding
```rust
use rayon::prelude::*;

pub fn find_routes_parallel(
    graph: &PoolGraph,
    token_in: Address,
    token_out: Address,
    amount_in: U256,
    max_hops: usize,
) -> Vec<Route> {
    // Get all possible starting pools
    let starting_pools: Vec<_> = graph
        .get_pools_for_token(token_in)
        .collect();
    
    // Search from each starting pool in parallel
    starting_pools
        .par_iter()
        .filter_map(|pool| {
            find_route_from_pool(graph, pool, token_out, amount_in, max_hops)
        })
        .collect()
}
```

### Memory-Efficient Graph
```rust
use parking_lot::RwLock;

/// Arc-wrapped graph for concurrent access
pub struct ConcurrentPoolGraph {
    inner: RwLock<PoolGraphInner>,
}

impl ConcurrentPoolGraph {
    /// Read-only access for queries
    pub fn read(&self) -> impl Deref<Target = PoolGraphInner> + '_ {
        self.inner.read()
    }
    
    /// Write access for updates
    pub fn write(&self) -> impl DerefMut<Target = PoolGraphInner> + '_ {
        self.inner.write()
    }
}
```

## Benchmarks

### Benchmark Template
```rust
// benches/routing_benchmark.rs
use criterion::{criterion_group, criterion_main, Criterion, BenchmarkId};

fn bench_pathfinding(c: &mut Criterion) {
    let graph = setup_test_graph(1000); // 1000 pools
    
    let mut group = c.benchmark_group("pathfinding");
    
    for hops in [2, 3, 4] {
        group.bench_with_input(
            BenchmarkId::new("dijkstra", hops),
            &hops,
            |b, &hops| {
                b.iter(|| {
                    find_best_route(&graph, WETH, USDC, amount, hops)
                });
            },
        );
    }
    
    group.finish();
}

fn bench_simulation(c: &mut Criterion) {
    let pool = setup_test_pool();
    
    c.bench_function("swap_simulation", |b| {
        b.iter(|| {
            simulate_swap(&pool, U256::from(1_000_000_000_000_000_000u128), true)
        });
    });
}

criterion_group!(benches, bench_pathfinding, bench_simulation);
criterion_main!(benches);
```

### Performance Targets
```
Single-hop route:  < 1ms
4-hop route:       < 5ms
Split route (3):   < 10ms
Full quote:        < 15ms (including simulation)
```

## Sprint Deliverables

### Phase 1 (Sprint 3-4): Foundation
- [ ] Cargo workspace setup
- [ ] Pool graph data structure
- [ ] Basic path finding (single-hop)
- [ ] HTTP API skeleton

### Phase 2 (Sprint 5-6): Core Algorithm
- [ ] Multi-hop routing (max 4 hop)
- [ ] Swap simulation engine
- [ ] Split routing (max 3 split)
- [ ] Gas estimation

### Phase 3 (Sprint 7-8): Optimization
- [ ] Performance tuning
- [ ] Parallelization
- [ ] Caching layer
- [ ] Production hardening

## Useful Commands
```bash
# Build
cargo build --release

# Test
cargo test

# Bench
cargo bench

# Clippy (linting)
cargo clippy -- -D warnings

# Format
cargo fmt

# Run
cargo run --release

# Docker build
docker build -t basebook-router .
```

## Response Guidelines
1. Prioritize performance in all suggestions
2. Include Big-O complexity analysis
3. Consider concurrent access patterns
4. Provide benchmark comparisons
5. Reference Uniswap/1inch router implementations

---
*BaseBook DEX - Rust Engineer Configuration*
