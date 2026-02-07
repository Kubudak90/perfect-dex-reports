use crate::routing::{Route, SplitRoute};
use crate::utils::{Result, RouterError, MAX_SPLITS};
use alloy_primitives::U256;

/// Find optimal split across multiple routes
///
/// This algorithm tries different split ratios to maximize total output.
/// It evaluates splits in increments and selects the combination with best output.
pub fn optimize_split_route(routes: Vec<Route>, total_amount: U256) -> Result<SplitRoute> {
    if routes.is_empty() {
        return Err(RouterError::InternalError(
            "No routes provided for split optimization".to_string(),
        ));
    }

    // If only one route, return as single route
    if routes.len() == 1 {
        return Ok(SplitRoute::single(routes.into_iter().next().unwrap()));
    }

    // Limit to MAX_SPLITS
    let routes: Vec<_> = routes.into_iter().take(MAX_SPLITS).collect();

    match routes.len() {
        1 => Ok(SplitRoute::single(routes.into_iter().next().unwrap())),
        2 => optimize_two_route_split(&routes[0], &routes[1], total_amount),
        3 => optimize_three_route_split(&routes[0], &routes[1], &routes[2], total_amount),
        _ => optimize_three_route_split(&routes[0], &routes[1], &routes[2], total_amount),
    }
}

/// Optimize split between two routes
fn optimize_two_route_split(
    route_a: &Route,
    route_b: &Route,
    total_amount: U256,
) -> Result<SplitRoute> {
    let mut best_output = U256::ZERO;
    let mut best_split = (100u8, 0u8);
    let mut best_amounts = (U256::ZERO, U256::ZERO);

    // Try splits in 5% increments
    for split_a in (0..=100).step_by(5) {
        let split_b = 100 - split_a;

        // Skip if split is too small (less than 5%)
        if split_a < 5 && split_a > 0 {
            continue;
        }
        if split_b < 5 && split_b > 0 {
            continue;
        }

        let amount_a = if split_a == 0 {
            U256::ZERO
        } else {
            total_amount * U256::from(split_a) / U256::from(100)
        };
        let amount_b = total_amount - amount_a;

        // Simulate outputs
        let output_a = if split_a > 0 {
            simulate_route_output(route_a, amount_a)
        } else {
            U256::ZERO
        };

        let output_b = if split_b > 0 {
            simulate_route_output(route_b, amount_b)
        } else {
            U256::ZERO
        };

        let total_output = output_a + output_b;

        if total_output > best_output {
            best_output = total_output;
            best_split = (split_a, split_b);
            best_amounts = (amount_a, amount_b);
        }
    }

    // Build split route
    let mut split_routes = Vec::new();

    if best_split.0 > 0 {
        let route_a_copy = scale_route(route_a, best_amounts.0);
        split_routes.push((route_a_copy, best_split.0));
    }

    if best_split.1 > 0 {
        let route_b_copy = scale_route(route_b, best_amounts.1);
        split_routes.push((route_b_copy, best_split.1));
    }

    let combined_gas = split_routes.iter().map(|(r, _)| r.gas_estimate).sum();
    let combined_impact = calculate_combined_price_impact(&split_routes);

    Ok(SplitRoute::new(
        split_routes,
        total_amount,
        best_output,
        combined_impact,
        combined_gas,
    ))
}

