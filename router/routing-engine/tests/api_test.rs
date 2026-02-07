use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use alloy_primitives::U256;
use routing_engine::utils::address_from_u64;
use routing_engine::{
    api::{create_router, AppState},
    cache::RouteCache,
    config::Settings,
    graph::{PoolEdge, PoolGraph, TokenNode},
    routing::Router,
};
use serde_json::Value;
use std::sync::Arc;
use tower::util::ServiceExt;

fn create_test_state() -> AppState {
    // Create test graph with pools
    let graph = Arc::new(PoolGraph::new());

    let token_a = address_from_u64(1);
    let token_b = address_from_u64(2);
    let token_c = address_from_u64(3);

    let node_a = TokenNode::new(token_a, "TokenA".to_string(), 18);
    let node_b = TokenNode::new(token_b, "TokenB".to_string(), 18);
    let node_c = TokenNode::new(token_c, "TokenC".to_string(), 18);

    let pool_ab = PoolEdge::new(
        [1u8; 32],
        token_a,
        token_b,
        3000,
        60,
        1_000_000_000_000_000_000_000,
        U256::from(1u128 << 96),
        0,
    );

    let pool_bc = PoolEdge::new(
        [2u8; 32],
        token_b,
        token_c,
        3000,
        60,
        1_000_000_000_000_000_000_000,
        U256::from(1u128 << 96),
        0,
    );

    graph.upsert_pool(pool_ab, node_a.clone(), node_b.clone());
    graph.upsert_pool(pool_bc, node_b, node_c);

    // Create router with test graph (use same graph reference)
    let router = Router::new(graph.clone());

    let settings = Settings::default();

    AppState {
        router: Arc::new(router),
        graph,
        cache: Arc::new(RouteCache::default()),
        settings,
    }
}

#[tokio::test]
async fn test_health_check_returns_ok() {
    let state = create_test_state();
    let app = create_router(state);

    let response = app
        .oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["status"], "healthy");
    assert!(json["version"].is_string());
    assert_eq!(json["chain_id"], 8453);
}

#[tokio::test]
async fn test_health_check_shows_graph_stats() {
    let state = create_test_state();
    let app = create_router(state);

    let response = app
        .oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap())
        .await
        .unwrap();

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert!(json["graph_stats"]["token_count"].is_number());
    assert!(json["graph_stats"]["pool_count"].is_number());
    assert!(json["graph_stats"]["last_update"].is_number());

    // We added 3 tokens and 2 pools
    assert_eq!(json["graph_stats"]["token_count"], 3);
    assert_eq!(json["graph_stats"]["pool_count"], 2);
}

#[tokio::test]
async fn test_quote_endpoint_single_hop() {
    let state = create_test_state();
    let app = create_router(state);

    let token_a = address_from_u64(1);
    let token_b = address_from_u64(2);
    let amount = "1000000000000000000"; // 1 token

    let uri = format!(
        "/v1/quote?token_in={:?}&token_out={:?}&amount_in={}",
        token_a, token_b, amount
    );

    let response = app
        .oneshot(Request::builder().uri(&uri).body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    // Check response structure
    assert!(json["quote"].is_object());
    assert!(json["timestamp"].is_number());
    assert!(json["cached"].is_boolean());
}

#[tokio::test]
async fn test_quote_endpoint_multi_hop() {
    let state = create_test_state();
    let app = create_router(state);

    let token_a = address_from_u64(1);
    let token_c = address_from_u64(3);
    let amount = "1000000000000000000";

    let uri = format!(
        "/v1/quote?token_in={:?}&token_out={:?}&amount_in={}&max_hops=3",
        token_a, token_c, amount
    );

    let response = app
        .oneshot(Request::builder().uri(&uri).body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert!(json["quote"].is_object());
    // Multi-hop route should have routes array
    assert!(json["quote"]["route"]["routes"].as_array().is_some());
    let routes = json["quote"]["route"]["routes"].as_array().unwrap();
    assert!(!routes.is_empty(), "Should have at least one route");
}

#[tokio::test]
async fn test_quote_with_invalid_amount_returns_400() {
    let state = create_test_state();
    let app = create_router(state);

    let token_a = address_from_u64(1);
    let token_b = address_from_u64(2);

    let uri = format!(
        "/v1/quote?token_in={:?}&token_out={:?}&amount_in=invalid",
        token_a, token_b
    );

    let response = app
        .oneshot(Request::builder().uri(&uri).body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert!(json["error"].is_string());
    assert!(json["message"].is_string());
}

#[tokio::test]
async fn test_quote_with_nonexistent_token_returns_404() {
    let state = create_test_state();
    let app = create_router(state);

    let token_unknown = address_from_u64(999);
    let token_b = address_from_u64(2);
    let amount = "1000000000000000000";

    let uri = format!(
        "/v1/quote?token_in={:?}&token_out={:?}&amount_in={}",
        token_unknown, token_b, amount
    );

    let response = app
        .oneshot(Request::builder().uri(&uri).body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_quote_with_custom_slippage() {
    let state = create_test_state();
    let app = create_router(state);

    let token_a = address_from_u64(1);
    let token_b = address_from_u64(2);
    let amount = "1000000000000000000";

    let uri = format!(
        "/v1/quote?token_in={:?}&token_out={:?}&amount_in={}&slippage=1.0",
        token_a, token_b, amount
    );

    let response = app
        .oneshot(Request::builder().uri(&uri).body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert!(json["quote"].is_object());
    // Verify response is valid (slippage might not be in JSON response,
    // but should be successfully processed on the backend)
    assert!(json["quote"]["amount_out"].is_string());
    assert!(json["quote"]["amount_out_min"].is_string());
}

#[tokio::test]
async fn test_quote_response_includes_timestamp() {
    let state = create_test_state();
    let app = create_router(state);

    let token_a = address_from_u64(1);
    let token_b = address_from_u64(2);
    let amount = "1000000000000000000";

    let uri = format!(
        "/v1/quote?token_in={:?}&token_out={:?}&amount_in={}",
        token_a, token_b, amount
    );

    let response = app
        .oneshot(Request::builder().uri(&uri).body(Body::empty()).unwrap())
        .await
        .unwrap();

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    let timestamp = json["timestamp"].as_u64().unwrap();
    assert!(timestamp > 0);

    // Timestamp should be recent (within last minute)
    let now = chrono::Utc::now().timestamp() as u64;
    assert!(now - timestamp < 60);
}
