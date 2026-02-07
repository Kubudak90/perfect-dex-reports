# Contributing to BaseBook Router

Thank you for your interest in contributing to the BaseBook DEX Router! This document provides guidelines and instructions for contributors.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style](#code-style)
- [Pull Request Process](#pull-request-process)
- [Performance Guidelines](#performance-guidelines)
- [Documentation](#documentation)

---

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Focus on constructive feedback
- Accept criticism gracefully
- Prioritize community well-being

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Publishing others' private information
- Trolling or inflammatory comments

---

## Getting Started

### Prerequisites

- **Rust**: 1.75+ (stable)
- **Cargo**: Latest
- **Git**: For version control
- **Docker**: (optional) For containerized testing

### Quick Start

```bash
# Clone repository
git clone https://github.com/basebook/dex.git
cd dex/router

# Install dependencies
cargo build

# Run tests
cargo test

# Run router
cargo run --bin routing-engine
```

---

## Development Setup

### 1. Install Rust

```bash
# Install rustup (if not installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Update to latest stable
rustup update stable

# Verify installation
rustc --version
cargo --version
```

### 2. Install Development Tools

```bash
# Formatter
rustup component add rustfmt

# Linter
rustup component add clippy

# Code coverage (optional)
cargo install cargo-tarpaulin

# Benchmarking (already included via Criterion)
# Flamegraph profiling
cargo install flamegraph
```

### 3. IDE Setup

#### Visual Studio Code

Recommended extensions:
- **rust-analyzer**: LSP for Rust
- **CodeLLDB**: Debugger
- **Better TOML**: TOML syntax highlighting
- **Error Lens**: Inline errors

```json
// .vscode/settings.json
{
  "rust-analyzer.cargo.allFeatures": true,
  "rust-analyzer.checkOnSave.command": "clippy",
  "editor.formatOnSave": true,
  "[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer"
  }
}
```

#### IntelliJ IDEA / CLion

- Install "Rust" plugin
- Enable "Rustfmt" on save
- Enable "Clippy" integration

### 4. Environment Configuration

```bash
# Copy example env file
cp .env.example .env

# Edit with your values
vim .env
```

Required variables:
```bash
CHAIN_ID=8453
RPC_URL=https://mainnet.base.org
```

---

## Project Structure

```
routing-engine/
├── src/
│   ├── api/            # HTTP API (Axum)
│   │   ├── mod.rs
│   │   ├── routes.rs   # Endpoint handlers
│   │   └── types.rs    # Request/response types
│   │
│   ├── cache/          # Caching layer
│   │   ├── mod.rs
│   │   └── lru.rs      # LRU cache implementation
│   │
│   ├── graph/          # Pool graph structure
│   │   ├── mod.rs
│   │   ├── pool.rs     # Pool edge
│   │   └── token.rs    # Token node
│   │
│   ├── routing/        # Routing algorithms
│   │   ├── mod.rs
│   │   ├── single_hop.rs    # Direct routing
│   │   ├── multi_hop.rs     # Multi-hop routing
│   │   ├── pathfinder.rs    # Path finding
│   │   ├── split.rs         # Split routing
│   │   ├── parallel.rs      # Parallel evaluation
│   │   └── router.rs        # Main router
│   │
│   ├── simulation/     # Swap simulation
│   │   ├── mod.rs
│   │   └── swap.rs     # Uniswap v3 math
│   │
│   ├── lib.rs          # Library exports
│   └── main.rs         # Binary entry point
│
├── tests/              # Integration tests
│   ├── api_test.rs
│   ├── integration_test.rs
│   └── multi_hop_split_test.rs
│
├── benches/            # Benchmarks
│   └── routing_benchmark.rs
│
├── Cargo.toml          # Dependencies
├── Cargo.lock          # Locked dependencies
└── README.md           # Documentation
```

---

## Development Workflow

### 1. Pick an Issue

- Check [GitHub Issues](https://github.com/basebook/dex/issues)
- Look for `good first issue` or `help wanted` labels
- Comment on issue to claim it

### 2. Create Branch

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Or for bug fix
git checkout -b fix/bug-description
```

**Branch Naming Convention:**
- `feature/`: New features
- `fix/`: Bug fixes
- `perf/`: Performance improvements
- `docs/`: Documentation changes
- `test/`: Test additions/fixes
- `refactor/`: Code refactoring

### 3. Make Changes

```bash
# Edit files
vim src/routing/single_hop.rs

# Format code
cargo fmt

# Run linter
cargo clippy -- -D warnings

# Run tests
cargo test
```

### 4. Commit Changes

**Commit Message Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `perf`: Performance improvement
- `docs`: Documentation
- `test`: Tests
- `refactor`: Code restructuring
- `style`: Code style (formatting)
- `chore`: Build/tooling

**Examples:**
```bash
git commit -m "feat(routing): add 5-hop support"
git commit -m "fix(cache): prevent cache overflow"
git commit -m "perf(routing): optimize path finding algorithm"
git commit -m "docs(api): add WebSocket examples"
```

### 5. Push and Create PR

```bash
# Push to your fork
git push origin feature/your-feature-name

# Create PR on GitHub
# Use PR template and fill in all sections
```

---

## Testing

### Unit Tests

```bash
# Run all unit tests
cargo test --lib

# Run specific module
cargo test --lib routing::

# Run with output
cargo test --lib -- --nocapture

# Run specific test
cargo test test_single_hop_routing
```

### Integration Tests

```bash
# Run all integration tests
cargo test --test '*'

# Run specific test file
cargo test --test api_test

# Run with logging
RUST_LOG=debug cargo test --test api_test
```

### Benchmarks

```bash
# Run all benchmarks
cargo bench

# Run specific benchmark
cargo bench single_hop

# Generate flamegraph
cargo flamegraph --bench routing_benchmark
```

### Coverage

```bash
# Generate coverage report
cargo tarpaulin --out Html --output-dir coverage

# View report
open coverage/index.html
```

**Coverage Requirements:**
- New code: >80% coverage
- Critical paths (routing): >95% coverage
- Non-critical (UI/logging): >60% coverage

---

## Code Style

### Rust Style Guide

Follow the [Rust Style Guide](https://doc.rust-lang.org/nightly/style-guide/):

```rust
// ✅ Good
pub fn find_best_route(
    graph: &PoolGraph,
    token_in: Address,
    token_out: Address,
    amount: U256,
) -> Option<Route> {
    // Implementation
}

// ❌ Bad
pub fn find_best_route(graph: &PoolGraph,token_in: Address,token_out: Address,amount: U256)->Option<Route>{
    // Implementation
}
```

### Naming Conventions

```rust
// Functions: snake_case
fn calculate_price_impact(amount: U256) -> f64 { }

// Types/Structs: PascalCase
struct PoolGraph { }
struct RouteHop { }

// Constants: SCREAMING_SNAKE_CASE
const MAX_HOPS: usize = 4;
const DEFAULT_SLIPPAGE: f64 = 0.5;

// Modules: snake_case
mod multi_hop;
mod path_finder;
```

### Documentation

All public items must have documentation:

```rust
/// Finds the best route between two tokens.
///
/// # Arguments
///
/// * `graph` - The pool graph to search
/// * `token_in` - Input token address
/// * `token_out` - Output token address
/// * `amount` - Amount to swap (in wei)
///
/// # Returns
///
/// `Some(Route)` if a route is found, `None` otherwise.
///
/// # Examples
///
/// ```
/// use routing_engine::routing::find_best_route;
///
/// let route = find_best_route(&graph, token_a, token_b, amount);
/// assert!(route.is_some());
/// ```
pub fn find_best_route(
    graph: &PoolGraph,
    token_in: Address,
    token_out: Address,
    amount: U256,
) -> Option<Route> {
    // Implementation
}
```

### Error Handling

```rust
// ✅ Good: Use Result for recoverable errors
pub fn parse_amount(s: &str) -> Result<U256, ParseError> {
    U256::from_str(s).map_err(|_| ParseError::InvalidFormat)
}

// ✅ Good: Use Option for missing values
pub fn get_pool(pool_id: &[u8; 32]) -> Option<PoolEdge> {
    self.pool_index.get(pool_id).map(|p| p.clone())
}

// ❌ Bad: Use panic! for recoverable errors
pub fn parse_amount(s: &str) -> U256 {
    U256::from_str(s).expect("Invalid amount")  // DON'T DO THIS
}
```

### Performance

```rust
// ✅ Good: Avoid unnecessary clones
pub fn process_route(route: &Route) -> RouteResult {
    // Use reference
}

// ❌ Bad: Unnecessary clone
pub fn process_route(route: Route) -> RouteResult {
    // Takes ownership, forces clone at call site
}

// ✅ Good: Use iterators
let sum: u64 = routes.iter().map(|r| r.gas_estimate).sum();

// ❌ Bad: Manual loop
let mut sum = 0;
for route in &routes {
    sum += route.gas_estimate;
}
```

---

## Pull Request Process

### Before Submitting

**Checklist:**
- [ ] Code compiles without warnings
- [ ] All tests pass
- [ ] Code is formatted (`cargo fmt`)
- [ ] No clippy warnings (`cargo clippy`)
- [ ] Documentation is updated
- [ ] New tests added for new functionality
- [ ] Benchmarks run (if performance-critical)
- [ ] CHANGELOG.md updated (if applicable)

### PR Template

```markdown
## Description

Brief description of changes.

## Type of Change

- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change
- [ ] Documentation update
- [ ] Performance improvement

## Motivation

Why is this change needed?

## Changes Made

- Change 1
- Change 2
- Change 3

## Testing

How was this tested?

## Performance Impact

- [ ] No performance impact
- [ ] Performance improved (provide benchmarks)
- [ ] Performance degraded (justify why)

## Breaking Changes

List any breaking changes and migration guide.

## Checklist

- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Code formatted (`cargo fmt`)
- [ ] Clippy clean (`cargo clippy`)
- [ ] Benchmarks run (if applicable)
```

### Review Process

1. **Automated Checks**: CI runs tests, linting, formatting
2. **Code Review**: At least one maintainer reviews
3. **Feedback**: Address review comments
4. **Approval**: Maintainer approves
5. **Merge**: Squash and merge to main

### Getting Your PR Merged Faster

- **Small PRs**: Keep PRs focused and small
- **Clear description**: Explain what and why
- **Tests**: Include comprehensive tests
- **Documentation**: Update relevant docs
- **Respond quickly**: Address feedback promptly

---

## Performance Guidelines

### Benchmarking

Always benchmark performance-critical code:

```rust
#[bench]
fn bench_my_feature(b: &mut Bencher) {
    b.iter(|| {
        // Code to benchmark
        my_feature(black_box(input))
    });
}
```

### Performance Targets

- **Single-hop routing**: <1µs (currently: 190ns ✅)
- **Multi-hop (4 hops)**: <5ms (currently: 18.8µs ✅)
- **Cache lookup**: <100µs (currently: 672ns ✅)
- **Full quote**: <10ms (currently: ~2ms ✅)

### Optimization Tips

1. **Avoid Allocations**: Use references where possible
2. **Use Iterators**: More efficient than manual loops
3. **Profile First**: Use `cargo flamegraph` to find hotspots
4. **Parallelize**: Use `rayon` for data parallelism
5. **Cache Smart**: LRU cache with appropriate TTL

---

## Documentation

### Types of Documentation

1. **Code Comments**: Explain complex logic
2. **Doc Comments**: Public API documentation
3. **README.md**: Project overview and quick start
4. **CONTRIBUTING.md**: This file
5. **API_REFERENCE.md**: Detailed API documentation

### Writing Good Documentation

```rust
/// Calculates price impact for a swap.
///
/// Price impact is calculated as:
/// ```text
/// impact = (execution_price - mid_price) / mid_price * 100
/// ```
///
/// # Arguments
///
/// * `amount_in` - Input amount in wei
/// * `amount_out` - Output amount in wei
/// * `pool` - Pool to swap through
///
/// # Returns
///
/// Price impact as a percentage (0.15 = 0.15%)
///
/// # Examples
///
/// ```
/// let impact = calculate_price_impact(
///     U256::from(1_000_000_000_000_000_000u128),  // 1 ETH
///     U256::from(2_450_000_000u128),              // 2,450 USDC
///     &pool
/// );
/// assert!(impact < 1.0);  // Less than 1% impact
/// ```
pub fn calculate_price_impact(
    amount_in: U256,
    amount_out: U256,
    pool: &PoolEdge,
) -> f64 {
    // Implementation
}
```

---

## Common Tasks

### Adding a New Feature

1. Create issue describing feature
2. Discuss design in issue comments
3. Create feature branch
4. Implement feature with tests
5. Add benchmarks (if performance-critical)
6. Update documentation
7. Submit PR

### Fixing a Bug

1. Create issue with reproduction steps
2. Write failing test that reproduces bug
3. Fix bug
4. Verify test now passes
5. Submit PR

### Improving Performance

1. Profile current code with `cargo flamegraph`
2. Identify bottleneck
3. Write benchmark for that code path
4. Implement optimization
5. Run benchmark to verify improvement
6. Submit PR with benchmark results

---

## Release Process

(For maintainers)

1. **Version Bump**: Update `Cargo.toml` version
2. **Changelog**: Update `CHANGELOG.md`
3. **Tag**: Create git tag `v0.2.0`
4. **Build**: `cargo build --release`
5. **Test**: Full test suite on release build
6. **Publish**: `cargo publish` (if crate)
7. **Docker**: Build and push Docker image
8. **Announce**: Post release notes

---

## Getting Help

### Resources

- **Documentation**: [README.md](./README.md)
- **API Reference**: [API_REFERENCE.md](./API_REFERENCE.md)
- **Troubleshooting**: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **Rust Book**: [doc.rust-lang.org/book](https://doc.rust-lang.org/book/)

### Ask Questions

- **GitHub Discussions**: For general questions
- **Discord**: #dev-help channel
- **Stack Overflow**: Tag `basebook-dex`

### Report Issues

- **Bugs**: [GitHub Issues](https://github.com/basebook/dex/issues)
- **Security**: Email security@basebook.fi (private disclosure)

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## Thank You!

Your contributions make BaseBook DEX better for everyone. We appreciate your time and effort! 🚀

**Happy coding!** 💻
