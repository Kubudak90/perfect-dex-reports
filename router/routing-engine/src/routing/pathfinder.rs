use crate::graph::{PoolEdge, PoolGraph};
use crate::routing::{Route, RouteHop};
use crate::utils::math::{compute_swap_step, tick_to_sqrt_price_x96};
use crate::utils::{Result, RouterError, MAX_HOPS};
use alloy_primitives::{Address, U256};
use std::collections::{BinaryHeap, HashMap};
use std::cmp::Ordering;

#[derive(Clone)]
struct PathState {
    token: Address,
    amount_out: U256,
    path: Vec<PoolEdge>,
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
        // Maximize output (reverse ordering for max-heap behavior)
        self.amount_out.cmp(&other.amount_out)
    }
}

impl PartialOrd for PathState {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// Find the best route between two tokens
pub fn find_best_route(
    graph: &PoolGraph,
    token_in: Address,
    token_out: Address,
    amount_in: U256,
    max_hops: usize,
) -> Result<Route> {
    let max_hops = max_hops.min(MAX_HOPS);

    if !graph.has_path(token_in, token_out) {
        return Err(RouterError::NoRouteFound {
            from: token_in,
            to: token_out,
        });
    }

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
            return build_route(state, amount_in);
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
            if let Some(next_token) = pool.other_token(state.token) {
                // Simple simulation (real implementation would be more complex)
                let amount_out = simulate_simple_swap(&pool, state.amount_out);

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

    Err(RouterError::NoRouteFound {
        from: token_in,
        to: token_out,
    })
}

/// Swap simulation using CLMM math.
///
/// Uses `compute_swap_step` with the pool's current state to estimate
/// the output for a given input amount.
fn simulate_simple_swap(pool: &PoolEdge, amount_in: U256) -> U256 {
    if amount_in.is_zero() || pool.liquidity == 0 {
        return U256::ZERO;
    }

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

/// Estimate gas for a swap through a pool
fn estimate_gas(_pool: &PoolEdge) -> u64 {
    // Base gas + hook overhead if present
    100_000
}

/// Build a Route from the final path state
fn build_route(state: PathState, initial_amount: U256) -> Result<Route> {
    let mut hops = Vec::new();
    let mut current_amount = initial_amount;
    let mut current_token = state.path.first().map(|p| p.token0).unwrap_or_default();

    for pool in &state.path {
        let token_in = current_token;
        let token_out = pool.other_token(token_in).unwrap();
        let amount_out = simulate_simple_swap(pool, current_amount);

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

    // Simplified calculation
    let impact = (amount_in.to::<u128>() as f64 / amount_out.to::<u128>() as f64 - 1.0) * 100.0;
    impact.abs()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::address_from_u64;

    #[test]
    fn test_simple_swap_simulation() {
        let pool = PoolEdge::new(
            [0u8; 32],
            address_from_u64(1),
            address_from_u64(2),
            3000, // 0.3% fee
            60,
            1_000_000,
            U256::from(1u128 << 96),
            0,
        );

        let amount_in = U256::from(1_000_000);
        let amount_out = simulate_simple_swap(&pool, amount_in);

        // Should have 0.3% fee deducted
        assert!(amount_out < amount_in);
    }
}