/// Optimize split between three routes
fn optimize_three_route_split(
    route_a: &Route,
    route_b: &Route,
    route_c: &Route,
    total_amount: U256,
) -> Result<SplitRoute> {
    let mut best_output = U256::ZERO;
    let mut best_split = (0u8, 0u8, 0u8);
    let mut best_amounts = (U256::ZERO, U256::ZERO, U256::ZERO);

    // Try splits in 10% increments for 3-way split
    for split_a in (0..=100).step_by(10) {
        for split_b in (0..=100 - split_a).step_by(10) {
            let split_c = 100 - split_a - split_b;

            // Skip if any split is too small
            if split_a > 0 && split_a < 10 {
                continue;
            }
            if split_b > 0 && split_b < 10 {
                continue;
            }
            if split_c > 0 && split_c < 10 {
                continue;
            }

            let amount_a = if split_a == 0 {
                U256::ZERO
            } else {
                total_amount * U256::from(split_a) / U256::from(100)
            };

            let amount_b = if split_b == 0 {
                U256::ZERO
            } else {
                total_amount * U256::from(split_b) / U256::from(100)
            };

            let amount_c = total_amount - amount_a - amount_b;

            // Simulate outputs
            let output_a = if split_a > 0 {
                simulate_route_output(route_a, amount_a)
            } else {
                U256::ZERO
            };

            let output_b = if split_b > 0 {
                simulate_route_output(route_b, amount_b)
            } else {
                U256::ZERO
            };

            let output_c = if split_c > 0 {
                simulate_route_output(route_c, amount_c)
            } else {
                U256::ZERO
            };

            let total_output = output_a + output_b + output_c;

            if total_output > best_output {
                best_output = total_output;
                best_split = (split_a, split_b, split_c);
                best_amounts = (amount_a, amount_b, amount_c);
            }
        }
    }

    // Build split route
    let mut split_routes = Vec::new();

    if best_split.0 > 0 {
        let route_a_copy = scale_route(route_a, best_amounts.0);
        split_routes.push((route_a_copy, best_split.0));
    }

    if best_split.1 > 0 {
        let route_b_copy = scale_route(route_b, best_amounts.1);
        split_routes.push((route_b_copy, best_split.1));
    }

    if best_split.2 > 0 {
        let route_c_copy = scale_route(route_c, best_amounts.2);
        split_routes.push((route_c_copy, best_split.2));
    }

    let combined_gas = split_routes.iter().map(|(r, _)| r.gas_estimate).sum();
    let combined_impact = calculate_combined_price_impact(&split_routes);

    Ok(SplitRoute::new(
        split_routes,
        total_amount,
        best_output,
        combined_impact,
        combined_gas,
    ))
}

/// Simulate route output for a given amount
///
/// This is a simplified simulation. In production, this would:
/// - Re-simulate each hop with the new amount
/// - Account for changing liquidity and price impact
/// - Handle tick crossings properly
fn simulate_route_output(route: &Route, amount: U256) -> U256 {
    if amount.is_zero() {
        return U256::ZERO;
    }

    // Scale based on original route's ratio
    if route.total_amount_in.is_zero() {
        return U256::ZERO;
    }

    // Simple linear scaling (simplified)
    let ratio = amount.to::<u128>() as f64 / route.total_amount_in.to::<u128>() as f64;
    let estimated_output = (route.total_amount_out.to::<u128>() as f64 * ratio) as u128;

    U256::from(estimated_output)
}

/// Scale a route to a new input amount
fn scale_route(route: &Route, new_amount: U256) -> Route {
    let new_output = simulate_route_output(route, new_amount);

    // Scale price impact (it should increase with amount)
    let scale_factor = if route.total_amount_in.is_zero() {
        1.0
    } else {
        new_amount.to::<u128>() as f64 / route.total_amount_in.to::<u128>() as f64
    };

    let new_impact = route.price_impact * scale_factor.sqrt(); // Sqrt for non-linear scaling

    Route::new(
        route.hops.clone(),
        new_amount,
        new_output,
        new_impact,
        route.gas_estimate,
    )
}

