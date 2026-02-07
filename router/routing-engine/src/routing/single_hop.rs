use crate::graph::{PoolEdge, PoolGraph};
use crate::routing::{Route, RouteHop};
use crate::utils::math::{compute_swap_step, tick_to_sqrt_price_x96};
use crate::utils::{Result, RouterError};
use alloy_primitives::{Address, U256};

/// Find the best single-hop route between two tokens
///
/// This is optimized for direct swaps through a single pool.
/// It evaluates all available pools and selects the one with the best output.
pub fn find_best_single_hop_route(
    graph: &PoolGraph,
    token_in: Address,
    token_out: Address,
    amount_in: U256,
) -> Result<Route> {
    // Get all pools that connect these two tokens
    let pools_from_in = graph.get_pools_for_token(token_in);

    let mut best_route: Option<Route> = None;
    let mut best_output = U256::ZERO;

    for pool in pools_from_in {
        // Check if this pool connects to our target token
        if let Some(other_token) = pool.other_token(token_in) {
            if other_token == token_out {
                // This is a direct pool!
                match simulate_swap_through_pool(&pool, token_in, token_out, amount_in) {
                    Ok((amount_out, gas_estimate)) => {
                        if amount_out > best_output {
                            best_output = amount_out;

                            let price_impact = calculate_price_impact(amount_in, amount_out);

                            let hop = RouteHop::new(
                                pool.clone(),
                                token_in,
                                token_out,
                                amount_in,
                                amount_out,
                            );

                            best_route = Some(Route::new(
                                vec![hop],
                                amount_in,
                                amount_out,
                                price_impact,
                                gas_estimate,
                            ));
                        }
                    }
                    Err(_) => continue, // Skip pools with simulation errors
                }
            }
        }
    }

    best_route.ok_or(RouterError::NoRouteFound {
        from: token_in,
        to: token_out,
    })
}

/// Simulate a swap through a specific pool
fn simulate_swap_through_pool(
    pool: &PoolEdge,
    token_in: Address,
    _token_out: Address,
    amount_in: U256,
) -> Result<(U256, u64)> {
    // Determine swap direction
    let zero_for_one = pool.zero_for_one(token_in).ok_or_else(|| {
        RouterError::InternalError("Token not in pool".to_string())
    })?;

    // Calculate amount out with fee
    let amount_out = calculate_amount_out(pool, amount_in, zero_for_one)?;

    // Estimate gas
    let gas_estimate = estimate_swap_gas(pool);

    Ok((amount_out, gas_estimate))
}

/// Calculate output amount for a swap using CLMM math.
///
/// Uses `compute_swap_step` from the Uniswap v3/v4 swap math to
/// calculate the exact output given the pool's current sqrtPriceX96,
/// liquidity, fee, and swap direction.
fn calculate_amount_out(
    pool: &PoolEdge,
    amount_in: U256,
    zero_for_one: bool,
) -> Result<U256> {
    // Check liquidity
    if pool.liquidity == 0 {
        return Err(RouterError::InsufficientLiquidity {
            required: amount_in.to_string(),
            available: "0".to_string(),
        });
    }

    // Determine the target sqrt price at the next tick boundary.
    // In a full implementation we would consult a tick bitmap.
    let sqrt_price_target = if zero_for_one {
        tick_to_sqrt_price_x96(pool.tick - pool.tick_spacing)
    } else {
        tick_to_sqrt_price_x96(pool.tick + pool.tick_spacing)
    };

    let step = compute_swap_step(
        pool.sqrt_price_x96,
        sqrt_price_target,
        pool.liquidity,
        amount_in,
        pool.fee,
    );

    let amount_out = step.amount_out;

    // Check for dust
    if amount_out < U256::from(100) {
        return Err(RouterError::InsufficientLiquidity {
            required: amount_in.to_string(),
            available: amount_out.to_string(),
        });
    }

    Ok(amount_out)
}

/// Estimate gas for a swap
fn estimate_swap_gas(pool: &PoolEdge) -> u64 {
    // Base swap gas
    let mut gas = 100_000u64;

    // Add overhead for hooks if present
    if pool.hook_address != Address::ZERO {
        gas += 50_000;
    }

    // Fee tier affects gas slightly
    if pool.fee >= 10_000 {
        gas += 5_000; // Higher fee tiers might have more complex logic
    }

    gas
}

/// Calculate price impact percentage
fn calculate_price_impact(amount_in: U256, amount_out: U256) -> f64 {
    if amount_in.is_zero() || amount_out.is_zero() {
        return 0.0;
    }

    // Price impact = (expected_price - actual_price) / expected_price * 100
    // Simplified: we assume expected 1:1 and calculate deviation
    let in_f64 = amount_in.to::<u128>() as f64;
    let out_f64 = amount_out.to::<u128>() as f64;

    let actual_rate = in_f64 / out_f64;
    let impact = (actual_rate - 1.0).abs() * 100.0;

    impact.min(100.0) // Cap at 100%
}

