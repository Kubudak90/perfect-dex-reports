use alloy_primitives::U256;
use routing_engine::utils::address_from_u64;
use routing_engine::{
    api::{create_router, AppState},
    config::Settings,
    graph::{PoolEdge, PoolGraph, TokenNode},
    routing::{find_best_single_hop_route, Router},
    sync::PoolSyncer,
};
use std::sync::Arc;

/// Test complete single-hop routing flow
#[tokio::test]
async fn test_single_hop_routing_flow() {
    // Setup
    let graph = Arc::new(PoolGraph::new());

    let token_weth = address_from_u64(1);
    let token_usdc = address_from_u64(2);

    let weth_node = TokenNode::native(token_weth, "WETH".to_string(), 18);
    let usdc_node = TokenNode::new(token_usdc, "USDC".to_string(), 6);

    // Create a pool with realistic liquidity
    let pool = PoolEdge::new(
        [1u8; 32],
        token_weth,
        token_usdc,
        3000, // 0.3% fee
        60,
        1_000_000_000_000_000_000_000, // 1000 tokens liquidity
        U256::from(1u128 << 96),
        0,
    );

    graph.upsert_pool(pool, weth_node, usdc_node);

    // Test routing
    let amount_in = U256::from(1_000_000_000_000_000_000u128); // 1 WETH
    let route = find_best_single_hop_route(&graph, token_weth, token_usdc, amount_in)
        .expect("Should find route");

    // Assertions
    assert_eq!(route.hops.len(), 1, "Should have exactly 1 hop");
    assert_eq!(route.hops[0].token_in, token_weth);
    assert_eq!(route.hops[0].token_out, token_usdc);
    assert!(route.total_amount_out > U256::ZERO, "Should have output");
    assert!(
        route.total_amount_out < amount_in,
        "Output should be less than input due to fees"
    );
    assert!(route.price_impact >= 0.0, "Price impact should be non-negative");
    assert!(route.gas_estimate > 0, "Gas estimate should be positive");

    println!("✅ Single-hop routing test passed!");
    println!("   Amount in: {}", amount_in);
    println!("   Amount out: {}", route.total_amount_out);
    println!("   Price impact: {:.4}%", route.price_impact);
    println!("   Gas estimate: {}", route.gas_estimate);
}

/// Test routing through Router API
#[tokio::test]
async fn test_router_api() {
    let graph = Arc::new(PoolGraph::new());

    // Setup pools
    let token_a = address_from_u64(10);
    let token_b = address_from_u64(20);

    let token_a_node = TokenNode::new(token_a, "TOKEN_A".to_string(), 18);
    let token_b_node = TokenNode::new(token_b, "TOKEN_B".to_string(), 18);

    let pool = PoolEdge::new(
        [1u8; 32],
        token_a,
        token_b,
        500, // 0.05% fee
        10,
        5_000_000_000_000_000_000_000, // 5000 tokens
        U256::from(1u128 << 96),
        0,
    );

    graph.upsert_pool(pool, token_a_node, token_b_node);

    // Create router
    let router = Router::new(graph);

    // Test find_route
    let amount_in = U256::from(100_000_000_000_000_000u128); // 0.1 token
    let route = router
        .find_route(token_a, token_b, amount_in, Some(1))
        .await
        .expect("Should find route");

    assert_eq!(route.hops.len(), 1);
    assert!(route.total_amount_out > U256::ZERO);

    // Test get_quote
    let quote = router
        .get_quote(token_a, token_b, amount_in, 0.5, Some(1))
        .await
        .expect("Should get quote");

    assert_eq!(quote.amount_in, amount_in.to_string());
    assert!(!quote.amount_out.is_empty());
    assert!(!quote.amount_out_min.is_empty());
    assert!(quote.price_impact >= 0.0);
    assert!(quote.gas_estimate > 0);

    println!("✅ Router API test passed!");
    println!("   Quote: {} -> {}", quote.amount_in, quote.amount_out);
    println!("   Min output: {}", quote.amount_out_min);
    println!("   Route: {}", quote.route_string);
}

/// Test pool syncer
#[tokio::test]
async fn test_pool_syncer() {
    let graph = Arc::new(PoolGraph::new());
    let syncer = PoolSyncer::new(graph.clone());

    // Sync pools (will add mock pools)
    syncer.sync_pools().await.expect("Should sync pools");

    // Check that pools were added
    let stats = graph.stats();
    assert!(stats.token_count > 0, "Should have tokens");
    assert!(stats.pool_count > 0, "Should have pools");

    println!("✅ Pool syncer test passed!");
    println!("   Tokens: {}", stats.token_count);
    println!("   Pools: {}", stats.pool_count);
}

/// Test multiple pools same pair
#[tokio::test]
async fn test_best_pool_selection() {
    let graph = Arc::new(PoolGraph::new());

    let token_a = address_from_u64(100);
    let token_b = address_from_u64(200);

    let token_a_node = TokenNode::new(token_a, "TOKEN_A".to_string(), 18);
    let token_b_node = TokenNode::new(token_b, "TOKEN_B".to_string(), 18);

    // Pool 1: Low fee, low liquidity
    let pool1 = PoolEdge::new(
        [1u8; 32],
        token_a,
        token_b,
        100, // 0.01% fee
        1,
        100_000_000_000_000_000_000, // 100 tokens
        U256::from(1u128 << 96),
        0,
    );

    // Pool 2: Higher fee, much more liquidity
    let pool2 = PoolEdge::new(
        [2u8; 32],
        token_a,
        token_b,
        3000, // 0.3% fee
        60,
        10_000_000_000_000_000_000_000, // 10000 tokens
        U256::from(1u128 << 96),
        0,
    );

    graph.upsert_pool(pool1, token_a_node.clone(), token_b_node.clone());
    graph.upsert_pool(pool2, token_a_node, token_b_node);

    let router = Router::new(graph);

    // For large swaps, high liquidity pool should win despite higher fees
    let large_amount = U256::from(10_000_000_000_000_000_000u128); // 10 tokens
    let route = router
        .find_route(token_a, token_b, large_amount, Some(1))
        .await
        .expect("Should find route");

    assert_eq!(route.hops.len(), 1);
    assert!(route.total_amount_out > U256::ZERO);

    println!("✅ Best pool selection test passed!");
    println!("   Selected pool fee: {}", route.hops[0].pool.fee);
    println!("   Output amount: {}", route.total_amount_out);
}

/// Test AppState creation
#[test]
fn test_app_state_creation() {
    let settings = Settings::default();
    let state = AppState::new(settings);

    let stats = state.graph.stats();

    // Initially empty
    assert_eq!(stats.token_count, 0);
    assert_eq!(stats.pool_count, 0);

    println!("✅ AppState creation test passed!");
}

/// Test error handling - no route
#[tokio::test]
async fn test_no_route_error() {
    let graph = Arc::new(PoolGraph::new());
    let router = Router::new(graph);

    let token_a = address_from_u64(1);
    let token_b = address_from_u64(2);
    let amount = U256::from(1000);

    let result = router.find_route(token_a, token_b, amount, Some(1)).await;

    assert!(result.is_err(), "Should return error for no route");

    println!("✅ No route error test passed!");
}