/// Calculate combined price impact for split routes
fn calculate_combined_price_impact(routes: &[(Route, u8)]) -> f64 {
    if routes.is_empty() {
        return 0.0;
    }

    // Weighted average by percentage
    let total_impact: f64 = routes
        .iter()
        .map(|(route, percentage)| route.price_impact * (*percentage as f64 / 100.0))
        .sum();

    total_impact
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::PoolEdge;
    use crate::routing::RouteHop;
    use crate::utils::address_from_u64;

    fn create_test_route(
        amount_in: U256,
        amount_out: U256,
        price_impact: f64,
        gas: u64,
    ) -> Route {
        let pool = PoolEdge::new(
            [1u8; 32],
            address_from_u64(1),
            address_from_u64(2),
            3000,
            60,
            1_000_000,
            U256::from(1u128 << 96),
            0,
        );

        let hop = RouteHop::new(
            pool,
            address_from_u64(1),
            address_from_u64(2),
            amount_in,
            amount_out,
        );

        Route::new(vec![hop], amount_in, amount_out, price_impact, gas)
    }

    #[test]
    fn test_single_route_split() {
        let route = create_test_route(
            U256::from(1000),
            U256::from(990),
            0.1,
            100_000,
        );

        let split = optimize_split_route(vec![route], U256::from(1000))
            .expect("Should optimize");

        assert_eq!(split.routes.len(), 1);
        assert_eq!(split.routes[0].1, 100); // 100% on single route
    }

    #[test]
    fn test_two_route_split() {
        let route1 = create_test_route(
            U256::from(1000),
            U256::from(990),
            0.1,
            100_000,
        );

        let route2 = create_test_route(
            U256::from(1000),
            U256::from(985),
            0.15,
            110_000,
        );

        let split = optimize_split_route(vec![route1, route2], U256::from(1000))
            .expect("Should optimize");

        // Should split somehow
        assert!(split.routes.len() >= 1);
        assert!(split.total_amount_out > U256::ZERO);

        // Total percentage should be 100
        let total_pct: u8 = split.routes.iter().map(|(_, pct)| pct).sum();
        assert_eq!(total_pct, 100);
    }

    #[test]
    fn test_three_route_split() {
        let route1 = create_test_route(
            U256::from(1000),
            U256::from(990),
            0.1,
            100_000,
        );

        let route2 = create_test_route(
            U256::from(1000),
            U256::from(985),
            0.15,
            110_000,
        );

        let route3 = create_test_route(
            U256::from(1000),
            U256::from(980),
            0.2,
            120_000,
        );

        let split =
            optimize_split_route(vec![route1, route2, route3], U256::from(1000))
                .expect("Should optimize");

        assert!(split.routes.len() >= 1);
        assert!(split.total_amount_out > U256::ZERO);

        // Total percentage should be 100
        let total_pct: u8 = split.routes.iter().map(|(_, pct)| pct).sum();
        assert_eq!(total_pct, 100);
    }

    #[test]
    fn test_simulate_route_output() {
        let route = create_test_route(
            U256::from(1000),
            U256::from(990),
            0.1,
            100_000,
        );

        // Test half amount
        let output = simulate_route_output(&route, U256::from(500));
        assert!(output > U256::ZERO);
        assert!(output < U256::from(990));
    }

    #[test]
    fn test_scale_route() {
        let route = create_test_route(
            U256::from(1000),
            U256::from(990),
            0.1,
            100_000,
        );

        let scaled = scale_route(&route, U256::from(500));

        assert_eq!(scaled.total_amount_in, U256::from(500));
        assert!(scaled.total_amount_out > U256::ZERO);
        assert!(scaled.total_amount_out < route.total_amount_out);
    }

    #[test]
    fn test_combined_price_impact() {
        let route1 = create_test_route(
            U256::from(500),
            U256::from(495),
            0.1,
            100_000,
        );

        let route2 = create_test_route(
            U256::from(500),
            U256::from(490),
            0.2,
            100_000,
        );

        let routes = vec![(route1, 50u8), (route2, 50u8)];

        let impact = calculate_combined_price_impact(&routes);

        // Should be weighted average: (0.1 * 0.5) + (0.2 * 0.5) = 0.15
        assert!((impact - 0.15).abs() < 0.01);
    }
}