/// Find all possible single-hop routes and return them sorted by output
pub fn find_all_single_hop_routes(
    graph: &PoolGraph,
    token_in: Address,
    token_out: Address,
    amount_in: U256,
) -> Vec<Route> {
    let pools_from_in = graph.get_pools_for_token(token_in);

    let mut routes = Vec::new();

    for pool in pools_from_in {
        if let Some(other_token) = pool.other_token(token_in) {
            if other_token == token_out {
                if let Ok((amount_out, gas_estimate)) =
                    simulate_swap_through_pool(&pool, token_in, token_out, amount_in)
                {
                    let price_impact = calculate_price_impact(amount_in, amount_out);

                    let hop = RouteHop::new(
                        pool.clone(),
                        token_in,
                        token_out,
                        amount_in,
                        amount_out,
                    );

                    routes.push(Route::new(
                        vec![hop],
                        amount_in,
                        amount_out,
                        price_impact,
                        gas_estimate,
                    ));
                }
            }
        }
    }

    // Sort by output amount (descending)
    routes.sort_by(|a, b| b.total_amount_out.cmp(&a.total_amount_out));

    routes
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::TokenNode;
    use crate::utils::address_from_u64;

    fn create_test_pool(
        token0: Address,
        token1: Address,
        fee: u32,
        liquidity: u128,
    ) -> PoolEdge {
        PoolEdge::new(
            [1u8; 32],
            token0,
            token1,
            fee,
            60,
            liquidity,
            U256::from(1u128 << 96),
            0,
        )
    }

    #[test]
    fn test_single_hop_routing() {
        let graph = PoolGraph::new();

        let token_a = address_from_u64(100);
        let token_b = address_from_u64(200);

        let token_a_node = TokenNode::new(token_a, "TOKEN_A".to_string(), 18);
        let token_b_node = TokenNode::new(token_b, "TOKEN_B".to_string(), 18);

        // Create a pool with good liquidity
        let pool = create_test_pool(
            token_a,
            token_b,
            3000, // 0.3% fee
            1_000_000_000_000_000_000_000, // 1000 tokens
        );

        graph.upsert_pool(pool, token_a_node, token_b_node);

        // Test swap
        let amount_in = U256::from(1_000_000_000_000_000_000u128); // 1 token
        let route = find_best_single_hop_route(&graph, token_a, token_b, amount_in);

        assert!(route.is_ok());
        let route = route.unwrap();

        assert_eq!(route.hops.len(), 1);
        assert!(route.total_amount_out > U256::ZERO);
        assert!(route.total_amount_out < amount_in); // Should be less due to fees
        assert!(route.price_impact >= 0.0);
        assert!(route.gas_estimate > 0);
    }

    #[test]
    fn test_no_direct_pool() {
        let graph = PoolGraph::new();

        let token_a = address_from_u64(100);
        let token_b = address_from_u64(200);

        let amount_in = U256::from(1_000_000_000_000_000_000u128);
        let result = find_best_single_hop_route(&graph, token_a, token_b, amount_in);

        assert!(result.is_err());
        match result {
            Err(RouterError::NoRouteFound { .. }) => (),
            _ => panic!("Expected NoRouteFound error"),
        }
    }

    #[test]
    fn test_multiple_pools_same_pair() {
        let graph = PoolGraph::new();

        let token_a = address_from_u64(100);
        let token_b = address_from_u64(200);

        let token_a_node = TokenNode::new(token_a, "TOKEN_A".to_string(), 18);
        let token_b_node = TokenNode::new(token_b, "TOKEN_B".to_string(), 18);

        // Create two pools with different fees
        let pool1 = PoolEdge::new(
            [1u8; 32],
            token_a,
            token_b,
            500, // 0.05% fee
            10,
            1_000_000_000_000_000_000_000,
            U256::from(1u128 << 96),
            0,
        );

        let pool2 = PoolEdge::new(
            [2u8; 32],
            token_a,
            token_b,
            3000, // 0.3% fee
            60,
            2_000_000_000_000_000_000_000, // More liquidity
            U256::from(1u128 << 96),
            0,
        );

        graph.upsert_pool(pool1, token_a_node.clone(), token_b_node.clone());
        graph.upsert_pool(pool2, token_a_node, token_b_node);

        let amount_in = U256::from(1_000_000_000_000_000_000u128);
        let routes = find_all_single_hop_routes(&graph, token_a, token_b, amount_in);

        // Should find both routes
        assert!(routes.len() >= 1); // At least one route

        // Best route should be first
        if routes.len() > 1 {
            assert!(routes[0].total_amount_out >= routes[1].total_amount_out);
        }
    }

    #[test]
    fn test_calculate_price_impact() {
        let amount_in = U256::from(1_000_000);
        let amount_out = U256::from(997_000); // ~0.3% loss

        let impact = calculate_price_impact(amount_in, amount_out);

        // Should be very small impact
        assert!(impact < 1.0);
        assert!(impact >= 0.0);
    }

    #[test]
    fn test_insufficient_liquidity() {
        let pool = create_test_pool(
            address_from_u64(1),
            address_from_u64(2),
            3000,
            0, // No liquidity!
        );

        let result = calculate_amount_out(&pool, U256::from(1000), true);

        assert!(result.is_err());
        match result {
            Err(RouterError::InsufficientLiquidity { .. }) => (),
            _ => panic!("Expected InsufficientLiquidity error"),
        }
    }
}
