use crate::graph::{PoolEdge, PoolGraph};
use crate::routing::{Route, RouteHop};
use crate::utils::math::{compute_swap_step, tick_to_sqrt_price_x96};
use crate::utils::{Result, RouterError, MAX_HOPS};
use alloy_primitives::{Address, U256};
use std::collections::{BinaryHeap, HashMap, HashSet};
use std::cmp::Ordering;

#[derive(Clone)]
struct PathState {
    token: Address,
    amount_out: U256,
    path: Vec<PoolEdge>,
    visited_tokens: HashSet<Address>,
    gas_used: u64,
}

impl Eq for PathState {}

impl PartialEq for PathState {
    fn eq(&self, other: &Self) -> bool {
        self.amount_out == other.amount_out
    }
}

impl Ord for PathState {
    fn cmp(&self, other: &Self) -> Ordering {
        // Maximize output
        self.amount_out.cmp(&other.amount_out)
    }
}

impl PartialOrd for PathState {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// Find multiple routes for multi-hop routing
///
/// This returns the top N routes sorted by output amount.
/// Used for split routing and backup routes.
pub fn find_top_routes(
    graph: &PoolGraph,
    token_in: Address,
    token_out: Address,
    amount_in: U256,
    max_hops: usize,
    top_n: usize,
) -> Vec<Route> {
    let max_hops = max_hops.min(MAX_HOPS);

    if !graph.has_path(token_in, token_out) {
        return Vec::new();
    }

    let mut heap = BinaryHeap::new();
    let mut best_per_token: HashMap<Address, U256> = HashMap::new();
    let mut completed_routes: Vec<Route> = Vec::new();

    // Start state
    let mut initial_visited = HashSet::new();
    initial_visited.insert(token_in);

    heap.push(PathState {
        token: token_in,
        amount_out: amount_in,
        path: vec![],
        visited_tokens: initial_visited,
        gas_used: 0,
    });

    while let Some(state) = heap.pop() {
        // Found destination
        if state.token == token_out {
            if let Ok(route) = build_route(state.clone(), amount_in) {
                completed_routes.push(route);

                // Stop if we have enough routes
                if completed_routes.len() >= top_n {
                    break;
                }
            }
            continue;
        }

        // Prune: Skip if we've seen much better for this token
        if let Some(&best_amount) = best_per_token.get(&state.token) {
            // Allow some tolerance for different paths
            if state.amount_out < best_amount * U256::from(95) / U256::from(100) {
                continue;
            }
        }
        best_per_token.insert(state.token, state.amount_out);

        // Max hops reached
        if state.path.len() >= max_hops {
            continue;
        }

        // Explore neighbors
        for pool in graph.get_pools_for_token(state.token) {
            if let Some(next_token) = pool.other_token(state.token) {
                // Avoid cycles
                if state.visited_tokens.contains(&next_token) {
                    continue;
                }

                // Simulate swap
                let amount_out = simulate_swap(&pool, state.amount_out);

                // Skip if output is too small (dust)
                if amount_out < U256::from(100) {
                    continue;
                }

                let mut new_path = state.path.clone();
                new_path.push(pool.clone());

                let mut new_visited = state.visited_tokens.clone();
                new_visited.insert(next_token);

                heap.push(PathState {
                    token: next_token,
                    amount_out,
                    path: new_path,
                    visited_tokens: new_visited,
                    gas_used: state.gas_used + estimate_gas(&pool),
                });
            }
        }
    }

    // Sort by output (descending)
    completed_routes.sort_by(|a, b| b.total_amount_out.cmp(&a.total_amount_out));

    completed_routes
}

/// Find the best single route (used when split is not needed)
pub fn find_best_multi_hop_route(
    graph: &PoolGraph,
    token_in: Address,
    token_out: Address,
    amount_in: U256,
    max_hops: usize,
) -> Result<Route> {
    let routes = find_top_routes(graph, token_in, token_out, amount_in, max_hops, 1);

    routes
        .into_iter()
        .next()
        .ok_or(RouterError::NoRouteFound {
            from: token_in,
            to: token_out,
        })
}

/// Simulate a swap using CLMM math (single tick-range step).
///
/// Computes the output via `compute_swap_step` using the pool's
/// current sqrtPriceX96, liquidity, and fee.  We assume token0 -> token1
/// direction (zero_for_one = true) since we don't track direction in
/// the multi-hop search.  This is a reasonable heuristic for ranking
/// routes by expected output.
fn simulate_swap(pool: &PoolEdge, amount_in: U256) -> U256 {
    if amount_in.is_zero() || pool.liquidity == 0 {
        return U256::ZERO;
    }

    // Use zero_for_one = true as default direction for ranking
    let sqrt_price_target = tick_to_sqrt_price_x96(pool.tick - pool.tick_spacing);

    let step = compute_swap_step(
        pool.sqrt_price_x96,
        sqrt_price_target,
        pool.liquidity,
        amount_in,
        pool.fee,
    );

    step.amount_out
}

/// Estimate gas for a swap
fn estimate_gas(pool: &PoolEdge) -> u64 {
    let mut gas = 100_000u64;

    if pool.hook_address != Address::ZERO {
        gas += 50_000;
    }

    gas
}

/// Build a Route from path state
fn build_route(state: PathState, initial_amount: U256) -> Result<Route> {
    let mut hops = Vec::new();
    let mut current_amount = initial_amount;

    // Get first token from path
    let mut current_token = if let Some(first_pool) = state.path.first() {
        if state.visited_tokens.contains(&first_pool.token0) {
            first_pool.token0
        } else {
            first_pool.token1
        }
    } else {
        return Err(RouterError::InternalError("Empty path".to_string()));
    };

    for pool in &state.path {
        let token_in = current_token;
        let token_out = pool.other_token(token_in).ok_or_else(|| {
            RouterError::InternalError("Token not in pool".to_string())
        })?;

        let amount_out = simulate_swap(pool, current_amount);

        hops.push(RouteHop::new(
            pool.clone(),
            token_in,
            token_out,
            current_amount,
            amount_out,
        ));

        current_amount = amount_out;
        current_token = token_out;
    }

    let price_impact = calculate_price_impact(initial_amount, state.amount_out);

    Ok(Route::new(
        hops,
        initial_amount,
        state.amount_out,
        price_impact,
        state.gas_used,
    ))
}

/// Calculate price impact
fn calculate_price_impact(amount_in: U256, amount_out: U256) -> f64 {
    if amount_in.is_zero() || amount_out.is_zero() {
        return 0.0;
    }

    let in_f64 = amount_in.to::<u128>() as f64;
    let out_f64 = amount_out.to::<u128>() as f64;

    let actual_rate = in_f64 / out_f64;
    let impact = (actual_rate - 1.0).abs() * 100.0;

    impact.min(100.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::TokenNode;
    use crate::utils::address_from_u64;

    fn create_test_graph() -> PoolGraph {
        let graph = PoolGraph::new();

        // Create a chain: A -> B -> C -> D
        let token_a = address_from_u64(1);
        let token_b = address_from_u64(2);
        let token_c = address_from_u64(3);
        let token_d = address_from_u64(4);

        let node_a = TokenNode::new(token_a, "A".to_string(), 18);
        let node_b = TokenNode::new(token_b, "B".to_string(), 18);
        let node_c = TokenNode::new(token_c, "C".to_string(), 18);
        let node_d = TokenNode::new(token_d, "D".to_string(), 18);

        // Pool A-B
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

        // Pool B-C
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

        // Pool C-D
        let pool_cd = PoolEdge::new(
            [3u8; 32],
            token_c,
            token_d,
            3000,
            60,
            1_000_000_000_000_000_000_000,
            U256::from(1u128 << 96),
            0,
        );

        // Direct pool A-D (alternative route)
        let pool_ad = PoolEdge::new(
            [4u8; 32],
            token_a,
            token_d,
            10000, // Higher fee
            200,
            500_000_000_000_000_000_000, // Less liquidity
            U256::from(1u128 << 96),
            0,
        );

        graph.upsert_pool(pool_ab, node_a.clone(), node_b.clone());
        graph.upsert_pool(pool_bc, node_b, node_c.clone());
        graph.upsert_pool(pool_cd, node_c, node_d.clone());
        graph.upsert_pool(pool_ad, node_a, node_d);

        graph
    }

    #[test]
    fn test_multi_hop_routing() {
        let graph = create_test_graph();

        let token_a = address_from_u64(1);
        let token_d = address_from_u64(4);

        let amount_in = U256::from(1_000_000_000_000_000_000u128);

        let route =
            find_best_multi_hop_route(&graph, token_a, token_d, amount_in, 4)
                .expect("Should find route");

        // Should find a route
        assert!(route.hops.len() > 0);
        assert!(route.hops.len() <= 4);
        assert!(route.total_amount_out > U256::ZERO);

        println!("Route hops: {}", route.hops.len());
        println!("Output: {}", route.total_amount_out);
    }

    #[test]
    fn test_find_top_routes() {
        let graph = create_test_graph();

        let token_a = address_from_u64(1);
        let token_d = address_from_u64(4);

        let amount_in = U256::from(1_000_000_000_000_000_000u128);

        let routes = find_top_routes(&graph, token_a, token_d, amount_in, 4, 3);

        // Should find multiple routes
        assert!(routes.len() > 0);

        // Routes should be sorted by output (descending)
        for i in 0..routes.len() - 1 {
            assert!(routes[i].total_amount_out >= routes[i + 1].total_amount_out);
        }

        println!("Found {} routes", routes.len());
        for (i, route) in routes.iter().enumerate() {
            println!(
                "Route {}: {} hops, output: {}",
                i + 1,
                route.hops.len(),
                route.total_amount_out
            );
        }
    }

    #[test]
    fn test_no_cycles() {
        let graph = create_test_graph();

        let token_a = address_from_u64(1);
        let token_d = address_from_u64(4);

        let amount_in = U256::from(1_000_000_000_000_000_000u128);

        let routes = find_top_routes(&graph, token_a, token_d, amount_in, 4, 5);

        // Check that no route has duplicate tokens (cycles)
        for route in &routes {
            let mut visited = HashSet::new();
            visited.insert(route.hops[0].token_in);

            for hop in &route.hops {
                assert!(
                    !visited.contains(&hop.token_out),
                    "Route contains cycle"
                );
                visited.insert(hop.token_out);
            }
        }
    }

    #[test]
    fn test_max_hops_limit() {
        let graph = create_test_graph();

        let token_a = address_from_u64(1);
        let token_d = address_from_u64(4);

        let amount_in = U256::from(1_000_000_000_000_000_000u128);

        // Test with max_hops = 2
        let routes = find_top_routes(&graph, token_a, token_d, amount_in, 2, 5);

        for route in &routes {
            assert!(route.hops.len() <= 2, "Route exceeds max hops");
        }
    }
}
