# Migration Plan: ethers-rs to Alloy

## Overview

This document describes the migration of the BaseBook DEX Router (`routing-engine`) from `ethers-rs` v2.0 to `alloy` v1.x.

**Why migrate?**
- `ethers-rs` is officially deprecated; the maintainers recommend migrating to Alloy.
- Alloy offers better performance, modern Rust patterns, and active maintenance.
- Alloy `sol!` macro replaces the `abigen!` macro for type-safe contract bindings.
- Alloy uses a fillers/layers pattern instead of the middleware stack.

**Migration Scope:** This codebase uses ethers-rs **exclusively for types** (`Address`, `U256`). There are no provider connections, contract bindings, signers, or middleware used. This makes the migration straightforward.

---

## Current ethers-rs Usage Analysis

### Dependencies

**Workspace `Cargo.toml`:**
```toml
ethers = { version = "2.0", features = ["legacy", "ws"] }
```

**`routing-engine/Cargo.toml`:**
```toml
ethers = { workspace = true }
```

### Imports by File

| File | ethers Import | Usage |
|------|--------------|-------|
| `src/utils/types.rs` | `ethers::types::Address`, `ethers::types::U256` | Address constants (WETH, USDC), U256 conversion helpers |
| `src/utils/error.rs` | `ethers::types::Address` | Error type fields |
| `src/utils/math.rs` | `ethers::types::U256` | Math operations (sqrt, slippage) |
| `src/graph/node.rs` | `ethers::types::Address` | TokenNode struct field |
| `src/graph/edge.rs` | `ethers::types::{Address, U256}` | PoolEdge struct fields |
| `src/graph/pool_graph.rs` | `ethers::types::Address` (+ `U256` in tests) | Graph lookup keys, node indices |
| `src/routing/route.rs` | `ethers::types::{Address, U256}` | RouteHop and Route struct fields |
| `src/routing/router.rs` | `ethers::types::{Address, U256}` | Router method params, test helpers |
| `src/routing/single_hop.rs` | `ethers::types::{Address, U256}` | Swap simulation, routing logic |
| `src/routing/multi_hop.rs` | `ethers::types::{Address, U256}` | Multi-hop pathfinding (BinaryHeap) |
| `src/routing/pathfinder.rs` | `ethers::types::{Address, U256}` | Best-route pathfinding |
| `src/routing/parallel.rs` | `ethers::types::{Address, U256}` | Parallel route evaluation |
| `src/routing/split.rs` | `ethers::types::U256` (+ `Address` in tests) | Split route optimization |
| `src/simulation/swap.rs` | `ethers::types::U256` | SwapResult fields |
| `src/sync/pool_sync.rs` | `ethers::types::{Address, U256}` | Mock pool setup |
| `src/api/dto.rs` | `ethers::types::Address` | QuoteRequest deserialization |
| `src/api/handlers.rs` | `ethers::types::U256` | Amount parsing (`U256::from_dec_str`) |
| `src/cache/enhanced_route_cache.rs` | `ethers::types::{Address, U256}` | Cache keys and lookups |
| `tests/api_test.rs` | `ethers::types::{Address, U256}` | Test helpers |
| `tests/integration_test.rs` | `ethers::types::{Address, U256}` | Integration tests |
| `tests/multi_hop_split_test.rs` | `ethers::types::{Address, U256}` | Split routing tests |
| `benches/routing_benchmark.rs` | `ethers::types::{Address, U256}` | Benchmark setup |
| `benches/memory_profile.rs` | `ethers::types::{Address, U256}` | Memory profiling |

**Total: 22 files affected, all using only `ethers::types::{Address, U256}`**

### ethers-rs Features Used

Only two types from `ethers::types` are used throughout the entire codebase:

1. **`Address`** - 20-byte Ethereum address
2. **`U256`** - 256-bit unsigned integer

Key methods used on these types:
- `Address::from_low_u64_be(n)` - Create address from u64
- `Address::from_str("0x...")` - Parse address from hex string
- `Address::zero()` - Zero address
- `U256::from(n)` - Create from numeric literal
- `U256::from_dec_str("...")` - Parse from decimal string
- `U256::zero()` - Zero value
- `U256::is_zero()` - Check if zero
- `U256::as_u128()` - Convert to u128
- `U256::to_string()` - Decimal string representation
- `U256` arithmetic: `+`, `-`, `*`, `/`, comparison operators
- `U256.0` - Access internal `[u64; 4]` limbs (in `u256_ext::to_f64`)
- Serde `Serialize`/`Deserialize` derive for both types

---

## Alloy Equivalents

### Type Mapping

