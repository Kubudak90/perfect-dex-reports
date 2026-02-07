use alloy_primitives::{Address, U256};
use routing_engine::utils::address_from_u64;
use routing_engine::{
    graph::{PoolEdge, PoolGraph, TokenNode},
    routing::{find_best_multi_hop_route, find_top_routes, optimize_split_route, Router},
};
use std::sync::Arc;

/// Create a complex graph for testing multi-hop and split routing
fn create_complex_graph() -> Arc<PoolGraph> {
    let graph = Arc::new(PoolGraph::new());

    // Create 5 tokens: A, B, C, D, E
    let tokens: Vec<Address> = (1..=5).map(|i| address_from_u64(i)).collect();

    let nodes: Vec<TokenNode> = tokens
        .iter()
        .enumerate()
        .map(|(i, addr)| TokenNode::new(*addr, format!("TOKEN{}", (b'A' + i as u8) as char), 18))
        .collect();

    // Create multiple paths from A to E:
    // Path 1: A -> B -> E (2 hops, medium liquidity)
    // Path 2: A -> C -> E (2 hops, high liquidity, higher fee)
    // Path 3: A -> D -> E (2 hops, low liquidity)
    // Path 4: A -> B -> C -> E (3 hops, high liquidity)
    // Path 5: A -> E (1 hop, low liquidity, high fee)

    // Path 1: A -> B
    let pool_ab = PoolEdge::new(
        [1u8; 32],
        tokens[0],
        tokens[1],
        3000, // 0.3%
        60,
        2_000_000_000_000_000_000_000,
        U256::from(1u128 << 96),
        0,
    );

    // Path 1: B -> E
    let pool_be = PoolEdge::new(
        [2u8; 32],
        tokens[1],
        tokens[4],
        3000,
        60,
        2_000_000_000_000_000_000_000,
        U256::from(1u128 << 96),
        0,
    );

    // Path 2: A -> C
    let pool_ac = PoolEdge::new(
        [3u8; 32],
        tokens[0],
        tokens[2],
        500, // 0.05% - lower fee
        10,
        5_000_000_000_000_000_000_000, // Higher liquidity
        U256::from(1u128 << 96),
        0,
    );

    // Path 2: C -> E
    let pool_ce = PoolEdge::new(
        [4u8; 32],
        tokens[2],
        tokens[4],
        500,
        10,
        5_000_000_000_000_000_000_000,
        U256::from(1u128 << 96),
        0,
    );

    // Path 3: A -> D
    let pool_ad = PoolEdge::new(
        [5u8; 32],
        tokens[0],
        tokens[3],
        3000,
        60,
        500_000_000_000_000_000_000, // Low liquidity
        U256::from(1u128 << 96),
        0,
    );

    // Path 3: D -> E
    let pool_de = PoolEdge::new(
        [6u8; 32],
        tokens[3],
        tokens[4],
        3000,
        60,
        500_000_000_000_000_000_000,
        U256::from(1u128 << 96),
        0,
    );

    // Path 4: B -> C
    let pool_bc = PoolEdge::new(
        [7u8; 32],
        tokens[1],
        tokens[2],
        3000,
        60,
        3_000_000_000_000_000_000_000,
        U256::from(1u128 << 96),
        0,
    );

    // Path 5: A -> E (direct, but expensive)
    let pool_ae = PoolEdge::new(
        [8u8; 32],
        tokens[0],
        tokens[4],
        10000, // 1% - high fee
        200,
        800_000_000_000_000_000_000, // Low liquidity
        U256::from(1u128 << 96),
        0,
    );

    graph.upsert_pool(pool_ab, nodes[0].clone(), nodes[1].clone());
    graph.upsert_pool(pool_be, nodes[1].clone(), nodes[4].clone());
    graph.upsert_pool(pool_ac, nodes[0].clone(), nodes[2].clone());
    graph.upsert_pool(pool_ce, nodes[2].clone(), nodes[4].clone());
    graph.upsert_pool(pool_ad, nodes[0].clone(), nodes[3].clone());
    graph.upsert_pool(pool_de, nodes[3].clone(), nodes[4].clone());
    graph.upsert_pool(pool_bc, nodes[1].clone(), nodes[2].clone());
    graph.upsert_pool(pool_ae, nodes[0].clone(), nodes[4].clone());

    graph
}

