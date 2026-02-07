use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use alloy_primitives::{Address, U256};
use routing_engine::utils::address_from_u64;
use routing_engine::{
    cache::EnhancedRouteCache,
    graph::{PoolEdge, PoolGraph, TokenNode},
    routing::{
        find_best_multi_hop_route, find_best_route_parallel, find_best_single_hop_route,
        optimize_split_route, Router,
    },
};
use std::sync::Arc;

fn setup_test_graph(pool_count: usize) -> PoolGraph {
    let graph = PoolGraph::new();

    for i in 0..pool_count {
        let token0 = TokenNode::new(
            address_from_u64(i as u64),
            format!("TOKEN{}", i),
            18,
        );
        let token1 = TokenNode::new(
            address_from_u64((i + 1) as u64),
            format!("TOKEN{}", i + 1),
            18,
        );

        let pool = PoolEdge::new(
            [i as u8; 32],
            token0.address,
            token1.address,
            3000,
            60,
            1_000_000_000_000_000_000_000,
            U256::from(1u128 << 96),
            0,
        );

        graph.upsert_pool(pool, token0, token1);
    }

    graph
}

fn setup_complex_graph() -> Arc<PoolGraph> {
    let graph = Arc::new(PoolGraph::new());

    let tokens: Vec<Address> = (1..=10).map(|i| address_from_u64(i)).collect();
    let nodes: Vec<TokenNode> = tokens
        .iter()
        .enumerate()
        .map(|(i, addr)| TokenNode::new(*addr, format!("T{}", i), 18))
        .collect();

    // Create dense graph for benchmarking
    for i in 0..9 {
        for j in (i + 1)..10 {
            if (j - i) <= 2 {
                // Connect nearby tokens
                let pool_id = [(i * 10 + j) as u8; 32];
                let pool = PoolEdge::new(
                    pool_id,
                    tokens[i],
                    tokens[j],
                    3000,
                    60,
                    5_000_000_000_000_000_000_000,
                    U256::from(1u128 << 96),
                    0,
                );
                graph.upsert_pool(pool, nodes[i].clone(), nodes[j].clone());
            }
        }
    }

    graph
}

fn bench_single_hop(c: &mut Criterion) {
    let graph = setup_test_graph(100);
    let amount = U256::from(1_000_000_000_000_000_000u128);

    c.bench_function("single_hop_routing", |b| {
        b.iter(|| {
            find_best_single_hop_route(
                &graph,
                black_box(address_from_u64(0)),
                black_box(address_from_u64(1)),
                black_box(amount),
            )
        });
    });
}

fn bench_multi_hop(c: &mut Criterion) {
    let graph = setup_complex_graph();
    let amount = U256::from(1_000_000_000_000_000_000u128);

    let mut group = c.benchmark_group("multi_hop_routing");

    for hops in [2, 3, 4] {
        group.bench_with_input(BenchmarkId::from_parameter(hops), &hops, |b, &hops| {
            b.iter(|| {
                find_best_multi_hop_route(
                    &graph,
                    black_box(address_from_u64(1)),
                    black_box(address_from_u64(9)),
                    black_box(amount),
                    hops,
                )
            });
        });
    }

    group.finish();
}

fn bench_parallel_routing(c: &mut Criterion) {
    let graph = setup_complex_graph();
    let amount = U256::from(1_000_000_000_000_000_000u128);

    c.bench_function("parallel_routing", |b| {
        b.iter(|| {
            find_best_route_parallel(
                graph.clone(),
                black_box(address_from_u64(1)),
                black_box(address_from_u64(9)),
                black_box(amount),
                4,
            )
        });
    });
}

fn bench_cache_performance(c: &mut Criterion) {
    let cache = Arc::new(EnhancedRouteCache::default());

    let token_in = address_from_u64(1);
    let token_out = address_from_u64(2);
    let amount = U256::from(1_000_000_000_000_000_000u128);

    // Pre-populate cache
    for i in 0..100 {
        let amount_variant = amount + U256::from(i);
        cache.insert_route(token_in, token_out, amount_variant, 2, {
            let pool = PoolEdge::new(
                [1u8; 32],
                token_in,
                token_out,
                3000,
                60,
                1_000_000,
                U256::from(1u128 << 96),
                0,
            );

            let hop = routing_engine::routing::RouteHop::new(
                pool,
                token_in,
                token_out,
                amount_variant,
                amount_variant,
            );

            routing_engine::routing::Route::new(vec![hop], amount_variant, amount_variant, 0.1, 100_000)
        });
    }

    c.bench_function("cache_hit", |b| {
        b.iter(|| {
            cache.get_route(
                black_box(token_in),
                black_box(token_out),
                black_box(amount),
                2,
            )
        });
    });
}

fn bench_split_optimization(c: &mut Criterion) {
    let graph = setup_complex_graph();
    let amount = U256::from(100_000_000_000_000_000_000u128); // Large amount

    // Pre-compute routes
    let routes = routing_engine::routing::find_top_routes(
        &graph,
        address_from_u64(1),
        address_from_u64(9),
        amount,
        3,
        3,
    );

    c.bench_function("split_optimization", |b| {
        b.iter(|| {
            optimize_split_route(black_box(routes.clone()), black_box(amount))
        });
    });
}

// Note: Async benchmarks removed due to criterion limitations
// Router async methods are tested via integration tests instead

criterion_group!(
    benches,
    bench_single_hop,
    bench_multi_hop,
    bench_parallel_routing,
    bench_cache_performance,
    bench_split_optimization,
);
criterion_main!(benches);