| ethers-rs | alloy | Notes |
|-----------|-------|-------|
| `ethers::types::Address` | `alloy::primitives::Address` | Same 20-byte type |
| `ethers::types::U256` | `alloy::primitives::U256` | Alloy uses `ruint::Uint<256, 4>` |
| `ethers::types::H256` | `alloy::primitives::B256` | Not used in this codebase |
| `ethers::types::Bytes` | `alloy::primitives::Bytes` | Not used in this codebase |

### Method Migration

| ethers-rs Method | alloy Equivalent | Notes |
|-----------------|-----------------|-------|
| `Address::from_low_u64_be(n)` | `Address::with_last_byte(n as u8)` or `Address::from(U160::from(n))` | Need to construct from `FixedBytes` |
| `Address::from_str("0x...")` | `"0x...".parse::<Address>().unwrap()` or `address!("...")` | `address!` macro is preferred |
| `Address::zero()` | `Address::ZERO` | Constant instead of method |
| `U256::from(n)` | `U256::from(n)` | Same API |
| `U256::from_dec_str("...")` | `U256::from_str("...")` or `"...".parse::<U256>()` | Uses standard `FromStr` trait |
| `U256::zero()` | `U256::ZERO` | Constant instead of method |
| `U256::is_zero()` | `U256::is_zero()` or `value == U256::ZERO` | Same API |
| `U256::as_u128()` | `u128::try_from(value).unwrap()` or `value.to::<u128>()` | Alloy uses `TryFrom`/`to()` |
| `U256::to_string()` | `U256::to_string()` | Same via `Display` trait |
| `U256.0` (internal limbs) | `value.as_limbs()` | Returns `&[u64; 4]` |
| `U256` arithmetic | Same operators | Alloy `U256` supports all arithmetic |
| Serde for Address | Works with `alloy` serde feature | Need `serde` feature flag |
| Serde for U256 | Works with `alloy` serde feature | Need `serde` feature flag |

### Import Changes

**Before (ethers-rs):**
```rust
use ethers::types::{Address, U256};
```

**After (alloy):**
```rust
use alloy::primitives::{Address, U256};
```

---

## Dependency Changes

### Cargo.toml (Workspace)

**Remove:**
```toml
ethers = { version = "2.0", features = ["legacy", "ws"] }
```

**Add:**
```toml
alloy = { version = "1", default-features = false, features = ["primitives", "serde"] }
```

Since this codebase only uses `Address` and `U256`, we only need the `primitives` and `serde` features. If future work adds RPC providers or contract bindings, additional features can be enabled:
- `provider-http` - HTTP JSON-RPC provider
- `provider-ws` - WebSocket provider
- `contract` - Contract interaction via `sol!` macro
- `signers` - Transaction signing
- `full` - Everything

### routing-engine/Cargo.toml

No changes needed beyond the workspace dependency reference (already uses `{ workspace = true }`).

---

## Breaking Changes and Gotchas

### 1. `Address::from_low_u64_be(n)` does not exist in alloy

**ethers-rs:**
```rust
let addr = Address::from_low_u64_be(1);
```

**alloy:** There is no direct equivalent. Options:
```rust
// Option A: Use fixed bytes directly
use alloy::primitives::{Address, FixedBytes};
let addr = Address::from(FixedBytes::<20>::left_padding_from(&1u64.to_be_bytes()));

// Option B: Create a helper function
fn address_from_u64(n: u64) -> Address {
    let mut bytes = [0u8; 20];
    bytes[12..20].copy_from_slice(&n.to_be_bytes());
    Address::from(bytes)
}
```

This is used extensively in tests (30+ occurrences). A helper function is the cleanest approach.

### 2. `U256::from_dec_str` does not exist in alloy

**ethers-rs:**
```rust
let amount = U256::from_dec_str("1000000").unwrap();
```

**alloy:**
```rust
let amount: U256 = "1000000".parse().unwrap();
// or
let amount = U256::from_str_radix("1000000", 10).unwrap();
```

### 3. `U256::as_u128()` vs alloy conversion

**ethers-rs:**
```rust
let val: u128 = amount.as_u128();
```

**alloy:**
```rust
let val: u128 = amount.to::<u128>(); // panics on overflow
// or safer:
let val: u128 = u128::try_from(amount).unwrap();
```

### 4. `U256.0` internal limbs access

**ethers-rs:**
```rust
for word in value.0.iter() { ... }
```

**alloy:**
```rust
for word in value.as_limbs().iter() { ... }
```

### 5. Serde serialization format differences

ethers-rs `U256` serializes as hex string (`"0x..."`) by default.
alloy `U256` also serializes as hex string with the `serde` feature.
`Address` serialization is compatible (checksummed hex).