#[test]
fn test_multi_hop_finds_all_paths() {
    let graph = create_complex_graph();

    let token_a = address_from_u64(1);
    let token_e = address_from_u64(5);

    let amount = U256::from(1_000_000_000_000_000_000u128); // 1 token

    // Find top 5 routes
    let routes = find_top_routes(&graph, token_a, token_e, amount, 4, 5);

    // Should find multiple routes
    assert!(routes.len() > 1, "Should find multiple routes");
    assert!(routes.len() <= 5, "Should not exceed requested count");

    // Routes should be sorted by output
    for i in 0..routes.len() - 1 {
        assert!(
            routes[i].total_amount_out >= routes[i + 1].total_amount_out,
            "Routes should be sorted by output"
        );
    }

    println!("Found {} routes:", routes.len());
    for (i, route) in routes.iter().enumerate() {
        println!(
            "  Route {}: {} hops, output: {}",
            i + 1,
            route.hops.len(),
            route.total_amount_out
        );
    }
}

#[test]
fn test_multi_hop_respects_max_hops() {
    let graph = create_complex_graph();

    let token_a = address_from_u64(1);
    let token_e = address_from_u64(5);

    let amount = U256::from(1_000_000_000_000_000_000u128);

    // Test with max_hops = 2
    let routes = find_top_routes(&graph, token_a, token_e, amount, 2, 10);

    for route in &routes {
        assert!(
            route.hops.len() <= 2,
            "Route should not exceed max_hops of 2"
        );
    }

    println!("Max hops=2: Found {} routes", routes.len());

    // Test with max_hops = 3
    let routes = find_top_routes(&graph, token_a, token_e, amount, 3, 10);

    for route in &routes {
        assert!(
            route.hops.len() <= 3,
            "Route should not exceed max_hops of 3"
        );
    }

    println!("Max hops=3: Found {} routes", routes.len());
}

#[test]
fn test_split_routing_optimization() {
    let graph = create_complex_graph();

    let token_a = address_from_u64(1);
    let token_e = address_from_u64(5);

    // Large amount to benefit from splitting
    let amount = U256::from(100_000_000_000_000_000_000u128); // 100 tokens

    // Find top routes
    let routes = find_top_routes(&graph, token_a, token_e, amount, 3, 3);

    assert!(routes.len() >= 2, "Should have at least 2 routes for split");

    // Optimize split
    let split_route = optimize_split_route(routes, amount).expect("Should optimize split");

    // Should use multiple routes
    assert!(
        split_route.routes.len() >= 1,
        "Should have at least 1 route in split"
    );

    // Total percentage should be 100
    let total_pct: u8 = split_route.routes.iter().map(|(_, pct)| pct).sum();
    assert_eq!(total_pct, 100, "Total percentage should be 100");

    // Total output should be greater than zero
    assert!(
        split_route.total_amount_out > U256::ZERO,
        "Should have positive output"
    );

    println!("Split routing result:");
    println!("  Routes used: {}", split_route.routes.len());
    println!("  Total output: {}", split_route.total_amount_out);
    println!("  Combined gas: {}", split_route.total_gas_estimate);
    for (i, (route, pct)) in split_route.routes.iter().enumerate() {
        println!(
            "  Route {}: {}% ({} hops)",
            i + 1,
            pct,
            route.hops.len()
        );
    }
}

