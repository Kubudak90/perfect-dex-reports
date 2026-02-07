use crate::graph::PoolGraph;
use crate::routing::multi_hop::find_top_routes;
use crate::routing::single_hop::find_all_single_hop_routes;
use crate::routing::Route;
use crate::utils::MAX_HOPS;
use alloy_primitives::{Address, U256};
use rayon::prelude::*;
use std::sync::Arc;

/// Find routes in parallel across different strategies
///
/// This evaluates multiple routing strategies concurrently:
/// - Single-hop direct routes
/// - 2-hop routes
/// - 3-hop routes
/// - 4-hop routes
///
/// Returns all routes sorted by output amount
pub fn find_routes_parallel(
    graph: Arc<PoolGraph>,
    token_in: Address,
    token_out: Address,
    amount_in: U256,
    max_hops: usize,
) -> Vec<Route> {
    let max_hops = max_hops.min(MAX_HOPS);

    // Create parallel tasks for different hop counts
    let hop_counts: Vec<usize> = (1..=max_hops).collect();

    // Execute all strategies in parallel
    let all_routes: Vec<Vec<Route>> = hop_counts
        .par_iter()
        .map(|&hops| {
            if hops == 1 {
                // Use optimized single-hop
                find_all_single_hop_routes(&graph, token_in, token_out, amount_in)
            } else {
                // Use multi-hop
                find_top_routes(&graph, token_in, token_out, amount_in, hops, 5)
            }
        })
        .collect();

    // Flatten and sort all routes
    let mut routes: Vec<Route> = all_routes.into_iter().flatten().collect();

    // Sort by output (descending)
    routes.par_sort_by(|a, b| b.total_amount_out.cmp(&a.total_amount_out));

    routes
}

/// Find best route using parallel evaluation
pub fn find_best_route_parallel(
    graph: Arc<PoolGraph>,
    token_in: Address,
    token_out: Address,
    amount_in: U256,
    max_hops: usize,
) -> Option<Route> {
    find_routes_parallel(graph, token_in, token_out, amount_in, max_hops)
        .into_iter()
        .next()
}

/// Evaluate multiple token pairs in parallel
///
/// Useful for batch quote requests
pub fn batch_find_routes(
    graph: Arc<PoolGraph>,
    requests: Vec<(Address, Address, U256, usize)>,
) -> Vec<Option<Route>> {
    requests
        .par_iter()
        .map(|(token_in, token_out, amount, max_hops)| {
            find_best_route_parallel(
                graph.clone(),
                *token_in,
                *token_out,
                *amount,
                *max_hops,
            )
        })
        .collect()
}

/// Parallel route simulation for different amounts
///
/// Useful for finding optimal trade size
pub fn simulate_amounts_parallel(
    graph: Arc<PoolGraph>,
    token_in: Address,
    token_out: Address,
    amounts: Vec<U256>,
    max_hops: usize,
) -> Vec<Option<Route>> {
    amounts
        .par_iter()
        .map(|amount| {
            find_best_route_parallel(graph.clone(), token_in, token_out, *amount, max_hops)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::{PoolEdge, TokenNode};
    use crate::utils::address_from_u64;

    fn create_test_graph() -> Arc<PoolGraph> {
        let graph = Arc::new(PoolGraph::new());

        let tokens: Vec<Address> = (1..=4).map(|i| address_from_u64(i)).collect();

        let nodes: Vec<TokenNode> = tokens
            .iter()
            .enumerate()
            .map(|(i, addr)| {
                TokenNode::new(*addr, format!("TOKEN{}", (b'A' + i as u8) as char), 18)
            })
            .collect();

        // Create multiple paths
        let pool_ab = PoolEdge::new(
            [1u8; 32],
            tokens[0],
            tokens[1],
            3000,
            60,
            2_000_000_000_000_000_000_000,
            U256::from(1u128 << 96),
            0,
        );

        let pool_bc = PoolEdge::new(
            [2u8; 32],
            tokens[1],
            tokens[2],
            3000,
            60,
            2_000_000_000_000_000_000_000,
            U256::from(1u128 << 96),
            0,
        );

        let pool_cd = PoolEdge::new(
            [3u8; 32],
            tokens[2],
            tokens[3],
            3000,
            60,
            2_000_000_000_000_000_000_000,
            U256::from(1u128 << 96),
            0,
        );

        let pool_ad = PoolEdge::new(
            [4u8; 32],
            tokens[0],
            tokens[3],
            10000,
            200,
            1_000_000_000_000_000_000_000,
            U256::from(1u128 << 96),
            0,
        );

        graph.upsert_pool(pool_ab, nodes[0].clone(), nodes[1].clone());
        graph.upsert_pool(pool_bc, nodes[1].clone(), nodes[2].clone());
        graph.upsert_pool(pool_cd, nodes[2].clone(), nodes[3].clone());
        graph.upsert_pool(pool_ad, nodes[0].clone(), nodes[3].clone());

        graph
    }

    #[test]
    fn test_parallel_route_finding() {
        let graph = create_test_graph();

        let token_a = address_from_u64(1);
        let token_d = address_from_u64(4);
        let amount = U256::from(1_000_000_000_000_000_000u128);

        let routes = find_routes_parallel(graph, token_a, token_d, amount, 4);

        assert!(!routes.is_empty(), "Should find routes");

        // Routes should be sorted by output
        for i in 0..routes.len() - 1 {
            assert!(routes[i].total_amount_out >= routes[i + 1].total_amount_out);
        }

        println!("Found {} routes in parallel", routes.len());
    }

    #[test]
    fn test_best_route_parallel() {
        let graph = create_test_graph();

        let token_a = address_from_u64(1);
        let token_d = address_from_u64(4);
        let amount = U256::from(1_000_000_000_000_000_000u128);

        let route = find_best_route_parallel(graph, token_a, token_d, amount, 4);

        assert!(route.is_some());
        let route = route.unwrap();
        assert!(route.total_amount_out > U256::ZERO);
    }

    #[test]
    fn test_batch_find_routes() {
        let graph = create_test_graph();

        let requests = vec![
            (
                address_from_u64(1),
                address_from_u64(2),
                U256::from(1_000_000_000_000_000_000u128),
                2,
            ),
            (
                address_from_u64(1),
                address_from_u64(3),
                U256::from(1_000_000_000_000_000_000u128),
                3,
            ),
            (
                address_from_u64(1),
                address_from_u64(4),
                U256::from(1_000_000_000_000_000_000u128),
                4,
            ),
        ];

        let results = batch_find_routes(graph, requests);

        assert_eq!(results.len(), 3);
        assert!(results[0].is_some());
        assert!(results[1].is_some());
        assert!(results[2].is_some());

        println!("Batch processing completed: {} routes found", results.len());
    }

    #[test]
    fn test_simulate_amounts_parallel() {
        let graph = create_test_graph();

        let token_a = address_from_u64(1);
        let token_d = address_from_u64(4);

        let amounts = vec![
            U256::from(1_000_000_000_000_000_000u128),   // 1 token
            U256::from(10_000_000_000_000_000_000u128),  // 10 tokens
            U256::from(100_000_000_000_000_000_000u128), // 100 tokens
        ];

        let results = simulate_amounts_parallel(graph, token_a, token_d, amounts, 4);

        assert_eq!(results.len(), 3);
        assert!(results.iter().all(|r| r.is_some()));

        println!("Amount simulations completed");
    }
}