For the `QuoteRequest` deserialization where `Address` is parsed from query params, alloy's `Address` implements `Deserialize` and will parse `0x`-prefixed hex strings.

### 6. `Address::zero()` becomes `Address::ZERO`

**ethers-rs:**
```rust
if pool.hook_address != Address::zero() { ... }
```

**alloy:**
```rust
if pool.hook_address != Address::ZERO { ... }
```

### 7. `U256::zero()` becomes `U256::ZERO`

**ethers-rs:**
```rust
let mut best = U256::zero();
```

**alloy:**
```rust
let mut best = U256::ZERO;
```

---

## Migration Steps (Execution Order)

### Phase 1: Update Dependencies
1. Update workspace `Cargo.toml`: replace `ethers` with `alloy`
2. Update `routing-engine/Cargo.toml`: replace `ethers` with `alloy`
3. Run `cargo check` to identify all compilation errors

### Phase 2: Create Helper Functions
1. Add `address_from_u64` helper in `utils/types.rs` for test address creation
2. This replaces `Address::from_low_u64_be` which has no alloy equivalent

### Phase 3: Migrate Source Files (Bottom-Up)
Start with leaf modules that have no internal dependents:

1. **`src/utils/types.rs`** - Address constants, U256 helpers (Effort: Small)
2. **`src/utils/error.rs`** - Error types with Address (Effort: Trivial)
3. **`src/utils/math.rs`** - Math with U256 (Effort: Small)
4. **`src/graph/node.rs`** - TokenNode with Address (Effort: Trivial)
5. **`src/graph/edge.rs`** - PoolEdge with Address + U256 (Effort: Small)
6. **`src/graph/pool_graph.rs`** - Graph with Address (Effort: Small)
7. **`src/simulation/swap.rs`** - SwapResult with U256 (Effort: Trivial)
8. **`src/sync/pool_sync.rs`** - Pool syncer with Address + U256 (Effort: Trivial)
9. **`src/routing/route.rs`** - Route structs (Effort: Small)
10. **`src/routing/single_hop.rs`** - Single hop routing (Effort: Small)
11. **`src/routing/multi_hop.rs`** - Multi-hop routing (Effort: Small)
12. **`src/routing/pathfinder.rs`** - Pathfinder (Effort: Small)
13. **`src/routing/parallel.rs`** - Parallel routing (Effort: Small)
14. **`src/routing/split.rs`** - Split routing (Effort: Small)
15. **`src/routing/router.rs`** - Main router (Effort: Small)
16. **`src/cache/enhanced_route_cache.rs`** - Cache (Effort: Small)
17. **`src/api/dto.rs`** - API DTOs (Effort: Trivial)
18. **`src/api/handlers.rs`** - API handlers (Effort: Small)

### Phase 4: Migrate Tests and Benchmarks
19. **`tests/api_test.rs`** (Effort: Small)
20. **`tests/integration_test.rs`** (Effort: Small)
21. **`tests/multi_hop_split_test.rs`** (Effort: Small)
22. **`benches/routing_benchmark.rs`** (Effort: Small)
23. **`benches/memory_profile.rs`** (Effort: Small)

### Phase 5: Verify
24. `cargo check` - Verify compilation
25. `cargo test` - Verify all tests pass
26. `cargo bench` - Verify benchmarks compile

---

## Effort Estimate

| Category | Files | Effort |
|----------|-------|--------|
| Dependency update | 2 | 5 min |
| Helper functions | 1 | 5 min |
| Source files (types only) | 16 | 30 min |
| Test files | 3 | 15 min |
| Benchmark files | 2 | 10 min |
| Verification | - | 10 min |
| **Total** | **24** | **~75 min** |

The migration is straightforward because:
- Only `Address` and `U256` types are used (no providers, contracts, or signers)
- All changes are mechanical import replacements + method name updates
- The `Address::from_low_u64_be` helper is the only non-trivial change

---

## Verification Checklist

- [ ] All `use ethers::` imports replaced with `use alloy::primitives::`
- [ ] `Address::zero()` replaced with `Address::ZERO`
- [ ] `U256::zero()` replaced with `U256::ZERO`
- [ ] `Address::from_low_u64_be(n)` replaced with helper function
- [ ] `Address::from_str(...)` replaced with `.parse()` or `address!()`
- [ ] `U256::from_dec_str(...)` replaced with `.parse()`
- [ ] `U256::as_u128()` replaced with `.to::<u128>()`
- [ ] `U256.0.iter()` replaced with `.as_limbs().iter()`
- [ ] `cargo check` passes
- [ ] `cargo test` passes
- [ ] No remaining `ethers` references in source code