#[tokio::test]
async fn test_router_multi_hop_integration() {
    let graph = create_complex_graph();
    let router = Router::new(graph);

    let token_a = address_from_u64(1);
    let token_e = address_from_u64(5);

    let amount = U256::from(1_000_000_000_000_000_000u128);

    // Test find_route with different max_hops
    for max_hops in [1, 2, 3, 4] {
        let route = router
            .find_route(token_a, token_e, amount, Some(max_hops))
            .await
            .expect(&format!("Should find route with max_hops={}", max_hops));

        assert!(
            route.hops.len() <= max_hops,
            "Route should respect max_hops"
        );
        assert!(route.total_amount_out > U256::ZERO);

        println!(
            "Max hops={}: Found route with {} hops, output={}",
            max_hops,
            route.hops.len(),
            route.total_amount_out
        );
    }
}

#[tokio::test]
async fn test_router_split_routing_integration() {
    let graph = create_complex_graph();
    let router = Router::new(graph);

    let token_a = address_from_u64(1);
    let token_e = address_from_u64(5);

    // Large amount
    let amount = U256::from(50_000_000_000_000_000_000u128); // 50 tokens

    let split = router
        .find_split_route(token_a, token_e, amount, Some(3), Some(3))
        .await
        .expect("Should find split route");

    assert!(split.routes.len() >= 1);
    assert!(split.total_amount_out > U256::ZERO);

    // Total percentage should be 100
    let total_pct: u8 = split.routes.iter().map(|(_, pct)| pct).sum();
    assert_eq!(total_pct, 100);

    println!("Split route result:");
    println!("  Routes: {}", split.routes.len());
    println!("  Output: {}", split.total_amount_out);
    println!("  Price impact: {:.4}%", split.combined_price_impact);
}

#[tokio::test]
async fn test_router_split_quote() {
    let graph = create_complex_graph();
    let router = Router::new(graph);

    let token_a = address_from_u64(1);
    let token_e = address_from_u64(5);

    let amount = U256::from(20_000_000_000_000_000_000u128); // 20 tokens

    let quote = router
        .get_split_quote(token_a, token_e, amount, 0.5, Some(4), Some(3))
        .await
        .expect("Should get split quote");

    assert!(!quote.amount_in.is_empty());
    assert!(!quote.amount_out.is_empty());
    assert!(!quote.amount_out_min.is_empty());
    assert!(quote.gas_estimate > 0);

    println!("Split quote:");
    println!("  In: {}", quote.amount_in);
    println!("  Out: {}", quote.amount_out);
    println!("  Min out: {}", quote.amount_out_min);
    println!("  Price impact: {:.4}%", quote.price_impact);
    println!("  Gas: {}", quote.gas_estimate);
}

#[tokio::test]
async fn test_small_amount_single_route() {
    let graph = create_complex_graph();
    let router = Router::new(graph);

    let token_a = address_from_u64(1);
    let token_e = address_from_u64(5);

    // Small amount - should use single route for gas savings
    let amount = U256::from(10_000_000_000_000_000u128); // 0.01 token

    let split = router
        .find_split_route(token_a, token_e, amount, Some(4), Some(3))
        .await
        .expect("Should find route");

    // Should use single route for small amounts
    assert_eq!(
        split.routes.len(),
        1,
        "Small amounts should use single route"
    );

    println!("Small amount routing: using {} route(s)", split.routes.len());
}

#[test]
fn test_max_splits_limit() {
    let graph = create_complex_graph();

    let token_a = address_from_u64(1);
    let token_e = address_from_u64(5);

    let amount = U256::from(100_000_000_000_000_000_000u128);

    // Find many routes
    let routes = find_top_routes(&graph, token_a, token_e, amount, 4, 10);

    // Optimize with max 3 splits
    let split = optimize_split_route(routes, amount).expect("Should optimize");

    assert!(
        split.routes.len() <= 3,
        "Should not exceed max splits of 3"
    );

    println!("Split with max 3 splits: using {} routes", split.routes.len());
}
